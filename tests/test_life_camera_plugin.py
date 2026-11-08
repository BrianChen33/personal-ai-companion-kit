"""Synthetic plugin acceptance. No image service, network, native sends or persona."""
import base64
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch

from personal_bot import deploy
sys.path.insert(0, str(deploy.RUNTIME))
from brain import Brain
from muse_ext import companion as c, plugins, presentation


PLUGIN = Path(__file__).resolve().parents[1] / 'plugins' / 'life-camera'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')


class LifeCamera(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='camera-isolated-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'state'
        deploy.init(self.root)
        deploy.enable(self.root, list(deploy.DEFAULT_FEATURES))
        self.b = Brain(self.root)
        self.addCleanup(self.b.close)
        self.clock = patch.object(c, 'stamp', return_value=datetime.fromisoformat('2026-11-08T12:00:00+08:00').timestamp())
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)
        self.b.dispatch(dict(op='plugin_manage', action='install', source_dir=str(PLUGIN)))
        self.b.dispatch(dict(op='plugin_manage', action='enable', plugin='life-camera'))
        self.image = Path(self.temp.name) / 'synthetic.png'
        self.image.write_bytes(PNG)
        self.call('asset_put', authorized=True, category='characters', id='fixture',
                  name='Synthetic character', description='A blue illustrated test mascot.', images=[str(self.image)])
        self.call('configure', authorized=True, patch={'character_id': 'fixture'})
        self.call('bind_host', authorized=True, binding=dict(image_tool='synthetic.image',
                  background_runner='synthetic.task', delivery_route='synthetic.owner-main',
                  reference_images=True, separate_delivery=True, receipt='synthetic-capability-readback'))

    def call(self, action, **args):
        return self.b.dispatch(dict(op='plugin_call', plugin='life-camera', scope='owner-private', action=action, **args))

    def life(self, name='Fixture activity', stage='progress'):
        lid = c._life_event(self.b, name, stage, 'A released synthetic stage.')
        with self.b.db:
            self.b.db.execute('UPDATE ct_life SET appraised=1 WHERE id=?', (lid,))
        return lid

    def user(self):
        result = self.b.dispatch(dict(op='prepare', scope='owner-private', source='fixture:camera',
                                     event_id='request-' + str(self.now.return_value), actor='user',
                                     person_id='owner', text='Synthetic explicit image request.'))
        return result['event']['id']

    def plan(self, **args):
        return self.call('plan', life_id=args.pop('life_id', None) or self.life(),
                         camera=args.pop('camera', 'selfie'), prompt='Resting by the window.',
                         expression='quietly amused', caption='A synthetic caption.', shot=args.pop('shot', self.shot()), **args)

    def observed(self, work):
        frame = work['request']
        return dict(image_sha256=hashlib.sha256(PNG).hexdigest(), subject_count=1,
                    capture_device_count=1 if frame['camera'] == 'mirror' else 0,
                    objects={item['id']: item['quantity'] for item in frame.get('shot', {}).get('objects', [])}, issues=[])

    def rendered(self, job):
        work = self.call('work')
        self.assertEqual(work['job']['id'], job['id'])
        token = work['claim']
        self.call('bind', id=job['id'], claim=token, native_task_id='native-fixture')
        ready = self.call('rendered', id=job['id'], claim=token, native_task_id='native-fixture',
                          files=[str(self.image)], receipt='synthetic-tool-receipt', composition_review=self.observed(work))
        return ready

    def test_reference_is_first_real_file_and_context_stays_compact(self):
        job = self.plan()['job']
        work = self.call('work')
        self.assertEqual(work['request']['references'][0]['role'], 'identity_style')
        self.assertTrue(Path(work['request']['references'][0]['path']).is_file())
        self.assertIn('three-view', work['request']['prompt'])
        ctx = presentation.camera(self.b, 'owner-private')
        self.assertEqual(ctx['plugin'], 'life-camera')
        self.assertNotIn('base64', json.dumps(ctx))
        self.assertLess(len(json.dumps(ctx)), 6000)
        self.assertEqual(self.call('work')['status'], 'busy')
        self.assertEqual(job['status'], 'queued')

    def test_each_camera_has_one_subject_and_final_geometry_priority(self):
        geometries = {
            'selfie': 'Exactly one visible face and one coherent body',
            'rear': 'Keep the holder\'s face, head and torso outside the image',
            'mirror': 'Show the character only once, inside the mirror',
        }
        for camera, expected in geometries.items():
            with self.subTest(camera=camera):
                self.call('plan', life_id=self.life(), camera=camera,
                          prompt='Synthetic mixed-view scene.', pose='Synthetic pose request.', shot=self.shot())
                request = self.call('work')['request']
                with self.b.db:
                    self.b.db.execute("UPDATE lc_job SET status='failed' WHERE status='claimed'")
                prompt = request['prompt']
                self.assertIn('All views on the character sheet depict the same single individual', prompt)
                self.assertIn(expected, prompt)
                self.assertGreater(prompt.index('Physical capture setup'), prompt.index('Scene:'))
                self.assertNotIn('Synthetic pose request.', prompt)
                self.assertEqual(request['count'], 1)

    def shot(self):
        return dict(support='left_hand', viewpoint='Above the meal, tilted gently downward',
                    framing='Rice bowl and utensil over a small table', hands={'right': 'lifting one bite'},
                    objects=[dict(id='chopsticks', label='wooden chopsticks', quantity=1, unit='pair', location='right_hand'),
                             dict(id='rice', label='rice', quantity=1, unit='bowl', location='surface')])

    def test_shot_owns_actions_inventory_and_survives_prompt_compaction(self):
        job = self.plan(camera='rear', shot=self.shot(), pose='Conflicting legacy pose')['job']
        work = self.call('work')
        self.assertEqual(work['request']['shot'], self.shot())
        self.assertIn('1 pair of wooden chopsticks', work['request']['prompt'])
        self.assertIn('left hand supports the capture device behind its lens', work['request']['prompt'])
        self.assertNotIn('Conflicting legacy pose', work['request']['prompt'])
        self.call('bind', id=job['id'], claim=work['claim'], native_task_id='native-shot-fixture')
        review = dict(image_sha256=hashlib.sha256(PNG).hexdigest(), subject_count=1,
                      capture_device_count=0, objects={'chopsticks': 1, 'rice': 1}, issues=[])
        self.call('rendered', id=job['id'], claim=work['claim'], native_task_id='native-shot-fixture',
                  files=[str(self.image)], receipt='shot-fixture-receipt', composition_review=review)
        row = self.b.db.execute('SELECT plan,generation FROM lc_job WHERE id=?', (job['id'],)).fetchone()
        self.assertEqual(json.loads(row['plan'])['shot'], self.shot())
        self.assertEqual(json.loads(row['generation'])['composition_review'], review)
        self.assertNotIn('prompt', json.loads(row['plan']))

    def test_shot_rejects_busy_camera_hand_and_duplicate_object_identity(self):
        busy = self.shot()
        busy['hands']['left'] = 'holding an extra tool'
        duplicate = self.shot()
        duplicate['objects'].append(dict(duplicate['objects'][0], location='surface'))
        for invalid in (busy, duplicate):
            with self.subTest(shot=invalid), self.assertRaisesRegex(ValueError, 'shot'):
                self.plan(camera='rear', shot=invalid)

    def test_new_shot_required_but_old_frozen_job_and_retry_still_work(self):
        lid = self.life()
        with self.assertRaisesRegex(ValueError, 'shot'):
            self.call('plan', life_id=lid, camera='rear', prompt='Unplanned fixture')
        job = self.plan(life_id=lid, camera='rear')['job']
        row = self.b.db.execute('SELECT plan FROM lc_job WHERE id=?', (job['id'],)).fetchone()
        frozen = json.loads(row['plan'])
        frozen.pop('shot')
        with self.b.db:
            self.b.db.execute('UPDATE lc_job SET plan=? WHERE id=?', (json.dumps(frozen), job['id']))
        self.assertTrue(self.call('plan', life_id=lid, camera='rear')['replayed'])
        self.rendered(job)
        self.assertEqual(self.call('send_work')['job']['id'], job['id'])

    def test_observed_extra_utensil_or_visible_capture_device_cannot_become_ready(self):
        job = self.plan(camera='rear', shot=self.shot())['job']
        work = self.call('work')
        self.call('bind', id=job['id'], claim=work['claim'], native_task_id='native-review-fixture')
        valid = dict(image_sha256=hashlib.sha256(PNG).hexdigest(), subject_count=1,
                     capture_device_count=0, objects={'chopsticks': 1, 'rice': 1}, issues=[])
        extra_utensil = copy.deepcopy(valid)
        extra_utensil['objects']['chopsticks'] = 2
        for invalid in (None, extra_utensil, dict(valid, capture_device_count=1), dict(valid, image_sha256='0'*64)):
            with self.subTest(review=invalid), self.assertRaisesRegex(ValueError, 'composition_review'):
                self.call('rendered', id=job['id'], claim=work['claim'], native_task_id='native-review-fixture',
                          files=[str(self.image)], receipt='review-fixture-receipt', composition_review=invalid)
        self.assertEqual(self.b.db.execute('SELECT status FROM lc_job WHERE id=?', (job['id'],)).fetchone()[0], 'generating')
        self.assertFalse((self.root/'assets/life-camera/photos').exists())

    def test_camera_freezes_shared_scene_and_announces_later_delivery(self):
        from muse_ext import life_schedule as schedule
        self.b.dispatch(dict(op='companion_day', action='configure', authorized=True, enabled=True))
        lid = self.life('学习', 'started')
        self.b.dispatch(dict(op='companion_day', action='scene', expected_version=0,
                             life_id=lid, fields={'location': '窗边', 'clothing': '蓝色上衣'}))
        job = self.plan(life_id=lid)['job']
        self.now.return_value += 60
        next_life = self.life('跑步', 'started')
        schedule.sync(self.b, [next_life])
        work = self.call('work')
        self.assertEqual(work['request']['scene_snapshot']['fields']['location'], '窗边')
        self.assertIn('蓝色上衣', work['request']['prompt'])
        self.assertNotIn('跑步', work['request']['prompt'])
        self.call('bind', id=job['id'], claim=work['claim'], native_task_id='native-scene-fixture')
        self.call('rendered', id=job['id'], claim=work['claim'], native_task_id='native-scene-fixture',
                  files=[str(self.image)], receipt='scene-image-receipt', composition_review=self.observed(work))
        send = self.call('send_work')
        self.assertTrue(send['scene_changed'])
        self.assertIn('earlier', send['caption_policy'])
        self.assertEqual(send['scene_snapshot']['fields']['location'], '窗边')

    def test_legacy_jobs_without_scene_still_generate_and_send(self):
        job = self.plan()['job']
        self.rendered(job)
        send = self.call('send_work')
        self.assertFalse(send.get('scene_changed', False))
        self.assertEqual(send['job']['id'], job['id'])

    def test_older_source_cannot_borrow_current_scene(self):
        self.b.dispatch(dict(op='companion_day', action='configure', authorized=True, enabled=True))
        old = self.life('学习', 'started')
        self.now.return_value += 60
        current = self.life('跑步', 'started')
        self.b.dispatch(dict(op='companion_day', action='scene', expected_version=0,
                             life_id=current, fields={'location': '公园'}))
        self.plan(life_id=old)
        work = self.call('work')
        self.assertNotIn('公园', work['request']['prompt'])
        self.assertEqual(work['request']['scene_snapshot']['fields'], {})

    def test_manual_frozen_scene_retirement_blocks_generation(self):
        self.b.dispatch(dict(op='companion_day', action='configure', authorized=True, enabled=True))
        lid = self.life('学习', 'started')
        self.b.dispatch(dict(op='companion_day', action='scene', expected_version=0,
                             life_id=lid, fields={'location': '窗边'}))
        self.call('plan', source_event=self.user(), camera='selfie', prompt='A synthetic request.', shot=self.shot())
        with self.b.db:
            self.b.db.execute("UPDATE source_events SET status='retired' WHERE id=(SELECT source_event FROM ct_life WHERE id=?)", (lid,))
        self.assertIsNone(self.call('work')['job'])

    def test_one_job_per_source_and_one_sender(self):
        lid = self.life()
        first = self.plan(life_id=lid)
        self.assertTrue(self.plan(life_id=lid)['replayed'])
        self.rendered(first['job'])
        send = self.call('send_work')
        self.assertEqual(send['job']['id'], first['job']['id'])
        self.assertIsNone(self.call('send_work')['job'])
        with self.assertRaisesRegex(ValueError, 'receipt'):
            self.call('settle', id=first['job']['id'], claim=send['claim'], outcome='accepted')
        done = self.call('settle', id=first['job']['id'], claim=send['claim'],
                         outcome='accepted', receipt='actual-fixture-send')
        self.assertEqual(done['job']['status'], 'accepted')
        self.assertTrue(self.call('settle', id=first['job']['id'], claim=send['claim'],
                                  outcome='accepted', receipt='actual-fixture-send')['replayed'])

    def test_invalid_or_unassessed_life_source_cannot_plan(self):
        with self.assertRaises(ValueError):
            self.plan(life_id='unreleased-future-stage')
        lid = c._life_event(self.b, 'Fixture', 'started', 'Not appraised.')
        with self.assertRaisesRegex(ValueError, 'appraised'):
            self.plan(life_id=lid)

    def test_native_final_receipt_survives_restart_without_resending(self):
        job = self.plan()['job']
        self.rendered(job)
        send = self.call('send_work')
        self.call('settle', id=job['id'], claim=send['claim'], outcome='unknown',
                  receipt='native-final handoff: synthetic-run to synthetic-main')
        self.b.close()
        self.b = Brain(self.root)
        self.addCleanup(self.b.close)
        self.now.return_value += 3 * 3600
        before = tuple(self.b.db.execute('SELECT * FROM lc_job WHERE id=?', (job['id'],)).fetchone())
        pending = self.call('receipt_work')['items']
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]['job']['id'], job['id'])
        self.assertEqual(pending[0]['claim'], send['claim'])
        self.assertEqual(pending[0]['native_task_id'], 'native-fixture')
        self.assertEqual(pending[0]['images'], send['images'])
        self.assertEqual(pending[0]['handoff_receipt'],
                         'native-final handoff: synthetic-run to synthetic-main')
        self.assertEqual(tuple(self.b.db.execute('SELECT * FROM lc_job WHERE id=?',
                                                (job['id'],)).fetchone()), before)
        self.assertNotIn(send['claim'], json.dumps(presentation.camera(self.b, 'owner-private')))
        with self.assertRaises(ValueError):
            self.b.dispatch(dict(op='plugin_call', plugin='life-camera',
                                 scope='group:fixture', action='receipt_work'))
        self.call('settle', id=job['id'], claim=pending[0]['claim'],
                  outcome='accepted', receipt='synthetic-main:actual-assistant-turn:photo')
        self.assertEqual(self.call('receipt_work')['items'], [])
        self.assertIsNone(self.call('send_work')['job'])

    def test_receipt_work_paginates_without_losing_pending_jobs(self):
        expected = set()
        for _ in range(3):
            self.now.return_value += 1
            job = self.plan(source_event=self.user())['job']
            expected.add(job['id'])
            self.rendered(job)
            send = self.call('send_work')
            self.call('settle', id=job['id'], claim=send['claim'], outcome='unknown',
                      receipt='synthetic final handoff')
        page = self.call('receipt_work', limit=2)
        self.assertEqual(len(page['items']), 2)
        following = self.call('receipt_work', limit=2, cursor=page['next_cursor'])
        self.assertEqual(len(following['items']), 1)
        self.assertIsNone(following['next_cursor'])
        actual = [item['job']['id'] for item in page['items'] + following['items']]
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(expected))
        with self.assertRaises(ValueError):
            self.call('receipt_work', limit=21)

    def test_quiet_auto_waits_but_explicit_owner_request_can_run(self):
        self.now.return_value = datetime.fromisoformat('2026-11-09T02:00:00+08:00').timestamp()
        job = self.plan()['job']
        self.assertEqual(self.call('work')['status'], 'quiet')
        manual = self.plan(source_event=self.user())['job']
        self.assertEqual(self.call('work')['job']['id'], manual['id'])
        self.assertNotEqual(job['id'], manual['id'])

    def test_reference_change_and_tampering_are_detected(self):
        job = self.plan()['job']
        self.call('asset_put', authorized=True, category='characters', id='fixture', name='Changed',
                  description='Changed identity description.', images=[str(self.image)])
        self.assertEqual(self.call('work')['status'], 'empty')
        self.assertEqual(self.call('status')['recent'][0]['status'], 'stale')
        self.assertEqual(job['status'], 'queued')
        path = self.call('assets', category='characters')['items'][0]['images'][0]['path']
        Path(path).write_bytes(b'not an image')
        with self.assertRaisesRegex(ValueError, 'reference'):
            self.plan(life_id=self.life('Another activity'))

    def test_abandoned_work_reconciles_without_blocking_other_jobs(self):
        first = self.plan()['job']
        work = self.call('work')
        self.now.return_value += 901
        self.call('reconcile')
        self.assertEqual(self.call('status')['recent'][0]['status'], 'generation_unknown')
        other = self.plan(life_id=self.life('Other activity'))['job']
        self.assertEqual(self.call('work')['job']['id'], other['id'])
        self.assertEqual(self.plan(life_id=self.b.db.execute('SELECT life_id FROM lc_job WHERE id=?', (first['id'],)).fetchone()[0])['job']['id'], first['id'])
        self.assertTrue(work['claim'])

    def test_cooldown_explicit_request_and_disabled_legacy_path(self):
        job = self.plan()['job']
        self.rendered(job)
        send = self.call('send_work')
        self.call('settle', id=job['id'], claim=send['claim'], outcome='accepted', receipt='sent')
        self.assertEqual(self.plan(life_id=self.life('Next'))['status'], 'cooldown')
        self.assertTrue(self.plan(source_event=self.user())['ok'])
        (self.root / 'presentation-profile.json').write_text('{"life_photos":true}', encoding='utf-8')
        self.b.dispatch(dict(op='plugin_manage', action='disable', plugin='life-camera'))
        self.assertFalse(presentation.camera(self.b, 'owner-private')['enabled'])
        self.assertFalse(presentation.camera(self.b, 'qq:group:fixture')['enabled'])

    def test_output_and_send_receipts_survive_reopen(self):
        job = self.plan()['job']
        self.rendered(job)
        self.b.close()
        self.b = Brain(self.root)
        self.addCleanup(self.b.close)
        send = self.call('send_work')
        self.call('settle', id=job['id'], claim=send['claim'], outcome='unknown', receipt='timeout-fixture')
        self.assertIsNone(self.call('send_work')['job'])
        self.assertEqual(self.call('status')['recent'][0]['status'], 'unknown')
        self.call('settle', id=job['id'], claim=send['claim'], outcome='accepted', receipt='late-actual-receipt')
        self.assertIsNone(self.call('send_work')['job'])
        self.assertEqual(self.call('status')['recent'][0]['status'], 'accepted')
        self.assertNotIn('prompt', json.loads(self.b.db.execute('SELECT plan FROM lc_job WHERE id=?', (job['id'],)).fetchone()[0]))

    def test_configuration_and_owner_scope_are_validated(self):
        for value in (True, float('nan'), -1, 241):
            with self.assertRaises(ValueError):
                self.call('configure', authorized=True, patch={'cooldown_minutes': value})
        with self.assertRaises(ValueError):
            self.call('configure', patch={'automatic': False})
        with self.assertRaises(ValueError):
            self.b.dispatch(dict(op='plugin_call', plugin='life-camera', scope='qq:group:fixture', action='status'))
        with self.assertRaisesRegex(ValueError, 'owner_private'):
            self.b.dispatch(dict(op='companion_photo', scope='qq:group:fixture', action='settle',
                                 source_event=1, outcome='accepted', receipt='untrusted-fixture'))

    def test_reference_quota_preserves_identity_and_rear_camera(self):
        self.call('configure', authorized=True, patch={'max_references': 2})
        for category, identity in [('outfits', 'clothes'), ('scenes', 'room'), ('props', 'cup')]:
            self.call('asset_put', authorized=True, category=category, id=identity, name=identity,
                      description='Synthetic ' + category, images=[str(self.image)])
        result = self.call('plan', life_id=self.life(), camera='rear', prompt='A cup on a table.',
                           outfit='clothes', scene='room', props=['cup'], shot=self.shot())
        work = self.call('work')
        self.assertEqual(work['job']['id'], result['job']['id'])
        self.assertEqual(len(work['request']['references']), 2)
        self.assertEqual(work['request']['references'][0]['role'], 'identity_style')
        self.assertIn('stays behind the camera', work['request']['prompt'])

    def test_photo_promise_uses_matching_completion_and_same_receipt(self):
        event = self.user()
        start = c._life_event(self.b, 'Fixture baking', 'started', 'Started now.')
        self.b.dispatch(dict(op='companion_photo', scope='owner-private', action='request',
                             source_event=event, activity_id=start, camera='rear', when='completed'))
        with self.assertRaisesRegex(ValueError, 'stage_not_ready'):
            self.plan(source_event=event, camera='rear')
        self.now.return_value += 60
        finish = c._life_event(self.b, 'Fixture baking', 'completed', 'Completed now.')
        with self.assertRaisesRegex(ValueError, 'camera_conflict'):
            self.plan(source_event=event, camera='selfie')
        job = self.plan(source_event=event, camera='rear')['job']
        self.assertEqual(job['life_id'], finish)
        self.rendered(job)
        send = self.call('send_work')
        with self.assertRaisesRegex(ValueError, 'receipt'):
            self.b.dispatch(dict(op='companion_photo', scope='owner-private', action='settle',
                                 source_event=event, outcome='accepted'))
        self.call('settle', id=job['id'], claim=send['claim'], outcome='unknown', receipt='promise-timeout')
        self.call('settle', id=job['id'], claim=send['claim'], outcome='accepted', receipt='promise-sent')
        self.assertEqual(presentation.camera(self.b, 'owner-private')['photo_requests'], [])
        self.assertEqual(c._get(self.b, 'life_photo_requests', [])[0]['status'], 'accepted')
        self.assertTrue(self.plan(source_event=event, camera='rear')['replayed'])

    def test_private_snapshot_contains_original_art_without_album(self):
        from personal_bot import vault
        self.rendered(self.plan()['job'])
        destination = Path(self.temp.name) / 'private-snapshot'
        manifest = vault.export_snapshot(self.root, destination, 'a' * 40, bootstrap=True)
        names = [item['path'] for item in manifest['files']]
        self.assertTrue(any(name.startswith('assets/life-camera/references/') for name in names))
        self.assertFalse(any('/photos/' in name for name in names))
        self.assertEqual(len(presentation.camera_backup_sources(self.b)), 1)

    def test_concurrent_planning_and_work_have_single_winners(self):
        from concurrent.futures import ThreadPoolExecutor
        lid = self.life()
        def worker(action):
            brain = Brain(self.root)
            try:
                args = dict(op='plugin_call', plugin='life-camera', scope='owner-private', action=action)
                if action == 'plan':
                    args.update(life_id=lid, camera='selfie', prompt='A concurrent synthetic scene.', shot=self.shot())
                return brain.dispatch(args)
            finally:
                brain.close()
        with ThreadPoolExecutor(max_workers=2) as executor:
            plans = list(executor.map(worker, ['plan', 'plan']))
        self.assertEqual(plans[0]['job']['id'], plans[1]['job']['id'])
        with ThreadPoolExecutor(max_workers=2) as executor:
            claims = list(executor.map(worker, ['work', 'work']))
        self.assertEqual(sorted(result['status'] for result in claims), ['busy', 'claimed'])

    def test_disabled_auto_and_inflight_reference_change_gate_delivery(self):
        job = self.plan()['job']
        self.rendered(job)
        self.call('configure', authorized=True, patch={'automatic': False})
        self.assertIsNone(self.call('send_work')['job'])
        self.assertEqual(self.call('status')['recent'][0]['status'], 'stale')

    def test_restored_jobs_cannot_send_before_real_host_rebinding(self):
        self.rendered(self.plan()['job'])
        with self.b.db:
            c._set(self.b, 'life_camera_host', {'host_identity': 'another-host'})
        self.assertEqual(self.call('status')['status'], 'awaiting_host_binding')
        self.assertEqual(self.call('send_work')['status'], 'awaiting_host_binding')
        self.assertEqual(self.b.db.execute('SELECT status FROM lc_job').fetchone()[0], 'ready')

    def test_historical_life_does_not_become_fresh_automatic_photo(self):
        lid = c._life_event(self.b, 'Yesterday', 'completed', 'An old released scene.',
                            occurred=self.now.return_value - 86400)
        with self.b.db:
            self.b.db.execute('UPDATE ct_life SET appraised=1 WHERE id=?', (lid,))
        self.assertEqual(self.plan(life_id=lid)['status'], 'scene_expired')
        self.assertTrue(self.plan(life_id=lid, source_event=self.user())['job']['manual'])


