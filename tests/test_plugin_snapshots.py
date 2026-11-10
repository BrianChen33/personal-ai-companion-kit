"""One isolated native plugin-export acceptance; synthetic records only."""
import json
from contextlib import closing
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from personal_bot import deploy, vault


class PluginSnapshots(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='plugin-vault-isolated-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'state'
        deploy.init(self.root)
        self.data = self.base / 'ledger.json'
        self.data.write_text(json.dumps({'wallets': [{'id': 'synthetic', 'currency': 'CNY', 'balance': '12.30'}]}))
        self.entry = dict(plugin='bookkeeping', version='0.1.0', data_schema='bookkeeping-space-v1',
                          source_revision='synthetic-revision',
                          scope='owner-private', owner_approved=True, enabled=True, captured_at=time.time(),
                          files=[dict(name='ledger.json', path=str(self.data))])

    def save(self):
        deploy.write_json(self.root / 'backup-sources.json', {'plugin_snapshots': [self.entry]})

    def test_native_export_included_with_inactive_restore_metadata(self):
        self.save()
        dest = self.base / 'snapshot'
        manifest = vault.export_snapshot(self.root, dest, 'a' * 40, bootstrap=True)
        self.assertEqual((dest / 'plugins/bookkeeping/ledger.json').read_bytes(), self.data.read_bytes())
        self.assertFalse(manifest['plugins'][0]['auto_activate'])
        self.assertEqual(manifest['plugins'][0]['data_schema'], 'bookkeeping-space-v1')
        self.assertEqual(manifest['plugins'][0]['source_revision'], 'synthetic-revision')
        self.assertEqual(next(f for f in manifest['files'] if f['path'].startswith('plugins/'))['category'], 'plugin_private_data')

    def test_stale_unapproved_duplicate_and_unsafe_exports_refused(self):
        for field, bad in [('captured_at', time.time() - 1000), ('scope', 'group'), ('owner_approved', False), ('plugin', '../escape')]:
            item = {**self.entry, field: bad}
            with self.subTest(field=field), self.assertRaises(ValueError):
                vault.plugin_snapshot_sources({'plugin_snapshots': [item]})
        with self.assertRaises(ValueError):
            vault.plugin_snapshot_sources({'plugin_snapshots': [self.entry, self.entry]})
        item = {**self.entry, 'files': [dict(name='../outside.json', path=str(self.data))]}
        with self.assertRaises(ValueError):
            vault.plugin_snapshot_sources({'plugin_snapshots': [item]})

    def test_disabled_omitted_and_raw_health_still_excluded(self):
        self.assertEqual(vault.plugin_snapshot_sources({'plugin_snapshots': [{**self.entry, 'enabled': False}]}), ({}, []))
        with self.assertRaisesRegex(ValueError, 'raw_health'):
            vault.plugin_snapshot_sources({'plugin_snapshots': [{**self.entry, 'plugin': 'mi-fitness'}]})

    def test_credential_scan_still_applies(self):
        self.data.write_text(json.dumps({'api_key': 'synthetic-secret'}))
        self.save()
        with self.assertRaisesRegex(ValueError, 'credential_json'):
            vault.export_snapshot(self.root, self.base / 'rejected', 'a' * 40, bootstrap=True)

    def test_sqlite_requires_closed_native_snapshot(self):
        path = self.base / 'native.sqlite'
        with closing(sqlite3.connect(path)) as db:
            db.execute('CREATE TABLE fixture(id INTEGER)')
            db.commit()
        self.entry['files'] = [dict(name='native.sqlite', path=str(path))]
        selected, _ = vault.plugin_snapshot_sources({'plugin_snapshots': [self.entry]})
        self.assertIn('plugins/bookkeeping/native.sqlite', selected)
        Path(str(path) + '-wal').write_bytes(b'')
        with self.assertRaisesRegex(ValueError, 'consistent_closed_export'):
            vault.plugin_snapshot_sources({'plugin_snapshots': [self.entry]})
