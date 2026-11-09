import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const COLORS = {
  wood: 0xc39872,
  paleWood: 0xe3c6a2,
  cream: 0xf4eee3,
  wall: 0xece9de,
  green: 0x98a895,
  sage: 0xb7c4ad,
  dark: 0x5a6559,
  white: 0xfffbf3,
  blue: 0x7896aa,
  pink: 0xcaa8a0,
};

export function createRoom(element, { onSelect, onStatus, characterUrl }) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute(
    "aria-label",
    "可旋转的小屋，使用下方按钮查看详情",
  );
  element.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(35, 1, 0.1, 80);
  const ambient = new T.HemisphereLight(0xfffbef, 0xb3b9b1, 1.8);
  scene.add(ambient);
  const sunlight = new T.DirectionalLight(0xffefdb, 2.2);
  sunlight.position.set(4, 9, 6);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, {
    left: -7,
    right: 7,
    top: 7,
    bottom: -7,
    far: 25,
  });
  sunlight.shadow.normalBias = 0.035;
  scene.add(sunlight);
  const house = new T.Group();
  scene.add(house);
  const objects = [];
  const materials = new Map();
  function material(color) {
    const value = COLORS[color] ?? color;
    if (!materials.has(value))
      materials.set(
        value,
        new T.MeshStandardMaterial({ color: value, roughness: 0.88 }),
      );
    return materials.get(value);
  }
  function box(parent, at, size, color, detail) {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), material(color));
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    if (detail) {
      mesh.userData.detail = detail;
      objects.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }
  function sphere(parent, at, size, color) {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 20, 12), material(color));
    mesh.position.set(...at);
    mesh.scale.set(...size);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, at, radius, height, color) {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(radius, radius, height, 20),
      material(color),
    );
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Low-cost scenery shares materials with the room and needs no image requests.
  const garden = cylinder(house, [0, -0.49, 0], 6.2, 0.16, "sage");
  garden.scale.z = 0.78;
  cylinder(house, [0, -0.61, 0], 5.8, 0.12, "cream").scale.z = 0.78;
  for (const [x, z, scale] of [[-5, -2.6, 0.7], [4.9, -2.2, 0.55], [4.7, 2.9, 0.35]]) {
    cylinder(house, [x, 0.05, z], 0.08, 1.1 * scale, "wood");
    sphere(house, [x, 0.6 * scale, z], [0.7 * scale, 0.85 * scale, 0.65 * scale], "green");
  }

  // A small cutaway room, built once. State updates only move the character.
  box(house, [0, -0.13, 0], [9.2, 0.28, 7.2], "paleWood");
  box(house, [0, -0.32, 0], [9.35, 0.15, 7.35], "cream");
  for (let x = -4.2; x < 4.5; x += 0.58)
    box(house, [x, 0.015, 0], [0.015, 0.012, 7], 0xd2b493);
  box(house, [0, 2.1, -3.5], [9.2, 4.3, 0.16], "wall");
  const leftWall = box(house, [-4.5, 2.1, 0], [0.16, 4.3, 7.1], "wall");
  leftWall.material = material("wall").clone();
  leftWall.material.transparent = true;
  box(house, [0, 0.15, -3.37], [9, 0.16, 0.09], "white");
  box(house, [-4.37, 0.15, 0], [0.09, 0.16, 7], "white");
  const rug = cylinder(house, [0.2, 0.045, 0.9], 1.8, 0.04, "sage");
  rug.scale.z = 0.74;
  const rugInset = cylinder(house, [0.2, 0.071, 0.9], 1.64, 0.01, 0xc9d1be);
  rugInset.scale.z = 0.74;

  // Window, ledge and a distant landscape are meshes, not externally loaded images.
  box(house, [1.2, 2.65, -3.36], [2.8, 1.8, 0.12], "white", "life");
  const windowSky = box(house, [1.2, 2.65, -3.27], [2.5, 1.53, 0.06], 0xd0e0dc, "life");
  windowSky.material = windowSky.material.clone();
  for (const [x, y, width, height] of [
    [0.4, 2.15, 1.1, 0.42],
    [1.4, 2.08, 1.6, 0.58],
    [2.2, 2.15, 0.5, 0.4],
  ]) {
    sphere(house, [x, y, -3.2], [width, height, 0.02], 0xb0c3b5);
  }
  box(house, [1.2, 2.65, -3.12], [0.065, 1.59, 0.075], "white");
  box(house, [1.2, 2.65, -3.12], [2.55, 0.065, 0.075], "white");
  box(house, [1.2, 1.77, -3.13], [3, 0.13, 0.4], "paleWood");
  box(house, [1.2, 3.68, -3.08], [3.3, 0.07, 0.07], "wood");
  for (const x of [-0.32, 2.72]) {
    box(house, [x, 2.68, -3.02], [0.4, 1.8, 0.12], "cream");
    box(house, [x, 2.3, -2.93], [0.42, 0.07, 0.04], "pink");
  }
  const sunOrMoon = sphere(house, [1.91, 3.09, -3.18], [0.18, 0.18, 0.025], 0xffe6af);
  sunOrMoon.material = sunOrMoon.material.clone();

  // An entry, slippers and a whale wall print make this a lived-in home.
  box(house, [3.72, 1.38, -3.32], [1.08, 2.75, 0.1], "paleWood", "life");
  box(house, [3.72, 1.48, -3.24], [0.83, 2.28, 0.04], "cream", "life");
  sphere(house, [3.4, 1.3, -3.17], [0.05, 0.05, 0.05], "wood");
  box(house, [3.7, 0.045, -2.65], [1.3, 0.04, 0.65], "pink");
  for (const x of [3.48, 3.86]) sphere(house, [x, 0.1, -2.6], [0.12, 0.065, 0.24], "cream");
  box(house, [-1.35, 2.85, -3.31], [0.95, 0.77, 0.08], "paleWood");
  box(house, [-1.35, 2.85, -3.25], [0.81, 0.63, 0.035], "cream");
  sphere(house, [-1.4, 2.84, -3.21], [0.24, 0.13, 0.02], "blue");
  sphere(house, [-1.14, 2.89, -3.21], [0.1, 0.07, 0.02], "blue").rotation.z = 0.6;
  sphere(house, [-1.5, 2.88, -3.18], [0.016, 0.016, 0.01], "dark");

  cylinder(house, [-1.65, 0.08, -1.8], 0.23, 0.12, "wood");
  cylinder(house, [-1.65, 1.12, -1.8], 0.035, 2.1, "wood");
  const shade = new T.Mesh(new T.CylinderGeometry(0.25, 0.43, 0.45, 20), material("cream").clone());
  shade.position.set(-1.65, 2.1, -1.8);
  house.add(shade);
  const lamp = new T.PointLight(0xffd49c, 0, 7, 1.4);
  lamp.position.set(-1.65, 1.9, -1.8);
  house.add(lamp);

  // Desk and chair.
  box(house, [2.35, 1.12, -1.95], [2.8, 0.15, 1.15], "paleWood", "reading");
  for (const x of [1.15, 3.55])
    for (const z of [-2.4, -1.5])
      box(house, [x, 0.54, z], [0.12, 1.05, 0.12], "wood");
  box(house, [2.3, 0.57, -0.84], [0.85, 0.14, 0.77], "green");
  box(house, [2.3, 0.98, -0.45], [0.85, 0.72, 0.11], "green");
  for (const x of [2, 2.6])
    for (const z of [-1.1, -0.57])
      box(house, [x, 0.27, z], [0.08, 0.54, 0.08], "wood");
  const book = box(
    house,
    [2.25, 1.23, -1.8],
    [0.75, 0.08, 0.5],
    "cream",
    "reading",
  );
  book.rotation.y = -0.15;
  box(house, [2.25, 1.28, -1.8], [0.018, 0.018, 0.47], "wood");
  cylinder(house, [3.22, 1.32, -2], 0.12, 0.27, "white");

  // Sofa, cushions and a folded throw.
  box(house, [-2.8, 0.55, 0.05], [1.6, 0.6, 2.7], "green", "energy");
  box(house, [-3.4, 1.03, 0.05], [0.35, 1.25, 2.72], "green", "energy");
  box(house, [-2.75, 0.93, -1.23], [1.66, 0.6, 0.25], "green");
  box(house, [-2.75, 0.93, 1.34], [1.66, 0.6, 0.25], "green");
  for (const z of [-0.57, 0.61])
    box(house, [-2.61, 0.91, z], [1.21, 0.18, 1.12], "sage");
  const cushion = box(house, [-2.8, 1.13, -0.77], [0.24, 0.68, 0.65], "cream");
  cushion.rotation.z = -0.22;
  box(house, [-2.62, 1.02, 0.86], [1.18, 0.06, 0.6], "pink");

  // Bookshelf, planter and diary, each with a clear detail destination.
  box(house, [-2.8, 1.35, -2.9], [2.25, 2.7, 0.55], "wood", "reading");
  box(house, [-2.8, 1.38, -2.57], [2.03, 2.4, 0.04], "cream");
  for (const y of [0.25, 1.04, 1.83, 2.63])
    box(house, [-2.8, y, -2.57], [2.2, 0.09, 0.6], "paleWood", "reading");
  const bookColors = ["green", "pink", "cream", "blue", "sage"];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6; i++) {
      const volume = box(
        house,
        [-3.6 + i * 0.24, 0.62 + row * 0.79, -2.49],
        [0.16, 0.5 + (i % 3) * 0.06, 0.3],
        bookColors[(i + row) % 5],
        "reading",
      );
      volume.rotation.z = i === 5 ? -0.17 : 0;
    }
  const plant = new T.Group();
  plant.position.set(3.95, 0, -0.75);
  house.add(plant);
  cylinder(plant, [0, 0.29, 0], 0.3, 0.56, "cream");
  cylinder(plant, [0, 0.58, 0], 0.26, 0.04, "wood");
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7;
    const leaf = sphere(
      plant,
      [Math.cos(a) * 0.24, 0.94 + (i % 2) * 0.18, Math.sin(a) * 0.2],
      [0.13, 0.4, 0.07],
      "green",
    );
    leaf.rotation.z = Math.cos(a) * -0.5;
  }
  const table = cylinder(house, [-0.45, 0.61, 2.45], 0.67, 0.1, "paleWood");
  cylinder(house, [-0.45, 0.3, 2.45], 0.08, 0.6, "wood");
  box(house, [-0.45, 0.7, 2.45], [0.58, 0.07, 0.42], "pink", "memory");
  const bowl = cylinder(house, [0.15, 0.79, 2.39], 0.19, 0.22, "white");
  sphere(house, [0.15, 0.93, 2.39], [0.16, 0.07, 0.16], "white");
  bowl.userData.detail = "energy";
  objects.push(bowl);
  table.receiveShadow = true;

  // A sagging fabric hammock. Phone time and sleep share this resting place.
  const hammock = new T.Group();
  hammock.position.set(2.65, 0, 1.05);
  house.add(hammock);
  for (const z of [-1.85, 1.85]) {
    cylinder(hammock, [0, 1.05, z], 0.065, 2.1, "wood");
    box(hammock, [0, 0.1, z], [1.5, 0.16, 0.36], "paleWood");
  }
  const fabricGeometry = new T.PlaneGeometry(1.65, 3.1, 12, 20);
  const vertices = fabricGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getY(i);
    const sag = 0.72 + 0.66 * Math.pow(z / 1.55, 2) + 0.15 * Math.pow(x / 0.825, 2);
    vertices.setXYZ(i, x, sag, z);
  }
  fabricGeometry.computeVertexNormals();
  const fabricMaterial = material("cream").clone();
  fabricMaterial.side = T.DoubleSide;
  const fabric = new T.Mesh(fabricGeometry, fabricMaterial);
  fabric.receiveShadow = fabric.castShadow = true;
  fabric.userData.detail = "energy";
  objects.push(fabric);
  hammock.add(fabric);
  for (const z of [-1.55, 1.55]) {
    box(hammock, [0, 1.45, z], [1.8, 0.055, 0.055], "paleWood");
    for (const x of [-0.8, 0.8]) {
      const from = new T.Vector3(x, 1.45, z);
      const to = new T.Vector3(0, 2.05, Math.sign(z) * 1.85);
      const rope = cylinder(hammock, from.clone().add(to).multiplyScalar(0.5).toArray(), 0.018, from.distanceTo(to), "paleWood");
      rope.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
    }
  }
  sphere(hammock, [0, 1.23, -0.95], [0.58, 0.13, 0.29], "pink");
  // A visible phone holder works with an unrigged character without inventing arm motion.
  const hammockPhone = new T.Group();
  hammock.add(hammockPhone);
  cylinder(hammockPhone, [0.82, 1.1, -0.55], 0.023, 1.5, "dark");
  box(hammockPhone, [0.42, 1.84, -0.55], [0.8, 0.035, 0.035], "dark");
  box(hammockPhone, [0.02, 1.83, -0.55], [0.3, 0.035, 0.5], "dark");
  box(hammockPhone, [0.02, 1.807, -0.55], [0.25, 0.012, 0.43], "blue");
  hammockPhone.visible = false;
  const clock = cylinder(house, [-0.55, 3.2, -3.31], 0.32, 0.1, "white");
  clock.rotation.x = Math.PI / 2;
  const hourHand = new T.Group(), minuteHand = new T.Group();
  hourHand.position.set(-0.55, 3.2, -3.21);
  minuteHand.position.copy(hourHand.position);
  house.add(hourHand, minuteHand);
  box(hourHand, [0, 0.075, 0], [0.026, 0.15, 0.025], "dark");
  box(minuteHand, [0, 0.11, 0.012], [0.018, 0.22, 0.025], "dark");

  let character,
    mixer,
    actions = {},
    activeAction,
    presentation,
    heldBook,
    heldPhone;
  let azimuth = 0.42,
    elevation = 0.56,
    distance = 16.7,
    studioDistance = 6.5,
    studio = false;
  const characterStage = new T.Group();
  scene.add(characterStage);
  const targetPosition = new T.Vector3(0.15, 0.13, 0.6);
  let targetYaw = 0;
  const raycaster = new T.Raycaster();
  const cursor = new T.Vector2();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let needsRender = true,
    disposed = false,
    lastFrame = 0,
    pointer,
    tapAt = -100;
  renderer.domElement.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    onStatus?.("3D 连接中断，状态卡片仍可查看");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    needsRender = true;
    onStatus?.("ready");
  });

  function resize() {
    const width = element.clientWidth,
      height = element.clientHeight;
    renderer.setSize(width, height, false);
    needsRender = true;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(element);

  function updateCamera() {
    const focus = studio ? new T.Vector3(0, 1.35, 0) : new T.Vector3(0, 1.1, 0);
    const radius = studio
      ? studioDistance
      : distance + (camera.aspect < 1.2 ? 3.5 : 0);
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * radius,
      focus.y + Math.sin(elevation) * radius,
      Math.cos(azimuth) * Math.cos(elevation) * radius,
    );
    camera.lookAt(focus);
    leftWall.material.opacity = Math.max(0, Math.min(1, (azimuth + 0.4) * 2));
  }

  function applyPose(dt, elapsed) {
    if (!character || !presentation) return;
    const moving = !reducedMotion.matches;
    const blend = moving ? Math.min(1, dt * 4) : 1;
    characterStage.position.lerp(targetPosition, blend);
    characterStage.rotation.y +=
      (targetYaw - characterStage.rotation.y) * blend;
    const sleepTilt = ["sleeping", "phone"].includes(presentation.action) ? -Math.PI / 2 : 0;
    characterStage.rotation.x +=
      (sleepTilt - characterStage.rotation.x) * blend;
    const energy = presentation.energy ?? 0.5;
    if (moving) mixer?.update(dt * (0.55 + energy * 0.6));
    const head = character.getObjectByName("Head");
    const faceTilt =
      presentation.expression === "sad"
        ? 0.14
        : presentation.expression === "curious"
          ? -0.08
          : 0;
    if (head) {
      head.rotation.x = faceTilt;
      head.rotation.y = moving ? Math.sin(elapsed * 0.6) * 0.025 : 0;
    }
    const blink = moving && elapsed % 5.2 < 0.13 ? 0.08 : 1;
    const eyelid =
      presentation.action === "sleeping" ? 0.06 : 0.68 + energy * 0.32;
    for (const name of ["LeftEye", "RightEye"]) {
      const eye = character.getObjectByName(name);
      if (eye) eye.scale.y = blink * eyelid;
    }
    for (const [name, sign] of [
      ["LeftBrow", -1],
      ["RightBrow", 1],
    ]) {
      const brow = character.getObjectByName(name);
      if (brow)
        brow.rotation.z =
          sign *
          (presentation.expression === "angry"
            ? 0.28
            : presentation.expression === "sad"
              ? -0.18
              : 0);
    }
    const mouth = character.getObjectByName("Mouth");
    if (mouth) mouth.scale.y = presentation.expression === "happy" ? 1.6 : 0.65;
    const left = character.getObjectByName("LeftArm"),
      right = character.getObjectByName("RightArm");
    const seated = [
      "reading",
      "writing",
      "phone",
      "resting",
      "eating",
    ].includes(presentation.action);
    for (const name of ["LeftLeg", "RightLeg"]) {
      const leg = character.getObjectByName(name);
      if (leg) leg.rotation.x = seated ? -1.15 : 0;
    }
    if (heldBook)
      heldBook.visible = Boolean(character.getObjectByName("LeftArm")) && ["reading", "writing"].includes(presentation.action);
    if (heldPhone) heldPhone.visible = Boolean(character.getObjectByName("RightArm")) && presentation.action === "phone";
    if (activeAction !== "walking") {
      if (left)
        left.rotation.x = ["reading", "writing"].includes(presentation.action)
          ? -0.85
          : 0;
      if (right)
        right.rotation.x = ["reading", "phone", "eating"].includes(
          presentation.action,
        )
          ? -0.95
          : 0;
      if (right)
        right.rotation.z =
          moving && elapsed - tapAt < 1.2
            ? -0.8 + Math.sin(elapsed * 15) * 0.15
            : -0.04;
    }
    characterStage.position.y += reducedMotion.matches
      ? 0
      : Math.sin(elapsed * 1.7) * 0.0009;
  }

  const started = performance.now();
  function frame(time) {
    if (disposed) return;
    requestAnimationFrame(frame);
    if (document.hidden || time - lastFrame < 1000 / 30) return;
    if (reducedMotion.matches && !needsRender) return;
    const dt = Math.min((time - (lastFrame || time)) / 1000, 0.07);
    lastFrame = time;
    updateCamera();
    if (!studio) applyPose(dt, (time - started) / 1000);
    renderer.render(scene, camera);
    needsRender = false;
  }
  requestAnimationFrame(frame);

  function setState(value) {
    needsRender = true;
    presentation = value;
    hammockPhone.visible = value.action === "phone";
    characterStage.visible = studio || value.presence === "home";
    const night = value.period === "night", dusk = value.period === "dusk";
    ambient.intensity = night ? 1.15 : 1.8;
    sunlight.intensity = night ? 0.65 : dusk ? 1.4 : 2.2;
    sunlight.color.setHex(night ? 0xc4d5ef : 0xffefdb);
    lamp.intensity = night ? 4 : dusk ? 2.5 : 0;
    shade.material.emissive.setHex(night || dusk ? 0x674326 : 0x000000);
    windowSky.material.color.setHex(night ? 0x526b8f : dusk ? 0xecc7aa : 0xd0e0dc);
    sunOrMoon.material.color.setHex(night ? 0xfff5d6 : 0xffe6af);
    hourHand.rotation.z = -value.hour * Math.PI / 6;
    minuteHand.rotation.z = -(value.minute || 0) * Math.PI / 30;
    const poses = {
      reading: [1.3, 0.13, -0.4, 0.35],
      writing: [1.3, 0.13, -0.4, 0.35],
      phone: [2.65, 1.15, 2.4, 0],
      resting: [-1.5, 0.13, 0.35, 0.35],
      sleeping: [2.65, 1.15, 2.4, 0],
      eating: [-0.4, 0.13, 1.1, 0.2],
      tending: [2.8, 0.13, 2, 1.1],
      cleaning: [0.2, 0.13, 0.2, -0.3],
    };
    const pose = poses[value.action] || [0.15, 0.13, 0.6, 0];
    targetPosition.set(...pose.slice(0, 3));
    targetYaw = pose[3];
  }

  const load = characterUrl
    ? new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(characterUrl)
    : Promise.reject(new Error("character_unconfigured"));
  load
    .then((gltf) => {
      if (disposed) return;
      character = gltf.scene;
      const bounds = new T.Box3().setFromObject(character);
      character.scale.setScalar(2.7 / (bounds.max.y - bounds.min.y));
      character.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.userData.detail = "mood";
          objects.push(node);
        }
      });
      characterStage.add(character);
      heldBook = new T.Group();
      // Stage coordinates are normalized metres, unlike arbitrary GLB source units.
      characterStage.add(heldBook);
      box(
        heldBook,
        [-0.28, 1.22, 0.6],
        [0.55, 0.07, 0.63],
        "white",
      ).rotation.z = 0.12;
      box(heldBook, [0.28, 1.22, 0.6], [0.55, 0.07, 0.63], "white").rotation.z =
        -0.12;
      heldBook.visible = false;
      heldPhone = new T.Group();
      characterStage.add(heldPhone);
      box(heldPhone, [0.18, -0.55, 0.15], [0.23, 0.36, 0.04], "dark");
      box(heldPhone, [0.18, -0.55, 0.178], [0.18, 0.29, 0.012], "blue");
      heldPhone.visible = false;
      if (!studio) characterStage.position.copy(targetPosition);
      characterStage.visible = studio || presentation?.presence === "home";
      mixer = new T.AnimationMixer(character);
      actions = Object.fromEntries(
        gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
      );
      actions.idle?.play();
      activeAction = "idle";
      needsRender = true;
      onStatus?.("ready");
    })
    .catch(() => onStatus?.("角色资源暂未载入"));

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle: azimuth,
      moved: false,
    };
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      pointer.moved = true;
      const nextAngle = pointer.angle - dx * 0.006;
      azimuth = studio ? nextAngle : Math.max(-1.35, Math.min(1.35, nextAngle));
      needsRender = true;
    }
  });
  renderer.domElement.addEventListener("pointercancel", () => {
    pointer = null;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.moved) {
      pointer = null;
      return;
    }
    pointer = null;
    const rect = renderer.domElement.getBoundingClientRect();
    cursor.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(cursor, camera);
    const hit = raycaster
      .intersectObjects(objects)
      .find((item) => {
        for (let object = item.object; object; object = object.parent)
          if (!object.visible) return false;
        return item.object.userData.detail;
      });
    if (hit) {
      onSelect?.(hit.object.userData.detail);
      tapAt = (performance.now() - started) / 1000;
    }
  });
  resize();

  return {
    setState,
    setView(view) {
      needsRender = true;
      studio = view !== "home";
      house.visible = !studio;
      characterStage.visible = studio || presentation?.presence === "home";
      azimuth =
        { front: 0, side: Math.PI / 2, back: Math.PI, home: 0.42 }[view] ??
        0.42;
      elevation = studio ? 0.02 : 0.56;
      if (studio) {
        characterStage.position.set(0, 0, 0);
        characterStage.rotation.set(0, 0, 0);
        mixer?.setTime(0);
        for (const name of [
          "LeftArm",
          "RightArm",
          "LeftLeg",
          "RightLeg",
          "Head",
        ]) {
          character?.getObjectByName(name)?.rotation.set(0, 0, 0);
        }
        for (const name of ["LeftEye", "RightEye"])
          character?.getObjectByName(name)?.scale.set(1, 1, 1);
        if (heldBook) heldBook.visible = false;
        if (heldPhone) heldPhone.visible = false;
      }
      updateCamera();
      renderer.render(scene, camera);
    },
    resetView() {
      needsRender = true;
      studio = false;
      house.visible = true;
      characterStage.visible = presentation?.presence === "home";
      azimuth = 0.42;
      elevation = 0.56;
      distance = 16.7;
    },
    rotate(delta) {
      azimuth = studio
        ? azimuth + delta
        : Math.max(-1.35, Math.min(1.35, azimuth + delta));
      needsRender = true;
    },
    zoom(delta) {
      if (studio)
        studioDistance = Math.max(
          4,
          Math.min(10, studioDistance + delta * 0.4),
        );
      else distance = Math.max(11, Math.min(23, distance + delta));
      needsRender = true;
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      mixer?.stopAllAction();
      scene.traverse((node) => {
        if (node.isMesh) {
          node.geometry.dispose();
          for (const mat of Array.isArray(node.material)
            ? node.material
            : [node.material])
            mat.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
