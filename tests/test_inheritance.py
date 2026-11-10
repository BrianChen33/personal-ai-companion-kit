import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from personal_bot import deploy, inheritance, vault


class InheritanceTests(unittest.TestCase):
    def snapshot(self, tmp):
        source = Path(tmp)/'source'
        deploy.init(source)
        snapshot = Path(tmp)/'snapshot'
        snapshot.mkdir()
        import shutil
        shutil.copyfile(source/'data/brain.sqlite', snapshot/'brain.sqlite')
        (snapshot/'SOUL.md').write_text('Synthetic companion persona', encoding='utf-8')
        (snapshot/'scheduler').mkdir()
        (snapshot/'scheduler/definitions.json').write_text('{"current": []}', encoding='utf-8')
        paths = ['brain.sqlite', 'SOUL.md', 'scheduler/definitions.json']
        manifest = dict(schema=vault.SCHEMA, architecture=dict(commit='a'*40),
                        aliases={'operations/native-schedules.json':'scheduler/definitions.json'},
                        files=[dict(path=p, bytes=(snapshot/p).stat().st_size, sha256=vault.sha(snapshot/p)) for p in paths])
        deploy.write_json(snapshot/'manifest.json', manifest)
        return snapshot

    def test_stage_preserves_native_files_and_blocks_activation(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot = self.snapshot(tmp)
            root = Path(tmp)/'target'
            result = inheritance.stage(snapshot, root, 'a'*40, ['dashboard'], 'Example')
            self.assertFalse(result['enabled'])
            self.assertEqual((root/'inherited/SOUL.md').read_bytes(), (snapshot/'SOUL.md').read_bytes())
            self.assertTrue((root/'inherited/operations/native-schedules.json').is_file())
            with self.assertRaises(RuntimeError):
                deploy.enable(root, [])
            with self.assertRaises(RuntimeError):
                deploy.request(root, dict(op='plugin_manage', action='enable', plugin='dashboard'))
            self.assertTrue(deploy.request(root, dict(op='health'))['integrity'] == 'ok')
            blocked=deploy.request(root, dict(op='expression',scope='owner-private',source_event=1))
            self.assertEqual(blocked.get('error'),'plugin_disabled')

    def test_invalid_snapshot_does_not_create_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot = self.snapshot(tmp)
            (snapshot/'SOUL.md').write_text('changed', encoding='utf-8')
            root = Path(tmp)/'target'
            with self.assertRaises(ValueError):
                inheritance.stage(snapshot, root, 'a'*40)
            self.assertFalse(root.exists())
