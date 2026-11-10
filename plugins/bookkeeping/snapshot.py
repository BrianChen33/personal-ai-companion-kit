"""Register a host-exported ledger for the existing private vault. No host API calls."""
import argparse
import json
import math
import os
from pathlib import Path
import time

SCHEMA = 'bookkeeping-space-v1'
TABLES = ('wallets', 'transactions', 'settings', 'subscriptions')
CURRENCIES = {'CNY', 'HKD', 'USD', 'GBP', 'EUR', 'SGD', 'TWD'}


def validate(value, *, fresh=True):
    if not isinstance(value, dict) or value.get('schema') != SCHEMA or value.get('plugin_version') != '0.1.0':
        raise ValueError('unsupported_bookkeeping_snapshot')
    exported = value.get('exported_at')
    if isinstance(exported, bool) or not isinstance(exported, (int, float)) or not math.isfinite(exported):
        raise ValueError('invalid_snapshot_time')
    if fresh and not 0 <= time.time() - exported <= 900:
        raise ValueError('snapshot_stale_export_again')
    revision = value.get('source_revision')
    if not isinstance(revision, str) or not 0 < len(revision) <= 200:
        raise ValueError('source_revision_required')
    data = value.get('data')
    counts = value.get('counts')
    if not isinstance(data, dict) or set(data) != set(TABLES) or not isinstance(counts, dict):
        raise ValueError('complete_four_table_snapshot_required')
    for table in TABLES:
        rows = data[table]
        if not isinstance(rows, list) or len(rows) > 100000 or counts.get(table) != len(rows):
            raise ValueError('snapshot_count_mismatch:' + table)
        if not all(isinstance(row, dict) and isinstance(row.get('id'), (int, str))
                   and not isinstance(row.get('id'), bool) for row in rows):
            raise ValueError('snapshot_stable_ids_required:' + table)
        if len({row['id'] for row in rows}) != len(rows):
            raise ValueError('snapshot_duplicate_id:' + table)
    wallets = {row['id'] for row in data['wallets']}
    for row in data['wallets']:
        amount = row.get('balance_cents')
        if row.get('currency') not in CURRENCIES or (amount is not None and (isinstance(amount, bool) or not isinstance(amount, int))):
            raise ValueError('invalid_native_wallet_amount_or_currency')
    for row in data['transactions']:
        amount = row.get('amount_cents')
        if row.get('wallet_id') not in wallets or isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
            raise ValueError('invalid_native_transaction')
    for row in data['subscriptions']:
        amount = row.get('amount_cents')
        if row.get('currency') not in CURRENCIES or isinstance(amount, bool) or not isinstance(amount, int) or amount < 0:
            raise ValueError('invalid_native_subscription')
    if len(data['settings']) != 1:
        raise ValueError('one_settings_row_required')
    return value


def register(root, source):
    root, source = Path(root).expanduser().absolute(), Path(source).expanduser().absolute()
    if any(p.is_symlink() for p in (source, *source.parents)) or source.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('unsafe_or_oversized_snapshot')
    value = validate(json.loads(source.read_text(encoding='utf-8')))
    registry = root / 'backup-sources.json'
    if any(p.is_symlink() for p in (registry, *registry.parents)):
        raise ValueError('unsafe_backup_registry')
    catalog = json.loads(registry.read_text(encoding='utf-8')) if registry.exists() else {'sources': [], 'trees': []}
    entries = [p for p in catalog.get('plugin_snapshots', []) if p.get('plugin') != 'bookkeeping']
    entries.append(dict(plugin='bookkeeping', version='0.1.0', data_schema=SCHEMA,
                        scope='owner-private', owner_approved=True, enabled=True,
                        captured_at=value['exported_at'], source_revision=value['source_revision'],
                        files=[dict(name='ledger.json', path=str(source))]))
    catalog['plugin_snapshots'] = entries
    root.mkdir(parents=True, exist_ok=True)
    temp = registry.with_suffix('.json.tmp')
    temp.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.chmod(temp, 0o600)
    temp.replace(registry)
    return dict(ok=True, registered=True, uploaded=False, counts=value['counts'],
                source_revision=value['source_revision'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Register an explicitly approved private bookkeeping export')
    parser.add_argument('--root', required=True)
    parser.add_argument('--file', required=True)
    parser.add_argument('--owner-approved', action='store_true', required=True)
    args = parser.parse_args()
    print(json.dumps(register(args.root, args.file), ensure_ascii=False))
