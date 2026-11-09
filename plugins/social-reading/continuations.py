"""Bounded live continuations, aged by actual observation rather than queue retries."""
import json
import time

TTL_SECONDS = 86400


def current(b, now=None, source_id=None):
    now = time.time() if now is None else now
    # One latest observation per canonical thread. Completion suppresses older batches.
    rows = b.db.execute('''WITH latest AS (
      SELECT d.*,row_number() OVER (
        PARTITION BY d.source,d.url ORDER BY coalesce(d.last_seen,d.created) DESC,d.created DESC) position
      FROM sr_document d JOIN sr_source s ON s.id=d.source
      WHERE s.active=1 AND s.status='verified' AND coalesce(d.last_seen,d.created)>=?
        AND (? IS NULL OR d.source=?))
      SELECT * FROM latest WHERE position=1 AND status='partial'
      ORDER BY coalesce(last_seen,created) DESC LIMIT 24''', (now-TTL_SECONDS, source_id, source_id))
    result = []
    for row in rows:
        coverage = json.loads(row['payload'] or '{}').get('coverage', {})
        if coverage.get('next_url'):
            result.append(dict(id=row['id'], source=row['source'], url=row['url'], title=row['title'],
                status=row['status'], created=row['created'], last_read_at=row['last_seen'] or row['created'],
                coverage=coverage))
    return result


def expire(b, now=None):
    now = time.time() if now is None else now
    cutoff = now-TTL_SECONDS
    cancelled = 0
    with b.db:
        abandoned = b.db.execute("UPDATE sr_document SET status='abandoned' WHERE status='partial' "
            'AND coalesce(last_seen,created)<?', (cutoff,)).rowcount
        # Bound browsers and staged/observed results must finish their real handoff.
        rows = b.db.execute("SELECT * FROM sr_read_queue WHERE status IN ('queued','paused','done') "
            "AND coalesce(problem,'')!='continuation_expired' "
            "AND (document IS NOT NULL OR (cursor IS NOT NULL AND cursor!='{}'))").fetchall()
        for row in rows:
            cursor = json.loads(row['cursor'] or '{}')
            document_id = row['document'] or cursor.get('document_id')
            doc = b.db.execute('SELECT last_seen,created FROM sr_document WHERE id=?', (document_id,)).fetchone()
            progress = max(row['observed_at'] or 0, (doc['last_seen'] or doc['created']) if doc else 0)
            if (progress or row['created']) >= cutoff:
                continue
            b.db.execute("UPDATE sr_read_queue SET status=CASE WHEN status='done' THEN 'done' ELSE 'cancelled' END,"
                "cursor='{}',problem='continuation_expired',updated=?,worker_until=0 WHERE id=?", (now, row['id']))
            cancelled += 1
    return dict(ok=True, abandoned=abandoned, cleared=cancelled, ttl_seconds=TTL_SECONDS)
