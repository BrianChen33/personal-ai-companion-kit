import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { prepareAvatar, smoothFace } from '../src/avatar.mjs';
import { POSES, OBSTACLES, tailClearance, CAMERA_ELEVATION, PHONE_POSITION } from '../src/layout.mjs';

test('old facial relief becomes a convex cheek surface with curved normals and an intact fringe', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([
    -0.15, 1.94, 0.8, 0.15, 1.94, 0.5, 0, 1.94, 0.55, 0, 2.35, 0.8,
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

test('face normals follow the final cheek-to-jaw transition instead of a separate ideal surface', () => {
  const geometry = new T.PlaneGeometry(1.2, 0.9, 16, 16);
  geometry.translate(0, 1.94, 0.55);
  smoothFace(geometry, { width: 1, bottom: 1.7, height: 0.6, front: 0.3 });
  const expected = geometry.clone();
  expected.computeVertexNormals();
  const weights = geometry.getAttribute('avatarFaceWeight');
  let transitions = 0;
  for (let i = 0; i < weights.count; i++) {
    if (weights.getX(i) <= 0.05 || weights.getX(i) >= 0.95) continue;
    const actualNormal = new T.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), i);
    const surfaceNormal = new T.Vector3().fromBufferAttribute(expected.getAttribute('normal'), i);
    assert.ok(actualNormal.distanceTo(surfaceNormal) < 0.00001);
    transitions++;
  }
  assert.ok(transitions > 20);
});

test('the plant pose and open hammock zone have separate floor envelopes', () => {
  const [x, , z] = POSES.tending;
  const plant = OBSTACLES[4];
  assert.ok(x > plant[1] + 0.6);
  assert.ok(x < OBSTACLES[5][0] - 0.8);
  assert.ok(z > plant[2] && z < plant[3]);
  assert.deepEqual(POSES.phone, POSES.sleeping);
  assert.ok(POSES.phone[0] - 0.9 > OBSTACLES[5][1]);
  assert.ok(tailClearance('sleeping') < tailClearance('tending'));
});

test('default poses share the sofa perch and the camera stays between 30 and 70 degrees', () => {
  assert.deepEqual(POSES.idle, POSES.resting);
  assert.deepEqual(POSES.cleaning, POSES.resting);
  assert.ok(POSES.resting[0] < -3.5);
  assert.ok(Math.abs(CAMERA_ELEVATION[0] - Math.PI / 6) < 0.00001);
  assert.ok(Math.abs(CAMERA_ELEVATION[1] - Math.PI * 7 / 18) < 0.00001);
  assert.ok(PHONE_POSITION[1] > 1.5 && PHONE_POSITION[2] > 1.0);
});

test('an opt-in single mesh gets actual tail morphs and a hand grip without a model call', () => {
  const model = new T.Group();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, 0, 0, 2.7, 0, 1.1, 0.25, -0.3, 0.15, 1, 0.5, 0.1, 0.3, 0.5,
  ], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
  mesh.name = 'SyntheticMesh'; model.add(mesh);
  model.userData.companionRig = { version: 1, mesh: mesh.name,
    face: { width: 1, bottom: 1.7, height: 0.6, front: 0.3 },
    tail: { pivot: [0.4, 0.25, -0.2], start: 0.5, full: 0.8, top: [0.5, 0.8], rear: 0, max_angle: 0.18 },
    hands: [{ mesh: 'SyntheticHand', center: [0.15, 1, 0.5], radius: 0.1, grip: [0.1, 1.2, 0.7] }] };
  const avatar = prepareAvatar(model, { expressionTexture: new T.Texture({ width: 1, height: 1 }) });
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>' };
  mesh.material.onBeforeCompile(shader);
  avatar.setState({ action: 'resting', expression: 'happy', expressionStrength: 0.6 }, POSES.idle, []);
  avatar.update(0.1, 1, false);
  assert.ok(mesh.morphTargetInfluences[0] > 0);
  assert.notEqual(mesh.geometry.morphAttributes.position[0].getZ(2), 0);
  avatar.setState({ action: 'phone' }, POSES.phone, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[2], 1);
  assert.equal(mesh.morphTargetInfluences[0], 0);
  assert.ok(mesh.geometry.morphAttributes.position[2].getY(3) > 0);
  assert.equal(mesh.geometry.getAttribute('avatarHandWeight').getX(3), 1);
  assert.equal(shader.uniforms.avatarHandPose.value, 1);
  avatar.setState({ action: 'writing' }, POSES.writing, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[3], 1);
  assert.equal(mesh.morphTargetInfluences[4], 1);
  // A shallow perch keeps the leg length and torso height intact.
  assert.ok(Math.abs(mesh.geometry.morphAttributes.position[3].getY(0)) < 0.02);
  assert.ok(Math.abs(mesh.geometry.morphAttributes.position[3].getY(1)) < 0.03);
  assert.ok(POSES.writing[1] > 0.2);
  avatar.setState({ action: 'eating' }, POSES.eating, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[3], 1);
  assert.equal(mesh.morphTargetInfluences[4], 1);
  assert.ok(POSES.eating[1] > 0.2);
  assert.ok(Math.abs(POSES.writing[0] - 1.95) < 0.01);
  assert.equal(POSES.writing[3], Math.PI);
  avatar.setState({ action: 'resting' }, POSES.resting, []);
  avatar.update(0.1, 1, true);
  assert.equal(shader.uniforms.avatarHandPose.value, 0);
  assert.equal(mesh.morphTargetInfluences[5], 1);
  const legs = mesh.geometry.morphAttributes.position[5];
  assert.ok(legs.getZ(4) > 0.2);
  assert.equal(legs.getY(1), 0); // Head and torso do not shrink to fit the sofa.
  assert.ok(Math.abs(Math.hypot(0.3 + legs.getY(4) - 0.7, 0.5 + legs.getZ(4) - 0.4) - Math.hypot(-0.4, 0.1)) < 0.00001);
  avatar.setState({ action: 'phone' }, POSES.phone, []);
  avatar.update(0.1, 1, true);
  assert.equal(mesh.morphTargetInfluences[5], 0);
  avatar.dispose();
});
