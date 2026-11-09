import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { prepareAvatar, smoothFace } from '../src/avatar.mjs';
import { POSES, OBSTACLES, tailClearance } from '../src/layout.mjs';

test('old facial relief becomes a convex cheek surface with curved normals and an intact fringe', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([
    -0.15, 1.94, 0.8, 0.15, 1.94, 0.5, 0, 1.94, 0.55, 0, 2.2, 0.8,
  ], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0.2, 0, 0.98, 0, -0.3, 0.95, 0, 0.2, 0.98, 0, 0, 1], 3));
  smoothFace(geometry, { width: 1, bottom: 1.7, height: 0.6, front: 0.3 });
  const positions = geometry.getAttribute('position');
  assert.ok(Math.abs(positions.getZ(0) - positions.getZ(1)) < 0.00001);
  assert.ok(positions.getZ(2) > positions.getZ(0) + 0.01);
  assert.ok(geometry.getAttribute('normal').getX(0) < -0.1);
  assert.ok(geometry.getAttribute('normal').getX(1) > 0.1);
  assert.ok(Math.abs(positions.getZ(3) - 0.8) < 0.00001);
  assert.equal(geometry.getAttribute('avatarFaceWeight').getX(0), 1);
});

test('hair visibility leaves foreground hair geometry and its expression weight untouched', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 1.94, 0.8, 0.1, 1.94, 0.7], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 3));
  smoothFace(geometry, { width: 1, bottom: 1.7, height: 0.6, front: 0.3 }, 1, new Float32Array([1, 0]));
  assert.ok(geometry.getAttribute('position').getZ(0) < 0.5);
  assert.ok(Math.abs(geometry.getAttribute('position').getZ(1) - 0.7) < 0.00001);
  assert.equal(geometry.getAttribute('avatarFaceWeight').getX(1), 0);
});

test('the plant pose and open hammock zone have separate floor envelopes', () => {
  const [x, , z] = POSES.tending;
  const plant = OBSTACLES[4];
  assert.ok(x > plant[1] + 1.2);
  assert.ok(z > plant[2] && z < plant[3]);
  assert.deepEqual(POSES.phone, POSES.sleeping);
  assert.ok(POSES.phone[0] - 0.9 > OBSTACLES[5][1]);
  assert.ok(tailClearance('sleeping') < tailClearance('tending'));
});

test('an opt-in single mesh gets actual tail morphs and a hand grip without a model call', () => {
  const model = new T.Group();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, 0, 0, 2.7, 0, 1.1, 0.25, -0.3, 0.15, 1, 0.5,
  ], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
  mesh.name = 'SyntheticMesh'; model.add(mesh);
  model.userData.companionRig = { version: 1, mesh: mesh.name,
    face: { width: 1, bottom: 1.7, height: 0.6, front: 0.3 },
    tail: { pivot: [0.4, 0.25, -0.2], start: 0.5, full: 0.8, top: [0.5, 0.8], rear: 0, max_angle: 0.18 },
    hands: [{ mesh: 'SyntheticHand', center: [0.15, 1, 0.5], radius: 0.1, grip: [0.1, 1.2, 0.7] }] };
  const avatar = prepareAvatar(model);
  avatar.setState({ action: 'resting', expression: 'happy', expressionStrength: 0.6 }, POSES.idle, []);
  avatar.update(0.1, 1, false);
  assert.ok(mesh.morphTargetInfluences[0] > 0);
  assert.notEqual(mesh.geometry.morphAttributes.position[0].getZ(2), 0);
  avatar.setState({ action: 'phone' }, POSES.phone, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[2], 1);
  assert.equal(mesh.morphTargetInfluences[0], 0);
  assert.ok(mesh.geometry.morphAttributes.position[2].getY(3) > 0);
  avatar.setState({ action: 'writing' }, POSES.writing, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[3], 1);
  assert.equal(mesh.morphTargetInfluences[4], 1);
  assert.ok(mesh.geometry.morphAttributes.position[3].getZ(0) > 0.4);
  assert.ok(Math.abs(POSES.writing[0] - 1.95) < 0.01);
  assert.equal(POSES.writing[3], Math.PI);
  avatar.dispose();
});
