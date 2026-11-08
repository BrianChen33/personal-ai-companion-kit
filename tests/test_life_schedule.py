"""Bounded local daily intentions and released scenes, using synthetic data only."""
import copy
import json
from datetime import datetime
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from personal_bot import deploy
sys.path.insert(0, str(deploy.RUNTIME))
from brain import Brain
from muse_ext import companion as c


class DailyScene(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='daily-scene-isolated-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / 'state'
        deploy.init(self.root)
        deploy.enable(self.root, list(deploy.DEFAULT_FEATURES))
        self.b = Brain(self.root)
        self.addCleanup(self.b.close)
        self.clock = patch.object(c, 'stamp', return_value=datetime.fromisoformat('2026-11-08T08:00:00+08:00').timestamp())
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)

    def call(self, action, **values):
        return self.b.dispatch(dict(op='companion_day', scope='owner-private', action=action, **values))

    def enable(self):
        self.call('configure', authorized=True, enabled=True)

    def outline(self):
        return dict(day='2026-11-08', subject='companion', day_kind='leisure', anchors=[
            dict(at=self.now.return_value + n * 3600, activity=name, intention='PLAN-ONLY ' + name)
            for n, name in enumerate(['做饭吃饭', '学习', '刷手机', '跑步'], 1)])

    def scene(self, expected_version=0, **fields):
        lid = c._life_event(self.b, '学习', 'started', 'A released synthetic learning event.')
        return self.call('scene', expected_version=expected_version, life_id=lid,
                         fields=dict(location='书桌', clothing='蓝色上衣', props='一本书', light='晨光', **fields))

    def test_legacy_disabled_and_scope_gates(self):
        self.assertFalse(self.call('status')['enabled'])
        self.assertNotIn('day_scene', c.context(self.b, 'owner-private'))
        with self.assertRaisesRegex(ValueError, 'authorized'):
            self.call('configure', enabled=True)
        with self.assertRaisesRegex(ValueError, 'owner_scope'):
            self.b.dispatch(dict(op='companion_day', scope='qq:group:fixture', action='status'))

    def test_plan_cas_replay_and_intentions_are_not_experiences(self):
        self.enable()
        original = self.outline()
        first = self.call('plan', expected_version=0, plan=original)
        self.assertEqual(first['plan']['version'], 1)
        self.assertTrue(self.call('plan', expected_version=0, plan=original)['replayed'])
        self.assertTrue(self.call('pending')['needed'] is False)
        changed = copy.deepcopy(original)
        changed['anchors'][-1]['intention'] = 'Different future intention'
        with self.assertRaisesRegex(ValueError, 'version'):
            self.call('plan', expected_version=0, plan=changed)
        self.call('plan', expected_version=1, plan=changed)
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM ct_life').fetchone()[0], 0)
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM source_events').fetchone()[0], 0)

    def test_past_intentions_cannot_be_rewritten(self):
        self.enable()
        original = self.outline()
        self.call('plan', expected_version=0, plan=original)
        self.now.return_value += 3700
        original['anchors'][0]['intention'] = 'Rewritten past'
        with self.assertRaisesRegex(ValueError, 'past'):
            self.call('plan', expected_version=1, plan=original)

    def test_plan_subject_and_day_kind_are_explicit(self):
        self.enable()
        for subject in ('owner', None):
            outline = self.outline()
            outline['subject'] = subject
            with self.assertRaisesRegex(ValueError, 'subject'):
                self.call('plan', expected_version=0, plan=outline)
        outline = self.outline()
        first = self.call('plan', expected_version=0, plan=outline)
        outline['day_kind'] = 'overtime'
        changed = self.call('plan', expected_version=1, plan=outline)
        self.assertEqual(changed['plan']['version'], first['plan']['version'] + 1)
        self.assertEqual(c.context(self.b, 'owner-private')['day_scene']['day_kind'], 'overtime')

    def test_legacy_plan_requests_same_pass_ownership_review(self):
        self.enable()
        old = dict(day='2026-11-08', version=1, anchors=self.outline()['anchors'])
        with self.b.db:
            c._set(self.b, 'day_plan:2026-11-08', old)
        pending = self.call('pending')
        self.assertTrue(pending['needed'])
        self.assertTrue(pending['ownership_review_required'])
        self.assertEqual(pending['expected_version'], 1)
        self.assertNotIn('next_intention', c.context(self.b, 'owner-private')['day_scene'])
        self.now.return_value += 3601
        from muse_ext.life_schedule import preference
        self.assertIsNone(preference(self.b))

    def test_authorized_repair_removes_bad_past_intention_without_rewriting_life(self):
        self.enable()
        old = self.outline()
        self.call('plan', expected_version=0, plan=old)
        self.now.return_value += 3700
        repaired = copy.deepcopy(old)
        repaired['anchors'] = repaired['anchors'][1:]
        result = self.call('repair', authorized=True, expected_version=1, plan=repaired, reason='Synthetic subject correction')
        self.assertEqual(result['plan']['correction']['removed_past_times'], [old['anchors'][0]['at']])
        self.assertTrue(self.call('repair', authorized=True, expected_version=1, plan=repaired,
                                  reason='Synthetic subject correction')['replayed'])
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM ct_life').fetchone()[0], 0)
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM source_events').fetchone()[0], 0)

    def test_repair_requires_authority_and_cannot_invent_a_different_past(self):
        self.enable()
        old = self.outline()
        self.call('plan', expected_version=0, plan=old)
        self.now.return_value += 3700
        old['anchors'][0]['intention'] = 'Invented replacement past'
        with self.assertRaisesRegex(ValueError, 'authorized'):
            self.call('repair', expected_version=1, plan=old, reason='Synthetic correction')
        with self.assertRaisesRegex(ValueError, 'past'):
            self.call('repair', authorized=True, expected_version=1, plan=old, reason='Synthetic correction')

    def test_bounded_foreground_never_includes_full_plan(self):
        self.enable()
        original = self.outline()
        original['anchors'][0]['intention'] = '"' * 140
        self.call('plan', expected_version=0, plan=original)
        self.scene()
        value = c.context(self.b, 'owner-private')['day_scene']
        self.assertLessEqual(len(json.dumps(value, ensure_ascii=False)), 900)
        self.assertNotIn('PLAN-ONLY 跑步', json.dumps(value, ensure_ascii=False))
        self.assertNotIn('day_scene', c.context(self.b, 'qq:group:fixture'))
        lid = self.call('status')['scene']['life_id']
        self.call('scene', expected_version=1, life_id=lid,
                  fields={key: '"' * 100 for key in ('location', 'clothing', 'props', 'light', 'appearance')})
        value = c.context(self.b, 'owner-private')['day_scene']
        self.assertLessEqual(len(json.dumps(value, ensure_ascii=False)), 900)

    def test_scene_cas_future_and_retired_sources(self):
        self.enable()
        self.scene()
        with self.assertRaisesRegex(ValueError, 'version'):
            self.scene()
        lid = c._life_event(self.b, '学习', 'progress', 'Future synthetic stage.', occurred=self.now.return_value + 300)
        with self.assertRaisesRegex(ValueError, 'released'):
            self.call('scene', expected_version=1, life_id=lid, fields={'location': '未来'})
        with self.b.db:
            self.b.db.execute("UPDATE source_events SET status='retired'")
        with self.assertRaisesRegex(ValueError, 'released'):
            self.call('scene', expected_version=1, life_id=lid, fields={})

    def test_scene_progress_carries_clothes_but_new_activity_clears_setting(self):
        from muse_ext import life_schedule as schedule
        self.enable()
        self.scene()
        self.now.return_value += 60
        lid = c._life_event(self.b, '跑步', 'started', 'A released run.')
        schedule.sync(self.b, [lid])
        value = self.call('status')['scene']
        self.assertEqual(value['activity'], '跑步')
        self.assertEqual(value['fields']['clothing'], '蓝色上衣')
        self.assertNotIn('location', value['fields'])
        self.assertEqual(value['version'], 2)
        schedule.sync(self.b, [lid])
        self.assertEqual(self.call('status')['scene']['version'], 2)

    def test_schema_validation_and_seven_day_retention(self):
        self.enable()
        broken = self.outline()
        broken['anchors'][0]['mood'] = 'happy'
        with self.assertRaisesRegex(ValueError, 'anchor'):
            self.call('plan', expected_version=0, plan=broken)
        for day in range(9):
            outline = self.outline()
            outline['day'] = datetime.fromtimestamp(self.now.return_value, c.TZ).date().isoformat()
            self.call('plan', expected_version=0, plan=outline)
            self.now.return_value += 86400
        self.assertLessEqual(self.b.db.execute("SELECT count(*) FROM ct_kv WHERE key LIKE 'day_plan:%'").fetchone()[0], 7)

    def test_preferences_do_not_change_phone_probability(self):
        from muse_ext import life_schedule as schedule, life_routine
        self.enable()
        self.call('plan', expected_version=0, plan=self.outline())
        self.now.return_value += 3601
        self.assertGreater(schedule.preference(self.b, '做饭吃饭'), schedule.preference(self.b, '跑步'))
        self.assertEqual(life_routine.settings(self.b)['phone_probability'], .6)

    def meal(self):
        outline = self.outline()
        outline['anchors'] = [dict(at=self.now.return_value + 60, activity='做饭吃饭', intention='Synthetic lunch project')]
        self.call('plan', expected_version=0, plan=outline)
        c._set(self.b, 'dream_day', outline['day'])
        c._set(self.b, 'life', dict(activity=None, next_at=self.now.return_value + 7200))
        self.b.db.commit()
        self.now.return_value += 60
        return outline

    def test_due_plan_starts_before_free_phone_draw_and_idle_gap(self):
        self.enable()
        self.meal()
        with patch.object(c.RNG, 'random', return_value=0):
            self.b.dispatch(dict(op='companion_tick'))
        current = c._get(self.b, 'life')['activity']
        self.assertEqual(current['name'], '做饭吃饭')
        self.assertIn('Synthetic lunch project', self.b.dispatch(dict(op='companion_activity', action='pending'))['intention'])
        run = self.call('status')['execution'][0]
        self.assertEqual(run['life_id'], current['project_id'])
        self.assertEqual(run['status'], 'awaiting_plan')

    def test_scheduled_project_recovers_existing_identity_after_state_loss(self):
        self.enable()
        self.meal()
        self.b.dispatch(dict(op='companion_tick'))
        first = c._get(self.b, 'life')['activity']
        count = self.b.db.execute('SELECT count(*) FROM source_events').fetchone()[0]
        c._set(self.b, 'life', dict(activity=None, next_at=self.now.return_value + 7200))
        self.b.db.commit()
        self.now.return_value += 60
        self.b.dispatch(dict(op='companion_tick'))
        again = c._get(self.b, 'life')['activity']
        self.assertEqual(again['project_id'], first['project_id'])
        self.assertEqual(again['started_at'], first['started_at'])
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM source_events').fetchone()[0], count)

    def test_missed_plan_does_not_fabricate_a_past_activity(self):
        self.enable()
        self.meal()
        self.now.return_value += 7201
        self.assertEqual(self.call('status')['execution'][0]['status'], 'missed')
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM ct_life').fetchone()[0], 0)

    def test_scheduled_project_recovers_partial_registration(self):
        from muse_ext import life_projects
        self.enable()
        self.meal()
        started = self.now.return_value
        with patch.object(life_projects.c, '_life_event', side_effect=RuntimeError('interrupted source write')):
            with self.assertRaisesRegex(RuntimeError, 'interrupted'):
                self.b.dispatch(dict(op='companion_tick'))
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM ct_life').fetchone()[0], 0)
        self.now.return_value += 6000
        self.assertEqual(self.call('status')['execution'][0]['status'], 'awaiting_plan')
        self.b.dispatch(dict(op='companion_tick'))
        current = c._get(self.b, 'life')['activity']
        self.assertEqual(current['started_at'], started)
        self.assertEqual(self.b.db.execute('SELECT count(*) FROM ct_activity_project').fetchone()[0], 1)

    def test_due_plan_waits_for_existing_activity_to_finish(self):
        from muse_ext import life_projects
        self.enable()
        self.meal()
        current = dict(name='阅读', started_at=self.now.return_value-10, ends_at=self.now.return_value+600,
                       origin='virtual', cost=(1,-5,3,2))
        life_projects.register(self.b, current)
        c._set(self.b, 'life', dict(activity=current, next_at=0))
        self.b.db.commit()
        self.b.dispatch(dict(op='companion_tick'))
        self.assertEqual(c._get(self.b, 'life')['activity']['name'], '阅读')
        self.assertEqual(self.call('status')['execution'][0]['status'], 'waiting')

    def test_full_day_can_have_twelve_connected_slots(self):
        self.enable()
        outline = self.outline()
        outline['anchors'] = [dict(at=self.now.return_value + 900 + n * 3600,
                                   activity='刷手机' if n % 2 else '学习', intention='Synthetic slot ' + str(n)) for n in range(12)]
        self.call('plan', expected_version=0, plan=outline)
        self.assertEqual(len(self.call('status')['execution']), 12)

    def test_scheduled_phone_has_stable_start_and_honest_completion(self):
        self.enable()
        outline = self.outline()
        outline['anchors'] = [dict(at=self.now.return_value + 60, activity='刷手机', intention='Read approved sources')]
        self.call('plan', expected_version=0, plan=outline)
        c._set(self.b, 'dream_day', outline['day'])
        c._set(self.b, 'life', dict(activity=None, next_at=self.now.return_value + 7200))
        self.b.db.commit()
        self.now.return_value += 60
        self.b.dispatch(dict(op='companion_tick'))
        current = c._get(self.b, 'life')['activity']
        self.assertEqual(current['name'], '刷手机')
        self.assertEqual(self.call('status')['execution'][0]['life_id'], current['phone_intent'])
        self.now.return_value = current['ends_at'] + 1
        self.b.dispatch(dict(op='companion_tick'))
        self.assertEqual(self.call('status')['execution'][0]['status'], 'completed')
        event = self.b.db.execute("SELECT description FROM ct_life WHERE id=?", ('phone:' + current['phone_intent'] + ':completed',)).fetchone()
        self.assertIn('没有成功读取', event[0])

    def test_retired_scene_details_do_not_reappear_on_next_activity(self):
        from muse_ext import life_schedule as schedule
        self.enable()
        old = self.scene()['scene']
        with self.b.db:
            self.b.db.execute("UPDATE source_events SET status='retired' WHERE id=?", (old['source_event'],))
        self.now.return_value += 60
        lid = c._life_event(self.b, '跑步', 'started', 'A new released source.')
        schedule.sync(self.b, [lid])
        self.assertEqual(self.call('status')['scene']['fields'], {})

    def test_background_scene_reads_and_write_are_one_transaction(self):
        from muse_ext import life_schedule as schedule
        self.enable()
        self.scene()
        self.now.return_value += 60
        lid = c._life_event(self.b, '跑步', 'started', 'A concurrent source.')
        original_get = c._get
        reads = []
        def observed_get(brain, key, default=None):
            if key == 'day_scene':
                reads.append(brain.db.in_transaction)
            return original_get(brain, key, default)
        with patch.object(c, '_get', side_effect=observed_get):
            schedule.sync(self.b, [lid])
        self.assertTrue(reads)
        self.assertTrue(all(reads), 'Scene version and carry-forward fields must be read under the write lock')


if __name__ == '__main__':
    unittest.main()
