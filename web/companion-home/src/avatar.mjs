import * as T from 'three';
import { tailClearance } from './layout.mjs';

const smooth = (a, b, value) => T.MathUtils.smoothstep(value, a, b);
const FACE_TILES = { happy: 0, sad: 1, angry: 2, worried: 3, surprised: 3, curious: 4, affection: 5, smug: 6, sleeping: 7 };

export function smoothFace(geometry, face, scale = 1) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const weights = new Float32Array(positions.count);
  const normal = new T.Vector3();
  const surfaceNormal = new T.Vector3();
  const radiusX = face.width * 0.58, radiusY = face.height * 0.9;
  const depthX = face.width * 0.42, depthY = face.height * 0.30;
  const centerY = face.bottom + face.height * 0.46;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / scale, y = positions.getY(i) / scale, z = positions.getZ(i) / scale;
    // A continuous convex cheek surface fills old facial relief, retaining the fringe.
    const top = face.bottom + face.height * (0.58 + 0.35 * smooth(face.width * 0.05, face.width * 0.22, Math.abs(x)));
    const weight = smooth(face.front - 0.04, face.front + 0.015, z) *
      (1 - smooth(face.width * 0.41, face.width * 0.53, Math.abs(x))) *
      smooth(face.bottom, face.bottom + face.height * 0.08, y) *
      (1 - smooth(top - face.height * 0.10, top, y));
    weights[i] = weight;
    const surfaceZ = (face.surface_depth ?? face.plane ?? face.front + 0.095) -
      depthX * Math.pow(x / radiusX, 2) - depthY * Math.pow((y - centerY) / radiusY, 2);
    positions.setZ(i, T.MathUtils.lerp(z, surfaceZ, weight) * scale);
    if (normals && weight > 0) {
      surfaceNormal.set(2 * depthX * x / (radiusX * radiusX),
        2 * depthY * (y - centerY) / (radiusY * radiusY), 1).normalize();
      normal.fromBufferAttribute(normals, i).lerp(surfaceNormal, weight).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
  }
  geometry.setAttribute('avatarFaceWeight', new T.Float32BufferAttribute(weights, 1));
}

// Retain the earlier exported name, using the same rounded surface implementation.
export const flattenFace = smoothFace;

// Assets opt into these deformations using private, measured companionRig metadata.
// No character-specific coordinates or reference artwork are embedded in public code.
export function prepareAvatar(model, { expressionAtlasUrl, expressionTexture, onInvalidate } = {}) {
  const rig = model.userData.companionRig;
  if (rig?.version !== 1) return null;
  model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model);
  const scale = 2.7 / (bounds.max.y - bounds.min.y);
  const meshes = [];
  model.traverse(node => { if (node.isMesh) meshes.push(node); });
  const uniforms = {
    avatarFace: { value: null }, avatarTile: { value: 0 },
    avatarFaceEnabled: { value: 0 }, avatarFaceBounds: { value: new T.Vector4(
      rig.face.width * scale, rig.face.bottom * scale, rig.face.height * scale, rig.face.front * scale) },
  };
  let disposed = false;
  const texture = expressionTexture || (expressionAtlasUrl ? new T.TextureLoader().load(expressionAtlasUrl, () => {
    if (disposed) { texture.dispose(); return; }
    uniforms.avatarFaceEnabled.value = 1;
    onInvalidate?.();
  }) : null);
  // ImageBitmap ignores Texture.flipY. Use unflipped uploads and explicit shader Y.
  if (texture) { texture.flipY = false; texture.colorSpace = T.NoColorSpace; texture.needsUpdate = true; }
  uniforms.avatarFace.value = texture;
  const animated = [];
  const tailPoints = [];
  let tailCount = 0;
  const pivot = new T.Vector3(...rig.tail.pivot).multiplyScalar(scale);
  const point = new T.Vector3();
  const hands = rig.hands.map(hand => ({ ...hand, centerPoint: new T.Vector3(...hand.center).multiplyScalar(scale),
    gripDelta: new T.Vector3(...hand.grip).sub(new T.Vector3(...hand.center)).multiplyScalar(scale) }));
  for (const mesh of meshes) {
    const matrix = mesh.matrixWorld.clone();
    const geometry = mesh.geometry.clone();
    for (const attribute of ['position', 'normal']) {
      const source = geometry.getAttribute(attribute);
      if (!source) continue;
      const values = new Float32Array(source.count * 3);
      for (let i = 0; i < source.count; i++) values.set([source.getX(i), source.getY(i), source.getZ(i)], i * 3);
      geometry.setAttribute(attribute, new T.Float32BufferAttribute(values, 3));
    }
    geometry.applyMatrix4(matrix).scale(scale, scale, scale);
    model.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.geometry = geometry;
    if (mesh.name === rig.mesh) smoothFace(geometry, rig.face, scale);
    const positions = geometry.getAttribute('position');
    const deltas = Array.from({ length: 3 }, () => new Float32Array(positions.count * 3));
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      const x = point.x / scale, y = point.y / scale, z = point.z / scale;
      const tailTop = T.MathUtils.lerp(rig.tail.top[0], rig.tail.top[1], smooth(rig.tail.start, rig.tail.full, x));
      const tailWeight = mesh.name === rig.mesh ? smooth(rig.tail.start, rig.tail.full, x) *
        (1 - smooth(tailTop - 0.025, tailTop, y)) * (1 - smooth(rig.tail.rear, rig.tail.rear + 0.04, z)) : 0;
      if (tailWeight > 0) {
        for (const [target, direction] of [[0, 1], [1, -1]]) {
          const angle = direction * rig.tail.max_angle * tailWeight;
          const dx = point.x - pivot.x, dz = point.z - pivot.z;
          deltas[target].set([dx * Math.cos(angle) + dz * Math.sin(angle) - dx, 0,
            -dx * Math.sin(angle) + dz * Math.cos(angle) - dz], i * 3);
        }
        if (tailWeight > 0.5 && tailCount++ % 31 === 0) tailPoints.push(point.clone());
      }
      const hand = hands.find(item => mesh.name === item.mesh ||
        (mesh.name === rig.mesh && point.distanceTo(item.centerPoint) < item.radius * scale));
      if (hand) {
        const weight = mesh.name === hand.mesh ? 1 : 1 - smooth(hand.radius * scale * 0.5, hand.radius * scale, point.distanceTo(hand.centerPoint));
        deltas[2].set([hand.gripDelta.x * weight, hand.gripDelta.y * weight, hand.gripDelta.z * weight], i * 3);
      }
    }
    geometry.morphTargetsRelative = true;
    geometry.morphAttributes.position = deltas.map(values => new T.Float32BufferAttribute(values, 3));
    mesh.updateMorphTargets();
    animated.push(mesh);
    if (mesh.name === rig.mesh && texture) {
      mesh.material = mesh.material.clone();
      mesh.material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = 'attribute float avatarFaceWeight;\nvarying float avatarSmoothFace;\nvarying vec3 avatarPosition;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\navatarPosition = position;\navatarSmoothFace = avatarFaceWeight;');
        shader.fragmentShader = `varying vec3 avatarPosition;
varying float avatarSmoothFace;
uniform sampler2D avatarFace;
uniform float avatarTile;
uniform float avatarFaceEnabled;
uniform vec4 avatarFaceBounds;
` + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
vec2 faceUV = vec2(avatarPosition.x / avatarFaceBounds.x + 0.5,
  (avatarPosition.y - avatarFaceBounds.y) / avatarFaceBounds.z);
vec2 eyeLeft = (faceUV - vec2(0.28, 0.44)) / vec2(0.19, 0.30);
vec2 eyeRight = (faceUV - vec2(0.72, 0.44)) / vec2(0.19, 0.30);
vec2 mouth = (faceUV - vec2(0.5, 0.22)) / vec2(0.18, 0.20);
float faceMask = 1.0 - smoothstep(0.75, 1.0, min(min(length(eyeLeft), length(eyeRight)), length(mouth)));
faceMask *= smoothstep(avatarFaceBounds.w, avatarFaceBounds.w + 0.03, avatarPosition.z);
faceMask = max(faceMask, avatarSmoothFace);
vec2 atlasUV = (clamp(faceUV, 0.001, 0.999) + vec2(mod(avatarTile, 4.0), 1.0 - floor(avatarTile / 4.0))) / vec2(4.0, 2.0);
atlasUV.y = 1.0 - atlasUV.y;
vec4 expressionColor = sRGBTransferEOTF(texture2D(avatarFace, atlasUV));
diffuseColor.rgb = mix(diffuseColor.rgb, expressionColor.rgb, faceMask * expressionColor.a * avatarFaceEnabled);
`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, avatarSmoothFace));')
          .replace('#include <aomap_fragment>', `vec3 avatarBeforeAO = reflectedLight.indirectDiffuse;
vec3 avatarSpecularBeforeAO = reflectedLight.indirectSpecular;
#include <aomap_fragment>
reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, avatarBeforeAO, avatarSmoothFace);
reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, avatarSpecularBeforeAO, avatarSmoothFace);`);
      };
      mesh.material.customProgramCacheKey = () => 'companion-rounded-face-atlas-v3';
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  let state, pose, obstacles = [], safeAngle = 0, grip = 0;

  function collisionAt(angle) {
    if (!pose) return false;
    const transform = new T.Matrix4().compose(new T.Vector3(...pose.slice(0, 3)),
      new T.Quaternion().setFromEuler(new T.Euler(['sleeping', 'phone'].includes(state.action) ? -Math.PI / 2 : 0, pose[3], 0)), new T.Vector3(1, 1, 1));
    return tailPoints.some(source => {
      const moved = source.clone().sub(pivot).applyAxisAngle(new T.Vector3(0, 1, 0), angle).add(pivot).applyMatrix4(transform);
      // The hammock fabric is handled by a near-zero reclining amplitude.
      return obstacles.some(([x0, x1, z0, z1], index) =>
        !(index === obstacles.length - 1 && ['sleeping', 'phone'].includes(state.action)) &&
        moved.x > x0 - 0.08 && moved.x < x1 + 0.08 && moved.z > z0 - 0.08 && moved.z < z1 + 0.08);
    });
  }
  return {
    setState(value, nextPose, blockers) {
      state = value; pose = nextPose; obstacles = blockers;
      const expression = value.action === 'sleeping' ? 'sleeping' : value.expression;
      // Calm keeps the asset's original face. Named moods select the reference-derived atlas.
      uniforms.avatarFaceEnabled.value = texture?.image && FACE_TILES[expression] !== undefined ? 1 : 0;
      uniforms.avatarTile.value = FACE_TILES[expression] ?? 0;
      safeAngle = tailClearance(value.action);
      for (let trial = 0; trial < 5; trial++) {
        if (![-1, -0.5, 0, 0.5, 1].some(step => collisionAt(safeAngle * step))) break;
        safeAngle *= 0.5;
      }
      if (collisionAt(safeAngle) || collisionAt(-safeAngle)) safeAngle = 0;
    },
    update(dt, elapsed, reducedMotion) {
      if (!state) return;
      const strength = state.expressionStrength ?? 0;
      const speed = state.expression === 'angry' ? 2.4 : state.expression === 'sad' ? 0.8 : 1.35;
      const wave = reducedMotion ? 0 : Math.sin(elapsed * speed) * safeAngle * (0.45 + strength * 0.55) / rig.tail.max_angle;
      grip = T.MathUtils.lerp(grip, state.action === 'phone' ? 1 : 0, reducedMotion ? 1 : Math.min(1, dt * 7));
      for (const mesh of animated) {
        mesh.morphTargetInfluences[0] = Math.max(0, wave);
        mesh.morphTargetInfluences[1] = Math.max(0, -wave);
        mesh.morphTargetInfluences[2] = grip;
      }
      if (texture?.image) {
        const expression = state.action === 'sleeping' ? 'sleeping' : state.expression;
        uniforms.avatarFaceEnabled.value = FACE_TILES[expression] !== undefined ? 1 : 0;
      }
    },
    dispose() { disposed = true; texture?.dispose(); },
  };
}
