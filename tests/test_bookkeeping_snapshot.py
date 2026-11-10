"""Frozen synthetic ledger survives vault delivery without applying transactions."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from personal_bot import deploy, vault

spec = importlib.util.spec_from_file_location('bookkeeping_snapshot', Path(__file__).resolve().parents[1] / 'plugins/bookkeeping/snapshot.py')
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class BookkeepingSnapshot(unittest.TestCase):
    def example(self):
        data = dict(wallets=[dict(id='cash', currency='HKD', balance_cents=12345),
                             dict(id='debt', currency='CNY', balance_cents=-800),
                             dict(id='unknown', currency='USD', balance_cents=None)],
                    transactions=[dict(id=7, wallet_id='cash', amount_cents=200, kind='expense',
                                       occurred_on='2026-01-01', created_at=1767225600000)],
                    settings=[dict(id=1, display_currency='HKD')],
                    subscriptions=[dict(id='fixture', currency='HKD', amount_cents=600, period_months=12)])
        return dict(schema=snapshot.SCHEMA, plugin_version='0.1.0', exported_at=time.time(),
                    source_revision='fixture-v1', counts={k: len(v) for k,v in data.items()}, data=data)

    def test_register_export_preserves_native_values_and_other_sources(self):
        with tempfile.TemporaryDirectory(prefix='ledger-isolated-') as folder:
            base = Path(folder)
            root = base / 'state'
            deploy.init(root)
            deploy.write_json(root / 'backup-sources.json', {'sources': [], 'trees': [], 'custom': 'keep'})
            source = base / 'ledger.json'
            value = self.example()
            source.write_text(json.dumps(value), encoding='utf-8')
            result = snapshot.register(root, source)
            self.assertFalse(result['uploaded'])
            self.assertEqual(json.loads((root / 'backup-sources.json').read_text())['custom'], 'keep')
            manifest = vault.export_snapshot(root, base / 'backup', 'a' * 40, bootstrap=True)
            captured = json.loads((base / 'backup/plugins/bookkeeping/ledger.json').read_text())
            self.assertEqual(captured, value)
            self.assertEqual(manifest['plugins'][0]['source_revision'], value['source_revision'])
            self.assertEqual(snapshot.validate(captured, fresh=False), value)
            # Re-registering replaces one declaration; no financial replay or duplicate registry entry.
            snapshot.register(root, source)
            self.assertEqual(len(json.loads((root / 'backup-sources.json').read_text())['plugin_snapshots']), 1)

    def test_incomplete_stale_or_broken_references_rejected(self):
        value = self.example()
        invalids = []
        v=copy.deepcopy(value); v['counts']['transactions']=0; invalids.append(v)
        v=copy.deepcopy(value); v['data']['transactions'][0]['wallet_id']='missing'; invalids.append(v)
        v=copy.deepcopy(value); v['exported_at']-=1000; invalids.append(v)
        v=copy.deepcopy(value); v['exported_at']=float('nan'); invalids.append(v)
        v=copy.deepcopy(value); v['data']['wallets'][0]['balance_cents']=12.5; invalids.append(v)
        for v in invalids:
            with self.subTest(v=v), self.assertRaises(ValueError):
                snapshot.validate(v)
        value['exported_at'] -= 100000
        self.assertEqual(snapshot.validate(value, fresh=False), value)
