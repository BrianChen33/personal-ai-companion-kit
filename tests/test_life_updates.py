"""Once-only lifecycle sharing with real local source ledgers, no outbound sends."""
import unittest
from unittest.mock import patch
import test_life_schedule as fixtures
from muse_ext import companion as c, life_projects


class LifeUpdates(unittest.TestCase):
    setUp = fixtures.DailyScene.setUp
    call = fixtures.DailyScene.call
    enable = fixtures.DailyScene.enable
    outline = fixtures.DailyScene.outline
    meal = fixtures.DailyScene.meal

    def unchanged(self):
        return dict(version=2, changed=False, label=None, delta=dict(p=0, a=0, d=0), intensity_delta=0, share=False)

    def assess(self, lid):
        return self.b.dispatch(dict(op='companion_life_assess', id=lid, assessment=self.unchanged()))

    def test_announced_project_gets_result_even_with_neutral_emotion(self):
        self.enable()
        self.meal()
        self.b.dispatch(dict(op='companion_tick'))
        current = c._get(self.b, 'life')['activity']
        pid = current['project_id']
        self.assess(pid)
        opening = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.assertEqual([e['id'] for e in opening['events']], [pid])
        self.b.dispatch(dict(op='companion_share', action='settle', lease=opening['lease'], outcome='unknown'))
        self.b.dispatch(dict(op='companion_activity', action='plan', project_id=pid, expected_version=0,
                             plan=dict(version=1, origin='virtual', activity='做饭吃饭', topic='Synthetic lunch',
                                       stages=[dict(after_seconds=60, description='Synthetic cooking progress'),
                                               dict(after_seconds=120, description='Synthetic lunch result')],
                                       artifact=dict(title='Synthetic note', text='Synthetic full recipe.'))))
        self.now.return_value += 121
        events = life_projects.advance(self.b, self.now.return_value)['created']
        for lid in events:
            self.assess(lid)
        result = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.assertEqual([e['stage'] for e in result['events']], ['completed'])
        self.assertEqual(result['events'][0]['continuity']['project_id'], pid)
        self.assertEqual(result['events'][0]['continuity']['previous'][0]['id'], pid)
        self.b.dispatch(dict(op='companion_share', action='settle', lease=result['lease'], outcome='unknown'))
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='claim'))['events'], [])

    def test_stale_sharing_claim_becomes_unknown_without_resending(self):
        self.enable()
        lid = c._life_event(self.b, 'Synthetic legacy', 'completed', 'Synthetic old stage', occurred=self.now.return_value-172800)
        with self.b.db:
            self.b.db.execute("UPDATE ct_life SET appraised=1,share='sharing',share_lease='legacy-lease' WHERE id=?", (lid,))
        result = self.b.dispatch(dict(op='companion_share', action='reconcile'))
        self.assertEqual(result['unknown'], 1)
        self.assertEqual(self.b.db.execute('SELECT share FROM ct_life WHERE id=?', (lid,)).fetchone()[0], 'unknown')
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='claim'))['events'], [])

    def test_forgotten_pending_source_cannot_be_shared(self):
        lid = c._life_event(self.b, 'Synthetic', 'completed', 'Synthetic invalidated source')
        with self.b.db:
            self.b.db.execute("UPDATE ct_life SET appraised=1,share='pending' WHERE id=?", (lid,))
            self.b.db.execute("UPDATE source_events SET status='forgotten' WHERE id=(SELECT source_event FROM ct_life WHERE id=?)", (lid,))
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='claim'))['events'], [])

    def test_new_claim_uses_claim_time_even_for_an_older_event(self):
        lid = c._life_event(self.b, 'Synthetic', 'observed', 'Synthetic delayed source', occurred=self.now.return_value-3600)
        with self.b.db:
            self.b.db.execute("UPDATE ct_life SET appraised=1,share='pending' WHERE id=?", (lid,))
        claimed = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.assertEqual(len(claimed['events']), 1)
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='reconcile'))['unknown'], 0)
        self.now.return_value += 901
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='reconcile'))['unknown'], 1)

    def test_late_accepted_receipt_closes_reconciled_lease_without_replay(self):
        lid = c._life_event(self.b, 'Synthetic', 'observed', 'Synthetic original source')
        with self.b.db:
            self.b.db.execute("UPDATE ct_life SET appraised=1,share='pending' WHERE id=?", (lid,))
        claimed = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.now.return_value += 901
        self.b.dispatch(dict(op='companion_share', action='reconcile'))
        settled = self.b.dispatch(dict(op='companion_share', action='settle', lease=claimed['lease'], outcome='accepted'))
        self.assertEqual(settled['count'], 1)
        self.assertEqual(self.b.db.execute('SELECT share FROM ct_life WHERE id=?', (lid,)).fetchone()[0], 'accepted')
        self.assertEqual(self.b.dispatch(dict(op='companion_share', action='claim'))['events'], [])

    def test_free_phone_activity_closes_its_announced_opening(self):
        c._set(self.b, 'dream_day', '2026-11-08')
        c._set(self.b, 'life', dict(activity=None, next_at=0))
        self.b.db.commit()
        with patch.object(c.RNG, 'random', return_value=0):
            self.b.dispatch(dict(op='companion_tick'))
        current = c._get(self.b, 'life')['activity']
        started = self.b.db.execute("SELECT id FROM ct_life WHERE stage='started'").fetchone()[0]
        appraisal = self.unchanged()
        appraisal['share'] = True
        self.b.dispatch(dict(op='companion_life_assess', id=started, assessment=appraisal))
        opening = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.b.dispatch(dict(op='companion_share', action='settle', lease=opening['lease'], outcome='accepted'))
        self.now.return_value = current['ends_at'] + 1
        self.b.dispatch(dict(op='companion_tick'))
        completed = 'phone:' + current['phone_intent'] + ':completed'
        self.assess(completed)
        result = self.b.dispatch(dict(op='companion_share', action='claim'))
        self.assertEqual([e['id'] for e in result['events']], [completed])
        self.assertEqual(result['events'][0]['continuity']['previous'][0]['id'], started)
