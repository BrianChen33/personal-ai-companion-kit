"""Synthetic binding acceptance; never call a financial host action."""
import sys
import tempfile
import unittest
from pathlib import Path
from personal_bot import deploy

sys.path.insert(0, str(deploy.RUNTIME))
from brain import Brain
from muse_ext import plugins


class BookkeepingPlugin(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bookkeeping-isolated-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'state'
        deploy.init(self.root)
        self.brain = Brain(self.root)
        self.addCleanup(self.brain.close)
        plugin = Path(__file__).resolve().parents[1] / 'plugins/bookkeeping'
        self.brain.dispatch(dict(op='plugin_manage', action='install', source_dir=str(plugin)))
        self.brain.dispatch(dict(op='plugin_manage', action='enable', plugin='bookkeeping'))

    def call(self, action, **kwargs):
        return self.brain.dispatch(dict(op='plugin_call', plugin='bookkeeping', scope='owner-private', action=action, **kwargs))

    def test_install_does_not_create_ledger_or_load_finances_into_context(self):
        self.assertEqual(self.call('status')['status'], 'awaiting_host_binding')
        self.assertEqual(plugins.load(self.brain, 'bookkeeping').context(self.brain, {'scope': 'owner-private'}), {})
        self.assertFalse((self.root / 'state/bookkeeping-binding.json').exists())

    def test_binding_reports_real_export_gap_without_fake_execution(self):
        binding = dict(host='synthetic', space='fixture', read_action='read', write_action='write',
                       data_schema='fixture-v1', receipt='synthetic capability readback')
        self.call('bind_host', authorized=True, binding=binding)
        self.assertEqual(self.call('backup_request')['status'], 'host_export_not_implemented')
        self.call('bind_host', authorized=True, binding={**binding, 'export_action': 'export_snapshot'})
        self.assertFalse(self.call('backup_request')['completed'])
        self.assertEqual(self.call('host_contract')['execution'], 'host_tool_required')
