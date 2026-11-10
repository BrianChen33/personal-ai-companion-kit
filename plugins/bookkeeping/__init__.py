"""Optional host-native bookkeeping binding. No parallel local ledger."""
import json
from pathlib import Path

API = 1
VERSION = '0.1.0'


def _path(b):
    return b.root / 'state' / 'bookkeeping-binding.json'


def initialize(b):
    # Installation never creates wallets, executes host actions or schedules jobs.
    pass


def _binding(b):
    path = _path(b)
    if not path.exists():
        return None
    if path.is_symlink() or path.stat().st_size > 16384:
        raise ValueError('invalid_bookkeeping_binding')
    return json.loads(path.read_text(encoding='utf-8'))


def context(b, q):
    # Financial data and even host queries stay out of unrelated reply context.
    return {}


def panel(b):
    binding = _binding(b)
    return dict(status='host_bound' if binding else 'awaiting_host_binding', version=VERSION,
                backend='host-space', stores_ledger_locally=False,
                export_available=bool(binding and binding.get('export_action')))


def dispatch(b, q):
    if q.get('scope') != 'owner-private':
        raise ValueError('bookkeeping_owner_private_only')
    action = q.get('action', 'status')
    if action == 'status':
        return dict(ok=True, **panel(b))
    if action == 'bind_host':
        if q.get('authorized') is not True:
            raise ValueError('owner_authorization_required')
        supplied = q.get('binding', {})
        # Only identifiers and capability receipts, never a URL containing a key.
        value = {}
        for key in ('host', 'space', 'read_action', 'write_action', 'data_schema', 'receipt'):
            text = supplied.get(key)
            if not isinstance(text, str) or not text.strip() or len(text) > 240 or '\n' in text:
                raise ValueError('verified_host_binding_required:' + key)
            value[key] = text
        export = supplied.get('export_action')
        if export is not None and (not isinstance(export, str) or not export.strip() or len(export) > 120):
            raise ValueError('invalid_export_action')
        value['export_action'] = export
        value['version'] = VERSION
        from muse_ext.companion_io import atomic
        atomic(_path(b), json.dumps(value, ensure_ascii=False, indent=2))
        return dict(ok=True, **panel(b))
    if action in ('host_contract', 'backup_request'):
        binding = _binding(b)
        if not binding:
            return dict(ok=False, status='awaiting_host_binding')
        if action == 'backup_request' and not binding.get('export_action'):
            return dict(ok=False, status='host_export_not_implemented')
        return dict(ok=True, binding=binding, execution='host_tool_required',
                    guide=str(Path(__file__).with_name('PROTOCOL.md')),
                    completed=False)
    raise ValueError('unknown_bookkeeping_action')


def allow_share(b, event_id):
    return False
