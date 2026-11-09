import test from 'node:test';
import assert from 'node:assert/strict';
import { currentPosts } from '../src/reading.mjs';

test('live posts merge page batches, hide completed threads and expire after 24 actual hours', () => {
  const now = 200000;
  const row = (id, status, at, url = 'https://tieba.baidu.com/p/1') =>
    ({ id, status, last_read_at: at, source: 'fixture', url });
  const reading = { recent_readings: [row('old', 'partial', now - 200),
    row('new', 'partial', now - 50, 'https://tieba.baidu.com/p/1?pn=2'),
    row('expired', 'partial', now - 86401, 'https://tieba.baidu.com/p/2'),
    row('boundary', 'partial', now - 86400, 'https://tieba.baidu.com/p/3')] };
  assert.deepEqual(currentPosts(reading, now).map(item => item.id), ['new', 'boundary']);
  reading.recent_readings.push(row('done', 'complete', now));
  assert.deepEqual(currentPosts(reading, now).map(item => item.id), ['boundary']);
  reading.continuations = [];
  assert.deepEqual(currentPosts(reading, now), []);
});
