"""Publish a changed home snapshot to an owner-private Redis key, without a model."""
import argparse
import base64
import gzip
import json
from pathlib import Path
import subprocess

from muse_ext import home_space
from muse_ext.panel_home import read_json


SCHEMA = 'companion-home-relay-v1'
SCRIPT = """
local current = redis.call('GET', KEYS[1])
if current then
    local old = cjson.decode(current)
    local revision = old.revision
    if #revision > #ARGV[2] or (#revision == #ARGV[2] and revision > ARGV[2]) then
        return {'stale', revision, old.sha256}
    end
    if revision == ARGV[2] then
        if old.sha256 == ARGV[3] then
            redis.call('SET', KEYS[2], ARGV[4], 'EX', 604800)
            return {'idempotent', revision, old.sha256}
        end
        return {'conflict', revision, old.sha256}
    end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 604800)
redis.call('SET', KEYS[2], ARGV[4], 'EX', 604800)
return {'stored', ARGV[2], ARGV[3]}
"""


def encode(envelope):
    snapshot = envelope['snapshot']
    raw = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'),
        allow_nan=False).encode('utf-8')
    if len(raw) > 240_000:
        raise ValueError('home_projection_budget_exceeded')
    return {
        'schema': SCHEMA, 'revision': snapshot['revision'],
        'sha256': envelope['sha256'], 'generated_at': snapshot['generated_at'],
        'encoding': 'gzip-base64',
        'data': base64.b64encode(gzip.compress(raw, mtime=0)).decode('ascii'),
    }


def send(config, command):
    """Reuse the host's installed ioredis and existing TLS credential file."""
    result = subprocess.run([config.get('node', 'node'), config['sender_path'],
        config['credentials_file'], config['ioredis_module']],
        input=json.dumps(command), capture_output=True, text=True, timeout=20, check=True)
    return json.loads(result.stdout)['result']


def publish(root, config_path, sender=send):
    """Called by a silent local hook. Credentials stay outside the brain and backups."""
    config_path = Path(config_path).expanduser().resolve()
    root = Path(root).resolve()
    if config_path == root or root in config_path.parents:
        raise ValueError('home_relay_credentials_must_be_outside_brain')
    config = read_json(config_path, limit=16_000)
    key = config.get('key')
    if not all(isinstance(config.get(field), str) and config[field] for field in (
            'credentials_file', 'ioredis_module', 'sender_path', 'key')):
        raise ValueError('home_relay_configuration_incomplete')
    credentials = Path(config['credentials_file']).expanduser().resolve()
    if credentials == root or root in credentials.parents:
        raise ValueError('home_relay_credentials_must_be_outside_brain')
    config['credentials_file'] = str(credentials)
    decision = home_space.probe(root)
    if not decision['wake']:
        return {'ok': True, 'status': decision['reason']}
    envelope = home_space.capture(root)
    value = json.dumps(encode(envelope), ensure_ascii=False, separators=(',', ':'))
    revision, digest = envelope['snapshot']['revision'], envelope['sha256']
    head = json.dumps({'revision': revision, 'sha256': digest,
        'generated_at': envelope['snapshot']['generated_at']}, separators=(',', ':'))
    command = ['EVAL', SCRIPT, 2, key, key + ':head', value, revision, digest, head]
    result = sender(config, command)
    if (not isinstance(result, list) or len(result) != 3
            or result[0] not in ('stored', 'idempotent')
            or result[1:] != [revision, digest]):
        raise ValueError('home_relay_receipt_mismatch')
    home_space.acknowledge(root, revision, digest)
    return {'ok': True, 'status': result[0], 'revision': revision,
        'wire_bytes': len(value.encode('utf-8'))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--config', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = publish(args.root, args.config)
    except Exception as error:
        # Never print a request, response, credential or upstream exception body.
        result = {'ok': False, 'status': 'retry_later', 'error': type(error).__name__}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
