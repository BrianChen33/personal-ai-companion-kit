"""Stage an authorized native vault in a NEW disabled root; never replay it."""
import json
import re
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path
from . import deploy as d
from .vault import safe_name, safe_source, sha, SCHEMA


def inspect(snapshot, expected_commit):
    folder = safe_source(snapshot).resolve()
    manifest_path = safe_source(folder / 'manifest.json')
    if manifest_path.stat().st_size > 2_000_000:
        raise ValueError('manifest_too_large')
    m = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not re.fullmatch('[0-9a-f]{40}', expected_commit or ''):
        raise ValueError('source_architecture_commit_required')
    if m.get('schema') != SCHEMA or m.get('architecture', {}).get('commit') != expected_commit:
        raise ValueError('snapshot_schema_or_architecture_mismatch')
    files, total = {}, 0
    entries = m.get('files')
    if not isinstance(entries, list) or not 1 <= len(entries) <= 5000:
        raise ValueError('invalid_snapshot_file_list')
    for entry in entries:
        name = safe_name(entry['path'])
        if name in files or name == 'manifest.json':
            raise ValueError('duplicate_snapshot_path')
        p = safe_source(folder / name)
        if not p.resolve().is_relative_to(folder) or not p.is_file():
            raise ValueError('invalid_snapshot_file')
        total += p.stat().st_size
        if total > 256_000_000 or p.stat().st_size != entry['bytes'] or sha(p) != entry['sha256']:
            raise ValueError('snapshot_integrity_or_size_mismatch')
        files[name] = p
    if 'brain.sqlite' not in files:
        raise ValueError('snapshot_database_required')
    for alias, target in m.get('aliases', {}).items():
        alias, target = safe_name(alias), safe_name(target)
        if alias in files or target not in files:
            raise ValueError('invalid_snapshot_alias')
        files[alias] = files[target]
    if any((folder / name).exists() for name in ('brain.sqlite-wal', 'brain.sqlite-shm', 'brain.sqlite-journal')):
        raise ValueError('snapshot_requires_checkpointed_database')
    with closing(sqlite3.connect(files['brain.sqlite'].resolve().as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('invalid_snapshot_database')
    return m, files


def stage(snapshot, root, expected_commit, selected=None, character_name=None):
    # Validate everything before touching the target. Do not modify source files.
    m, files = inspect(snapshot, expected_commit)
    root = d.root_path(root)
    if root.exists():
        raise ValueError('inheritance_requires_new_nonexistent_root')
    if character_name is not None and (not isinstance(character_name, str) or not character_name.strip() or len(character_name) > 80):
        raise ValueError('invalid_character_name')
    from .onboarding import apply
    result = apply(root, selected or [])
    cfg = json.loads((root / 'config.json').read_text(encoding='utf-8'))
    cfg.update(enabled=False, inheritance_pending=True)
    d.write_json(root / 'config.json', cfg)
    # Preserve an exact archive. Operational files are references, never installed.
    archive = root / 'inherited'
    expected = {entry['path']: entry['sha256'] for entry in m['files']}
    expected.update({alias: expected[target] for alias, target in m.get('aliases', {}).items()})
    for name, path in files.items():
        target = archive / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        if sha(target) != expected[name]:
            raise ValueError('source_changed_during_staging')
    d.write_json(archive / 'manifest.json', m)
    db_path = root / 'data' / 'brain.sqlite'
    # init's subprocess has exited; the fresh local database has no active user.
    for suffix in ('-wal', '-shm'):
        sidecar = Path(str(db_path) + suffix)
        if sidecar.exists():
            sidecar.unlink()
    shutil.copyfile(archive / 'brain.sqlite', db_path)
    report = dict(status='staged_requires_host_review', source_architecture=m['architecture'],
                  installed_version=result['version'], archived_files=len(files), enabled=False,
                  character_name=character_name, original_content_renamed=False,
                  host_binding='not_verified', tasks_created=0,
                  review=['adopt selected persona and growth with explicit name mapping',
                          'replace host_paths, person_map, task_bindings and plugin host bindings',
                          'reconcile old reminders, claims and delivery ledgers without resending',
                          'confirm target runtime schema and compact real-source reply round',
                          'clear inheritance_pending only after explicit host review'])
    d.write_json(root / 'state' / 'inheritance.json', report)
    return dict(ok=True, **report)
