"""Offline, explicit installation. No host API, credential or task activation."""
import json
from pathlib import Path
from . import deploy as d
from . import __version__


def catalogue():
    return json.loads((d.PACKAGE / 'plugin_catalog.json').read_text(encoding='utf-8'))


def source(pid):
    bundled = d.PACKAGE / 'bundled_plugins' / pid
    checkout = d.PACKAGE.parent / 'plugins' / pid
    return bundled if bundled.is_dir() else checkout


def plan(root, selected):
    if not isinstance(selected, list) or any(not isinstance(p, str) for p in selected):
        raise ValueError('plugin_id_list_required')
    items = {p['id']: p for p in catalogue()['plugins']}
    selected = sorted(set(selected))
    for pid in selected:
        if pid not in items or items[pid]['status'] != 'available':
            raise ValueError('plugin_not_available:' + pid)
        if not (source(pid) / 'manifest.json').is_file():
            raise ValueError('plugin_package_missing:' + pid)
    return dict(ok=True, version=__version__, profile='managed-core-v1', selected=selected,
                data_root=str(root), plugins=[items[p] for p in selected],
                enabled=False, host_binding='not_verified', tasks_created=0,
                persona='inherit_authorized_source_or_ask_owner',
                next='apply locally; then bind only chosen capabilities using real host tools')


def apply(root, selected):
    root = d.root_path(root)
    proposed = plan(root, selected)
    checkpoint = root / 'state' / 'installation.json'
    if checkpoint.exists():
        d.owned(root)
        previous = json.loads(checkpoint.read_text(encoding='utf-8'))
        if previous.get('selected') != proposed['selected'] or previous.get('version') != __version__:
            raise ValueError('existing_setup_requires_explicit_plugin_management_or_upgrade')
        if previous.get('status') == 'prepared':
            actual = d.request(root, dict(op='plugin_manage', action='list'))['plugins']
            if not set(proposed['selected']).issubset({p['id'] for p in actual}):
                raise ValueError('prepared_plugins_missing_use_explicit_plugin_management')
            config = json.loads((root / 'config.json').read_text(encoding='utf-8'))
            return dict(proposed, status='already_prepared', enabled=config.get('enabled', False),
                        installed_plugins=actual, host_binding='not_reverified')
    elif root.exists() and any(root.iterdir()):
        raise ValueError('setup_requires_new_empty_root_use_explicit_upgrade_for_existing_state')
    # Check every selected manifest before creating any runtime state.
    import sys
    if str(d.RUNTIME) not in sys.path:
        sys.path.insert(0, str(d.RUNTIME))
    from muse_ext.plugins import manifest
    for pid in proposed['selected']:
        manifest(source(pid))
    d.init(root)
    cfg = json.loads((root / 'config.json').read_text(encoding='utf-8'))
    cfg['plugin_profile'] = 'managed-core-v1'
    d.write_json(root / 'config.json', cfg)
    d.write_json(checkpoint, dict(proposed, status='preparing'))
    for pid in proposed['selected']:
        # Resume a partial copy as well as a missing registry entry. This phase is disabled.
        d.request(root, dict(op='plugin_manage', action='install', source_dir=str(source(pid))))
    # Existing core backup remains local. Remote delivery is separately opt-in.
    blueprint = d.blueprint(root)
    keep = {'life-news', 'emotion', 'maintenance', 'backup', 'reminder-reconcile'}
    if 'social-reading' in selected:
        keep.add('reading')
    if 'memes' in selected:
        keep.add('meme-reconcile')
    # Managed instructions have no implicit optional operations from legacy prose.
    bodies = {
        'life-news': 'Plan independent virtual companion activities with companion_day and companion_activity. Never copy owner agenda. Heavy work yields to incoming chat.',
        'emotion': 'companion_tick; assess pending original events with the SAME host model; repair at most 2 invalid recent events using companion_feedback. Share through companion_share and real host receipt. No self-appraisal or new model call.',
        'maintenance': 'Bounded maintain/consolidate/summary work; skip while inbox has backlog. Never auto-merge conflicting facts.',
        'backup': 'Export current and historical native task definitions as inactive reference. Run ' + d.command(root, 'backup') + '. Remote delivery only if github-vault enabled and bound.',
        'reminder-reconcile': 'Reconcile explicit active reminders with real native task IDs. Completed/unknown receipts never resend; inherited reminders stay inactive until rebound.',
        'reading': 'Only when social-reading enabled and sources approved: consume one bounded phone intent via the plugin PROTOCOL. Never browse in emotion heartbeat.',
        'meme-reconcile': 'Only when memes enabled: one weekly bounded public meme-sync, no daily sync or submissions.'}
    tasks = []
    for task in blueprint['tasks']:
        name = next((n for n in keep if task['id'].endswith('-' + n)), None)
        if name:
            task['body'] = ('Use actual host tools. Follow CURRENT_RULES and selected plugin protocols. '
                            '01:00–07:00 Asia/Shanghai: no unsolicited messages. No task is installed by this file. ' + bodies[name])
            if name == 'emotion' and 'dashboard' in selected:
                task['body'] += ' If dashboard enabled, refresh at the end of this run; no separate panel job.'
            if name == 'life-news' and 'life-camera' in selected:
                task['body'] += ' If life-camera enabled and bound, optionally request a scene-linked photo through its protocol.'
            tasks.append(task)
    blueprint['tasks'] = tasks
    d.write_json(root / 'state' / 'scheduler-blueprint.json', blueprint)
    d.write_json(checkpoint, dict(proposed, status='prepared'))
    return dict(proposed, status='prepared')
