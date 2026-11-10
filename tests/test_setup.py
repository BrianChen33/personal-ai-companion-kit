import tempfile
import json
from unittest.mock import patch
import unittest
from pathlib import Path
from personal_bot import deploy, onboarding


class SetupTests(unittest.TestCase):
    def test_interrupted_plugin_copy_can_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            import sys
            sys.path.insert(0, str(deploy.RUNTIME))
            from muse_ext import plugins
            original = deploy.request
            def interrupted(root, q):
                if q.get('action') == 'install':
                    original(root, q)
                    (root / 'extensions/dashboard/__init__.py').unlink()
                    (root / 'extensions/dashboard/manifest.json').unlink()
                    raise RuntimeError('interrupted copy')
                return original(root, q)
            with patch.object(deploy, 'request', side_effect=interrupted):
                with self.assertRaises(RuntimeError):
                    onboarding.apply(root, ['dashboard'])
            onboarding.apply(root, ['dashboard'])
            plugins.manifest(root / 'extensions/dashboard')

    def test_disabled_media_and_qq_boundaries(self):
        import os, shutil, subprocess
        if not shutil.which('node'):
            self.skipTest('node unavailable')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)/'state'
            onboarding.apply(root, [])
            cfg = json.loads((root/'config.json').read_text())
            cfg.update(enabled=True, qq_enabled=True)
            deploy.write_json(root/'config.json', cfg)
            script = '''
import {enqueueLearning} from './qq-adapter.mjs';
import {drainLearning} from './learn.mjs';
import {prepareMedia} from './reply_media.mjs';
import {setPaths,saveDecision} from './sticker_decision.mjs';
import {join} from 'node:path';
const root=process.env.COMPANION_BRAIN_ROOT;
setPaths({decisionDir:join(root,'stickers','decisions')});
saveDecision('main','cached',{sampled:true,send_status:'not_handed_off',asset_id:'old'});
const a=enqueueLearning('missing','missing',{root});
const b=drainLearning({root});
const c=prepareMedia(root,'cached');
if(!a.disabled||!b.disabled||c.status!=='plugin_disabled') throw Error(JSON.stringify({a,b,c}));
'''
            env=dict(os.environ,COMPANION_BRAIN_ROOT=str(root))
            p=subprocess.run(['node','--input-type=module','-e',script], cwd=deploy.RUNTIME,env=env,capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr)

    def test_vault_disabled_before_network(self):
        from personal_bot import vault
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            onboarding.apply(root, [])
            with self.assertRaisesRegex(ValueError, 'plugin_disabled'):
                vault.publish(root, Path(tmp)/'repo', 'example/private', Path(tmp)/'missing-key', 'a'*40)

    def test_plan_rejects_unknown_and_planned_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            for pid in ('not-a-plugin', 'douyin'):
                with self.assertRaises(ValueError):
                    onboarding.plan(root, [pid])
            self.assertFalse(root.exists())

    def test_core_only_and_repeat_setup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            result = onboarding.apply(root, [])
            self.assertTrue(result['ok'])
            self.assertFalse(result['enabled'])
            self.assertEqual(onboarding.apply(root, [])['status'], 'already_prepared')
            deploy.enable(root, ['events', 'emotion_events'])
            for op in ('meme_search', 'companion_panel', 'companion_photo'):
                r = deploy.request(root, dict(op=op, scope='owner-private', text='fixture'))
                self.assertEqual(r['error'], 'plugin_disabled')
            self.assertTrue(deploy.request(root, dict(op='companion_schema'))['ok'])
            with self.assertRaises(ValueError):
                onboarding.apply(root, ['dashboard'])

    def test_selected_plugin_does_not_enable_itself(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            onboarding.apply(root, ['dashboard', 'bookkeeping'])
            listed = deploy.request(root, dict(op='plugin_manage'))['plugins']
            self.assertEqual({p['id'] for p in listed}, {'dashboard', 'bookkeeping'})
            self.assertTrue(all(not p['enabled'] for p in listed))
            deploy.request(root, dict(op='plugin_manage', action='enable', plugin='dashboard'))
            r = deploy.request(root, dict(op='plugin_call', plugin='dashboard', action='render', scope='owner-private'))
            self.assertTrue(Path(r['path']).is_file())

    def test_legacy_init_not_migrated_implicitly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'state'
            deploy.init(root)
            with self.assertRaises(ValueError):
                onboarding.apply(root, [])
            self.assertTrue(deploy.request(root, dict(op='companion_panel'))['ok'])
