"""Loose daily intentions and a single released scene in the existing SQLite store.

No timers, model calls, wardrobe database or synthetic emotional stimuli.
"""
from datetime import datetime, timedelta

from muse_ext import companion as c

FIELDS = ('location', 'clothing', 'props', 'light', 'appearance')


def enabled(b):
    return c._get(b, 'day_scene_enabled', False) is True


def _day():
    return datetime.fromtimestamp(c.stamp(), c.TZ).date()


def _plan(b):
    return c._get(b, 'day_plan:' + _day().isoformat())


def _scene(b):
    value = c._get(b, 'day_scene')
    if value and _released(b, value['life_id'], required=False):
        return value
    return None


def _released(b, lid, required=True):
    row = b.db.execute('SELECT l.* FROM ct_life l JOIN source_events s ON s.id=l.source_event '
                       "WHERE l.id=? AND l.occurred<=? AND s.status='active'", (lid, c.stamp())).fetchone()
    if not row and required:
        raise ValueError('released_scene_source_required')
    return row


def _version(q):
    value = q.get('expected_version')
    if type(value) is not int or value < 0:
        raise ValueError('day_scene_expected_version_required')
    return value


def _text(value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError('invalid_day_scene_text')
    return value.strip()


def _save_plan(b, q):
    value = q.get('plan')
    day = _day().isoformat()
    if not isinstance(value, dict) or set(value) != {'day', 'anchors'} or value.get('day') != day:
        raise ValueError('current_day_plan_required')
    anchors = value['anchors']
    if not isinstance(anchors, list) or not 1 <= len(anchors) <= 6:
        raise ValueError('daily_anchors_1_to_6_required')
    start = datetime.combine(_day(), datetime.min.time(), c.TZ).timestamp()
    allowed = {a[0] for a in c.ACTIVITIES} | {'刷手机'}
    previous_at = start - 1
    cleaned = []
    for anchor in anchors:
        if not isinstance(anchor, dict) or set(anchor) != {'at', 'activity', 'intention'}:
            raise ValueError('invalid_daily_anchor_fields')
        at = anchor['at']
        if type(at) not in (int, float) or not start <= at < start + 86400 or at <= previous_at:
            raise ValueError('invalid_daily_anchor_time')
        if anchor['activity'] not in allowed:
            raise ValueError('invalid_daily_anchor_activity')
        cleaned.append(dict(at=at, activity=anchor['activity'], intention=_text(anchor['intention'], 140)))
        previous_at = at
    expected = _version(q)
    with b.db:
        b.db.execute('BEGIN IMMEDIATE')
        old = _plan(b)
        if old and old['anchors'] == cleaned:
            return dict(ok=True, replayed=True, plan=old)
        if expected != (old['version'] if old else 0):
            raise ValueError('daily_plan_version_conflict')
        # Past intentions remain intentions, but are immutable even after a revision.
        old_past = [a for a in (old or {}).get('anchors', []) if a['at'] <= c.stamp()]
        new_past = [a for a in cleaned if a['at'] <= c.stamp()]
        if old_past != new_past:
            raise ValueError('daily_plan_past_intentions_immutable')
        result = dict(day=day, version=expected + 1, anchors=cleaned, updated=c.stamp(), origin='intention')
        c._set(b, 'day_plan:' + day, result)
        cutoff = (_day() - timedelta(days=6)).isoformat()
        b.db.execute("DELETE FROM ct_kv WHERE key LIKE 'day_plan:%' AND key<?", ('day_plan:' + cutoff,))
    return dict(ok=True, replayed=False, plan=result)


def _save_scene(b, q):
    expected = _version(q)
    fields = q.get('fields', {})
    if not isinstance(fields, dict) or not set(fields) <= set(FIELDS):
        raise ValueError('invalid_scene_fields')
    fields = {key: _text(value, 100) for key, value in fields.items()}
    with b.db:
        b.db.execute('BEGIN IMMEDIATE')
        row = _released(b, q.get('life_id'))
        old = c._get(b, 'day_scene')
        # Replay only the exact already-committed mutation, not an older CAS write.
        if old and old.get('base_version') == expected and old['life_id'] == row['id'] and old['fields'] == fields:
            return dict(ok=True, replayed=True, scene=old)
        if expected != (old['version'] if old else 0):
            raise ValueError('scene_version_conflict')
        if old and row['occurred'] < old['occurred']:
            raise ValueError('scene_source_older_than_current')
        result = _record_scene(b, row, fields, expected)
    return dict(ok=True, replayed=False, scene=result)


def _record_scene(b, row, fields, base_version):
    result = dict(version=base_version + 1, base_version=base_version, life_id=row['id'],
                  source_event=row['source_event'], activity=row['activity'], stage=row['stage'],
                  occurred=row['occurred'], origin=row['origin'], fields=fields, updated=c.stamp())
    c._set(b, 'day_scene', result)
    return result


def sync(b, ids):
    """Advance only actual activity stages, preserving identity and known clothes."""
    if not enabled(b):
        return
    with b.db:
        b.db.execute('BEGIN IMMEDIATE')
        for lid in ids:
            row = _released(b, lid, required=False)
            if not row or row['stage'] not in ('started', 'progress', 'completed'):
                continue
            raw = c._get(b, 'day_scene')
            old = _scene(b)
            if old and (old['life_id'] == lid or old['occurred'] > row['occurred']):
                continue
            fields = dict((old or {}).get('fields', {}))
            if old and (old['activity'] != row['activity'] or row['stage'] == 'started'):
                fields = {k: v for k, v in fields.items() if k in ('clothing', 'appearance')}
            _record_scene(b, row, fields, raw['version'] if raw else 0)


def preference(b, activity=None):
    """A soft ordinary-activity weight; never changes the phone selection draw."""
    plan = _plan(b) if enabled(b) else None
    due = [a for a in (plan or {}).get('anchors', []) if a['at'] <= c.stamp() < a['at'] + 5400]
    preferred = due[-1]['activity'] if due else None
    if activity is None:
        return preferred
    return 2.0 if preferred == activity else 1.0


def projection(b):
    """One small foreground value, with no full plan or future scene suggestions."""
    if not enabled(b):
        return None
    scene = _scene(b)
    plan = _plan(b)
    now = c.stamp()
    future = next((a for a in (plan or {}).get('anchors', []) if a['at'] > now), None)
    result = dict(scene_version=(scene or {}).get('version', 0))
    if scene:
        result.update(activity=scene['activity'][:40], stage=scene['stage'][:24], occurred=scene['occurred'],
                      fields={k: v[:40] for k, v in scene['fields'].items()})
    if future:
        result['next_intention'] = dict(at=future['at'], text=future['intention'][:60], origin='intention')
    return result


def freeze(b, life_id=None):
    """A plan-time copy. Older life sources cannot borrow today's current setting."""
    if not enabled(b):
        return None
    scene = _scene(b)
    captured = c.stamp()
    if scene and (not life_id or scene['life_id'] == life_id):
        return dict(scene, captured_at=captured)
    row = _released(b, life_id, required=False) if life_id else None
    return dict(version=None, life_id=life_id, activity=row['activity'] if row else None,
                stage=row['stage'] if row else None, occurred=row['occurred'] if row else None,
                fields={}, captured_at=captured)


def changed(b, frozen):
    current = _scene(b)
    return bool(frozen and (not current or frozen.get('version') != current['version'] or
                            frozen.get('life_id') != current['life_id']))


def validate_frozen(b, frozen):
    if frozen and frozen.get('life_id'):
        row = _released(b, frozen['life_id'])
        if frozen.get('source_event') is not None and frozen['source_event'] != row['source_event']:
            raise ValueError('frozen_scene_source_conflict')


def status(b):
    return dict(ok=True, enabled=enabled(b), plan=_plan(b), scene=_scene(b),
                scene_version=(c._get(b, 'day_scene') or {}).get('version', 0))


def dispatch(b, q):
    action = q.get('action', 'status')
    if action == 'configure':
        if q.get('authorized') is not True:
            raise ValueError('day_scene_authorized_configuration_required')
        if type(q.get('enabled')) is not bool:
            raise ValueError('day_scene_enabled_boolean_required')
        with b.db:
            c._set(b, 'day_scene_enabled', q['enabled'])
        return status(b)
    if action == 'status':
        return status(b)
    if not enabled(b):
        return dict(ok=False, disabled=True)
    if action == 'plan':
        return _save_plan(b, q)
    if action == 'scene':
        return _save_scene(b, q)
    if action == 'pending':
        current = status(b)
        return dict(current, needed=current['plan'] is None, expected_version=(current['plan'] or {}).get('version', 0),
                    day=_day().isoformat(), anchor_fields=['at', 'activity', 'intention'],
                    activities=[a[0] for a in c.ACTIVITIES] + ['刷手机'],
                    policy='Same existing background model run. Usually4–6 broad future intentions, '
                           'fewer when little day remains. No emotions, future facts or new timer. '
                           'Scene fields only describe a released life_id. Intentions never claim completion.')
    raise ValueError('unknown_daily_scene_action')
