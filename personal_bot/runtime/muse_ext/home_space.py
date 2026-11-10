"""Opt-in local outbox for a private home. Network publication belongs to the host."""
import argparse
import hashlib
import json
from pathlib import Path
import time

from muse_ext.panel_home import read_json
from muse_ext.panel_refresh import atomic, guard


CHANGING = frozenset(('prepare', 'submit_assessment', 'companion_commit',
    'companion_tick', 'companion_life_assess', 'companion_proactive',
    'companion_activity', 'companion_day', 'companion_expression_config',
    'companion_life_config', 'companion_people_sync', 'companion_summary_commit',
    'plugin_call', 'plugin_manage', 'meme_learn', 'meme_feedback'))


def path(root, name):
    return Path(root) / 'state' / ('home-space-' + name + '.json')


def write(root, name, value):
    atomic(path(root, name), json.dumps(value, ensure_ascii=False,
        separators=(',', ':'), allow_nan=False).encode('utf-8'))


def mark(root, operation):
    """A tiny post-success marker. Never build a panel or call a model here."""
    from muse_ext.capabilities import enabled
    if not enabled(root, 'home-space'):
        return
    config = read_json(path(root, 'binding'))
    if config.get('enabled') is not True:
        return
    write(root, 'dirty', {'revision': str(time.time_ns()), 'operation': operation})


def install(Brain):
    previous = Brain.dispatch

    def dispatch(self, request):
        result = previous(self, request)
        action = request.get('action', 'status')
        read_only = request.get('op') in ('companion_activity', 'companion_day', 'plugin_call') and action in (
            'status', 'pending', 'view', 'context', 'queue_status', 'usage_work', 'habit_growth_work')
        if (request.get('op') in CHANGING and not read_only and result.get('ok') is True
                and not result.get('disabled') and not result.get('replayed')):
            # Publication failure must never turn an already committed reply into failure.
            try:
                mark(self.root, request['op'])
            except (OSError, ValueError):
                pass  # The existing heartbeat independently captures current state.
        return result

    Brain.dispatch = dispatch


def probe(root, now=None):
    """Native hook polls locally. A lease bounds retries until a real receipt arrives."""
    from muse_ext.capabilities import enabled
    if not enabled(root, 'home-space'):
        return {'wake': False, 'reason': 'plugin_disabled'}
    now = time.time() if now is None else now
    with guard(root):
        if read_json(path(root, 'binding')).get('enabled') is not True:
            return {'wake': False, 'reason': 'disabled'}
        dirty = read_json(path(root, 'dirty'))
        receipt = read_json(path(root, 'receipt'))
        if not dirty or receipt.get('dirty_revision') == dirty.get('revision'):
            return {'wake': False, 'reason': 'unchanged'}
        lease = read_json(path(root, 'lease'))
        if lease.get('until', 0) > now:
            return {'wake': False, 'reason': 'publishing'}
        # This also coalesces bursts. New writes during publication remain pending.
        write(root, 'lease', {'until': now + 120, 'dirty_revision': dirty['revision']})
        return {'wake': True, 'reason': 'state_changed', 'dirty_revision': dirty['revision']}


def capture(root):
    """Read the canonical panel once in the background, without static private art."""
    from muse_ext.capabilities import require
    require(root, 'home-space')
    from brain import Brain
    from muse_ext.companion_io import panel_snapshot
    with guard(root):
        binding = read_json(path(root, 'binding'))
        if binding.get('enabled') is not True:
            raise ValueError('home_space_not_bound')
        dirty = read_json(path(root, 'dirty'))
        b = Brain(root)
        try:
            with b.db:
                b.db.execute('BEGIN')
                snapshot = panel_snapshot(b, include_art=False)
        finally:
            b.close()
        # Bounded published detail lists. Original native memories remain authoritative.
        snapshot['people'] = snapshot.get('people', [])[:100]
        snapshot['life'] = [{key: row.get(key) for key in ('activity', 'stage', 'origin', 'occurred', 'description')}
            for row in snapshot.get('life', [])[:20]]
        for row in snapshot['life']:
            row['description'] = str(row.get('description') or '')[:500]
        snapshot['summaries'] = snapshot.get('summaries', [])[:12]
        for row in snapshot['summaries']:
            row['content'] = str(row.get('content') or '')[:1000]
        for plugin in snapshot.get('plugins', {}).get('items', []):
            habits = plugin.get('habits', [])
            plugin['habit_total'] = len(habits)
            plugin['habits'] = [{key: row.get(key) for key in ('form', 'pattern', 'status')}
                for row in habits[:1000]]
            for key in ('habit_personality', 'personality_growth'):
                if key in plugin:
                    plugin[key] = plugin[key][:24]
            plugin.pop('reading_queue', None)
        snapshot.pop('stored_mood', None)
        snapshot.pop('emotion_assessment', None)
        snapshot.pop('tasks', None)
        snapshot['schema'] = 'companion-home-v1'
        snapshot['home_locations'] = binding.get('home_locations', ['小屋', '云端小屋', '家里', '家中', '家'])
        snapshot['revision'] = str(time.time_ns())
        encoded = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
        if len(encoded) > 240_000:
            raise ValueError('home_projection_budget_exceeded')
        digest = hashlib.sha256(encoded).hexdigest()
        envelope = {'snapshot': snapshot, 'sha256': digest,
            'dirty_revision': dirty.get('revision'), 'space': binding.get('space')}
        write(root, 'outbox', envelope)
        return envelope


def acknowledge(root, revision, digest):
    """Call only after the native action confirms this exact revision and digest."""
    with guard(root):
        outbox = read_json(path(root, 'outbox'), limit=256_000)
        if (outbox.get('snapshot', {}).get('revision') != revision
                or outbox.get('sha256') != digest):
            raise ValueError('home_receipt_does_not_match_outbox')
        write(root, 'receipt', {'revision': revision, 'sha256': digest,
            'dirty_revision': outbox['dirty_revision'], 'published_at': time.time()})
        write(root, 'lease', {'until': 0})
        return {'ok': True, 'revision': revision}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('probe')
    sub.add_parser('capture')
    ack = sub.add_parser('ack')
    ack.add_argument('--revision', required=True)
    ack.add_argument('--sha256', required=True)
    args = parser.parse_args()
    if args.command == 'probe':
        result = probe(args.root)
        print(('wake' if result['wake'] else 'silent') + '\t' + json.dumps(result))
    elif args.command == 'capture':
        print(json.dumps(capture(args.root), ensure_ascii=False, allow_nan=False))
    else:
        print(json.dumps(acknowledge(args.root, args.revision, args.sha256)))


if __name__ == '__main__':
    main()
