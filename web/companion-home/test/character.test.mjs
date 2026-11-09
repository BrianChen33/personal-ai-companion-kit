import test from 'node:test';
import assert from 'node:assert/strict';
import { TextureLoader } from 'three';
import { loadCharacter } from '../src/character.mjs';

function modelBytes() {
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{}] });
  const text = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const bytes = new Uint8Array(20 + text.length);
  const header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, bytes.length, true);
  header.setUint32(12, text.length, true);
  header.setUint32(16, 0x4e4f534a, true);
  bytes.set(text, 20);
  return bytes;
}

test('already downloaded model bytes and cached Blobs parse without refetching an object URL', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected_fetch'); });
  const bytes = modelBytes();
  const padded = new Uint8Array(bytes.length + 16);
  padded.set(bytes, 8);
  for (const characterData of [bytes.buffer, padded.subarray(8, 8 + bytes.length), new Blob([bytes])]) {
    const result = await loadCharacter({ characterData });
    assert.ok(result.scene.isGroup);
    assert.ok(result.parser.textureLoader instanceof TextureLoader);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('invalid binary input reports the actual parsing stage', async () => {
  await assert.rejects(loadCharacter({ characterData: new ArrayBuffer(4) }), /glb_parse/);
});
