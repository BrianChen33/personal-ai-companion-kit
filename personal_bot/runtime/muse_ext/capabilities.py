"""One registry for opt-in bundled capabilities; legacy roots remain compatible."""
import json
from pathlib import Path


def enabled(subject, pid):
    root = Path(subject.root if hasattr(subject, 'root') else subject)
    try:
        if hasattr(subject, 'config'):
            config = subject.config()
        else:
            if not (root / 'config.json').exists():
                return True  # legacy standalone helper, no managed profile
            config = json.loads((root / 'config.json').read_text(encoding='utf-8'))
        if config.get('inheritance_pending'):
            return False
        if config.get('plugin_profile') != 'managed-core-v1':
            return True
        from muse_ext.plugins import read_registry
        if hasattr(subject, 'root'):
            registry = read_registry(subject)
        else:
            from types import SimpleNamespace
            registry = read_registry(SimpleNamespace(root=root))
        return registry['plugins'].get(pid, {}).get('enabled') is True
    except (OSError, ValueError, TypeError):
        return False


def require(subject, pid):
    if not enabled(subject, pid):
        raise ValueError('plugin_disabled:' + pid)


def operation_plugin(op):
    if op.startswith('meme_') or op == 'companion_meme_status':
        return 'memes'
    return {'companion_panel': 'dashboard', 'companion_photo': 'life-camera'}.get(op)
