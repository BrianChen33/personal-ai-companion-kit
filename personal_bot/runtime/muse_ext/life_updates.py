"""Activity sharing continuity through existing life rows and once-only claims."""
from muse_ext import companion as c


def context(b, row):
    project = b.db.execute(
        'SELECT id,topic,status FROM ct_activity_project WHERE id=? OR id='
        '(SELECT project FROM ct_activity_stage WHERE event=? LIMIT 1) LIMIT 1', (row['id'], row['id'])).fetchone()
    root = project['id'] if project else row['id']
    if project and project['status'] == 'withdrawn':
        return dict(project_id=root, previous=[], required=False)
    if not project and root.startswith('phone:') and root.endswith(':completed'):
        root = root[len('phone:'):-len(':completed')]
    previous = [dict(r) for r in b.db.execute(
        'SELECT l.id,l.stage,l.share,l.description FROM ct_life l JOIN source_events s ON s.id=l.source_event '
        "WHERE s.status='active' AND l.id<>? AND l.occurred<=? AND l.share IN ('sharing','accepted','unknown') "
        'AND (l.id=? OR l.id IN (SELECT event FROM ct_activity_stage WHERE project=?)) '
        'ORDER BY l.occurred DESC LIMIT 2', (row['id'], row['occurred'], root, root))]
    for item in previous:
        item['description'] = item['description'][:140]
    from muse_ext import life_schedule
    plan = life_schedule._plan(b) if life_schedule.enabled(b) else None
    scheduled = bool(plan and plan.get('subject') == 'companion' and any(
        life_schedule.anchor_id(plan['day'], a['at']) == root for a in plan['anchors']))
    required = (scheduled and row['stage'] == 'started') or (bool(previous) and row['stage'] == 'completed')
    return dict(project_id=root, topic=project['topic'][:160] if project else row['activity'],
                phase=row['stage'], previous=previous, scheduled=scheduled, required=required,
                policy='Briefly share a planned start and close an already shared activity with its released result. '
                       'Use one or two short clauses; meaningful developments may be shared between them. '
                       'Unknown is a previous handoff, never proof of delivery. Do not repeat its old text or invent progress.')


def enqueue_results(b):
    """Close recent announced activities without rerunning emotion or old sends."""
    rows = b.db.execute(
        'SELECT l.* FROM ct_life l JOIN source_events s ON s.id=l.source_event '
        "WHERE s.status='active' AND l.appraised=1 AND l.share='none' AND l.stage='completed' "
        'AND l.occurred BETWEEN ? AND ? ORDER BY l.occurred DESC LIMIT 24',
        (c.stamp() - 86400, c.stamp())).fetchall()
    for row in rows:
        if context(b, row)['required']:
            b.db.execute("UPDATE ct_life SET share='pending' WHERE id=? AND share='none'", (row['id'],))


def reconcile(b):
    claims = c._get(b, 'life_share_claims', {})
    count = 0
    rows = b.db.execute(
        "SELECT share_lease,min(occurred) occurred FROM ct_life WHERE share='sharing' "
        'GROUP BY share_lease ORDER BY occurred LIMIT 64').fetchall()
    for row in rows:
        started = claims.get(row['share_lease'], row['occurred'])
        if started < c.stamp() - 900:
            count += b.db.execute(
                "UPDATE ct_life SET share='unknown' WHERE share='sharing' AND share_lease IS ?",
                (row['share_lease'],)).rowcount
    live = {r[0] for r in b.db.execute("SELECT DISTINCT share_lease FROM ct_life WHERE share='sharing'")}
    c._set(b, 'life_share_claims', {key: value for key, value in claims.items() if key in live})
    return dict(ok=True, unknown=count, replay=False)
