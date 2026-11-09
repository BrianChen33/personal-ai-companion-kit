import * as T from "three";
import { ROOM, ZONES, POSES, OBSTACLES, CAMERA_ELEVATION, PHONE_POSITION, WORKTOP_HEIGHT, SOFA_ACTIONS } from "./layout.mjs";
import { prepareAvatar } from "./avatar.mjs";
import { loadCharacter } from "./character.mjs";

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

export function createRoom(element, { onSelect, onStatus, onCharacterError, characterUrl, characterData, expressionAtlasUrl, gardenUrl = "./garden-view.webp" }) {
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
  let currentZone = house;
  function zone(name) {
    currentZone = new T.Group();
    currentZone.position.set(...ZONES[name]);
    house.add(currentZone);
  }
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
    (parent === house ? currentZone : parent).add(mesh);
    return mesh;
  }
  function sphere(parent, at, size, color) {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 20, 12), material(color));
    mesh.position.set(...at);
    mesh.scale.set(...size);
    mesh.castShadow = mesh.receiveShadow = true;
    (parent === house ? currentZone : parent).add(mesh);
    return mesh;
  }
  function cylinder(parent, at, radius, height, color) {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(radius, radius, height, 20),
      material(color),
    );
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    (parent === house ? currentZone : parent).add(mesh);
    return mesh;
  }

  // Low-cost scenery shares materials with the room and needs no image requests.
  const garden = cylinder(house, [0, -0.49, 0], 6.2, 0.16, "sage");
  garden.scale.set(1.3, 1, 1.05);
  cylinder(house, [0, -0.61, 0], 5.8, 0.12, "cream").scale.set(1.3, 1, 1.05);
  for (const [x, z, scale] of [[-7, -3.9, 0.7], [6.9, -3.2, 0.55], [7, 4.7, 0.35]]) {
    cylinder(house, [x, 0.05, z], 0.08, 1.1 * scale, "wood");
    sphere(house, [x, 0.6 * scale, z], [0.7 * scale, 0.85 * scale, 0.65 * scale], "green");
  }

  // A small cutaway room, built once. State updates only move the character.
  box(house, [0, -0.13, 0], [ROOM.width, 0.28, ROOM.depth], "paleWood");
  box(house, [0, -0.32, 0], [ROOM.width + 0.15, 0.15, ROOM.depth + 0.15], "cream");
  for (let x = -6; x < 6.3; x += 0.58)
    box(house, [x, 0.015, 0], [0.015, 0.012, ROOM.depth - 0.2], 0xd2b493);
  const backWall = box(house, [0, 2.1, -5], [ROOM.width, 4.3, 0.16], "wall");
  backWall.material = material('wall').clone();
  backWall.material.transparent = true;
  const leftWall = box(house, [-6.3, 2.1, 0], [0.16, 4.3, ROOM.depth], "wall");
  leftWall.material = material("wall").clone();
  leftWall.material.transparent = true;
  box(house, [0, 0.15, -4.87], [ROOM.width - 0.2, 0.16, 0.09], "white");
  box(house, [-6.17, 0.15, 0], [0.09, 0.16, ROOM.depth - 0.2], "white");
  const rug = cylinder(house, [0.2, 0.045, 0.9], 1.8, 0.04, "sage");
  rug.scale.z = 0.74;
  const rugInset = cylinder(house, [0.2, 0.071, 0.9], 1.64, 0.01, 0xc9d1be);
  rugInset.scale.z = 0.74;

  zone("window");
  currentZone.scale.set(1.25, 1.08, 1);
  currentZone.position.x -= 0.3;
  currentZone.position.y -= 0.212;
  // Window, ledge and a distant landscape are meshes, not externally loaded images.
  box(house, [1.2, 2.65, -3.36], [2.8, 1.8, 0.12], "white", "life");
  const windowSky = box(house, [1.2, 2.65, -3.27], [2.5, 1.53, 0.06], 0xd0e0dc, "life");
  windowSky.material = windowSky.material.clone();
  const gardenTexture = new T.TextureLoader().load(gardenUrl, () => {
    if (disposed) { gardenTexture.dispose(); return; }
    needsRender = true;
  }, undefined, () => {
    if (disposed) return;
    windowLandscape.visible = false;
    needsRender = true;
  });
  gardenTexture.colorSpace = T.SRGBColorSpace;
  const windowLandscape = new T.Mesh(new T.PlaneGeometry(2.5, 1.53), new T.MeshBasicMaterial({ map: gardenTexture, color: 0xffffff }));
  windowLandscape.position.set(1.2, 2.65, -3.19);
  currentZone.add(windowLandscape);
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

  zone("entry");
  // An entry, slippers and a whale wall print make this a lived-in home.
  box(house, [3.72, 1.38, -3.32], [1.08, 2.75, 0.1], "paleWood", "life");
  box(house, [3.72, 1.48, -3.24], [0.83, 2.28, 0.04], "cream", "life");
  sphere(house, [3.4, 1.3, -3.17], [0.05, 0.05, 0.05], "wood");
  box(house, [3.7, 0.045, -2.65], [1.3, 0.04, 0.65], "pink");
  for (const x of [3.48, 3.86]) sphere(house, [x, 0.1, -2.6], [0.12, 0.065, 0.24], "cream");
  zone("window");
  box(house, [-1.35, 2.85, -3.31], [0.95, 0.77, 0.08], "paleWood");
  zone("window");
  box(house, [-1.35, 2.85, -3.25], [0.81, 0.63, 0.035], "cream");
  sphere(house, [-1.4, 2.84, -3.21], [0.24, 0.13, 0.02], "blue");
  sphere(house, [-1.14, 2.89, -3.21], [0.1, 0.07, 0.02], "blue").rotation.z = 0.6;
  sphere(house, [-1.5, 2.88, -3.18], [0.016, 0.016, 0.01], "dark");

  cylinder(house, [-1.65, 0.08, -1.8], 0.23, 0.12, "wood");
  cylinder(house, [-1.65, 1.12, -1.8], 0.035, 2.1, "wood");
  const shade = new T.Mesh(new T.CylinderGeometry(0.25, 0.43, 0.45, 20), material("cream").clone());
  shade.position.set(-1.65, 2.1, -1.8);
  currentZone.add(shade);
  const lamp = new T.PointLight(0xffd49c, 0, 7, 1.4);
  lamp.position.set(-1.65, 1.9, -1.8);
  currentZone.add(lamp);

  zone("desk");
  // Higher worktop and a perch stool keep the unrigged body's proportions.
  box(house, [2.35, WORKTOP_HEIGHT, -1.95], [2.8, 0.15, 1.15], "paleWood", "reading");
  for (const x of [1.15, 3.55])
    for (const z of [-2.4, -1.5])
      box(house, [x, (WORKTOP_HEIGHT - 0.075) / 2, z], [0.12, WORKTOP_HEIGHT - 0.075, 0.12], "wood");
  cylinder(house, [2.3, 1.19, -0.6], 0.45, 0.14, "green");
  for (const x of [2.02, 2.58])
    for (const z of [-0.88, -0.32])
      cylinder(house, [x, 0.58, z], 0.045, 1.16, "wood");
  const book = box(
    house,
    [2.25, WORKTOP_HEIGHT + 0.12, -1.8],
    [0.75, 0.08, 0.5],
    "cream",
    "reading",
  );
  book.rotation.y = -0.15;
  box(house, [2.25, WORKTOP_HEIGHT + 0.17, -1.8], [0.018, 0.018, 0.47], "wood");
  cylinder(house, [3.22, WORKTOP_HEIGHT + 0.21, -2], 0.12, 0.27, "white");

  zone("sofa");
  // The open left end leaves room for hair and a hanging tail beside the seat.
  box(house, [-2.95, 0.42, 0.05], [2.1, 0.64, 3.7], "green", "energy");
  box(house, [-3.95, 1.16, 0.05], [0.28, 1.7, 3.72], "green", "energy");
  box(house, [-2.9, 0.89, 1.83], [2.1, 0.28, 0.2], "green");
  for (const z of [-0.86, 0.86])
    box(house, [-2.8, 0.82, z], [1.76, 0.18, 1.7], "sage");
  const cushion = box(house, [-3.3, 1.13, 0.86], [0.24, 0.68, 0.65], "cream");
  cushion.rotation.z = -0.22;
  box(house, [-2.8, 0.94, 0.85], [1.7, 0.05, 0.6], "pink");

  zone("shelf");
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
  zone("plant");
  const plant = new T.Group();
  plant.position.set(3.95, 0, -0.75);
  currentZone.add(plant);
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
  zone("table");
  const table = cylinder(house, [-1.65, WORKTOP_HEIGHT, 2.75], 0.9, 0.14, "paleWood");
  cylinder(house, [-1.65, (WORKTOP_HEIGHT - 0.07) / 2, 2.75], 0.11, WORKTOP_HEIGHT - 0.07, "wood");
  cylinder(house, [-1.65, 0.10, 2.75], 0.55, 0.12, "wood");
  cylinder(house, [-1.65, 1.19, 1.0], 0.45, 0.14, "green");
  for (const x of [-1.93, -1.37])
    for (const z of [0.72, 1.28]) cylinder(house, [x, 0.58, z], 0.045, 1.16, "wood");
  const meal = new T.Group();
  meal.position.set(-1.65, WORKTOP_HEIGHT + 0.08, 2.9);
  currentZone.add(meal);
  meal.visible = false;
  const bowlProfile = [[0, 0], [0.10, 0], [0.15, 0.03], [0.23, 0.14],
    [0.285, 0.28], [0.29, 0.30], [0.275, 0.315], [0.26, 0.29],
    [0.21, 0.16], [0.13, 0.08], [0, 0.07]].map(([r, y]) => new T.Vector2(r, y));
  const bowl = new T.Mesh(new T.LatheGeometry(bowlProfile, 40), material("white"));
  bowl.castShadow = bowl.receiveShadow = true;
  meal.add(bowl);
  const rim = new T.Mesh(new T.TorusGeometry(0.279, 0.012, 8, 40), material("blue"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.302;
  meal.add(rim);
  sphere(meal, [0, 0.31, 0], [0.23, 0.23, 0.23], 0xfffdf6);
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.4, y = 0.2 + i / 20;
    const radius = Math.sqrt(1 - y * y) * 0.226;
    const grain = sphere(meal, [Math.cos(angle) * radius, 0.31 + y * 0.23, Math.sin(angle) * radius],
      [0.018, 0.012, 0.033], "white");
    grain.rotation.y = angle;
  }
  bowl.userData.detail = "energy";
  objects.push(bowl);
  table.receiveShadow = true;

  zone("hammock");
  // A sagging fabric hammock. Phone time and sleep share this resting place.
  const hammock = new T.Group();
  hammock.position.set(2.65, 0, 1.05);
  currentZone.add(hammock);
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
  zone("window");
  const clock = cylinder(house, [-0.55, 3.2, -3.31], 0.32, 0.1, "white");
  clock.rotation.x = Math.PI / 2;
  const hourHand = new T.Group(), minuteHand = new T.Group();
  hourHand.position.set(-0.55, 3.2, -3.21);
  minuteHand.position.copy(hourHand.position);
  currentZone.add(hourHand, minuteHand);
  box(hourHand, [0, 0.075, 0], [0.026, 0.15, 0.025], "dark");
  box(minuteHand, [0, 0.11, 0.012], [0.018, 0.22, 0.025], "dark");

  let character,
    mixer,
    actions = {},
    activeAction,
    presentation,
    heldBook,
    heldPhone,
    avatar;
  let azimuth = 0.42,
    elevation = Math.PI / 4,
    distance = 21.2,
    studioDistance = 6.5,
    studio = false;
  const characterStage = new T.Group();
  scene.add(characterStage);
  const targetPosition = new T.Vector3(...POSES.idle.slice(0, 3));
  let targetYaw = 0;
  const raycaster = new T.Raycaster();
  const cursor = new T.Vector2();
  const pointers = new Map();
  let pinch;
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
    leftWall.material.opacity = T.MathUtils.clamp(Math.sin(azimuth) * 2 + 0.55, 0, 1);
    backWall.material.opacity = T.MathUtils.clamp(Math.cos(azimuth) * 2 + 0.2, 0, 1);
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
      ...SOFA_ACTIONS,
    ].includes(presentation.action);
    for (const name of ["LeftLeg", "RightLeg"]) {
      const leg = character.getObjectByName(name);
      if (leg) leg.rotation.x = seated ? -1.15 : 0;
    }
    if (heldBook)
      heldBook.visible = Boolean(character.getObjectByName("LeftArm")) && ["reading", "writing"].includes(presentation.action);
    if (heldPhone) heldPhone.visible = (Boolean(avatar) || Boolean(character.getObjectByName("RightArm"))) && presentation.action === "phone";
    avatar?.update(dt, elapsed, reducedMotion.matches);
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
    meal.visible = value.presence === "home" && value.action === "eating";

    characterStage.visible = studio || value.presence === "home";
    const night = value.period === "night", dusk = value.period === "dusk";
    ambient.intensity = night ? 1.15 : 1.8;
    sunlight.intensity = night ? 0.65 : dusk ? 1.4 : 2.2;
    sunlight.color.setHex(night ? 0xc4d5ef : 0xffefdb);
    lamp.intensity = night ? 4 : dusk ? 2.5 : 0;
    shade.material.emissive.setHex(night || dusk ? 0x674326 : 0x000000);
    windowSky.material.color.setHex(night ? 0x526b8f : dusk ? 0xecc7aa : 0xd0e0dc);
    sunOrMoon.material.color.setHex(night ? 0xfff5d6 : 0xffe6af);
    windowLandscape.material.color.setHex(night ? 0x52678e : dusk ? 0xe6b799 : 0xffffff);
    hourHand.rotation.z = -value.hour * Math.PI / 6;
    minuteHand.rotation.z = -(value.minute || 0) * Math.PI / 30;
    const pose = POSES[value.action] || POSES.idle;
    targetPosition.set(...pose.slice(0, 3));
    targetYaw = pose[3];
    if (!studio) {
      characterStage.position.copy(targetPosition);
      characterStage.rotation.set(["sleeping", "phone"].includes(value.action) ? -Math.PI / 2 : 0, targetYaw, 0);
    }
    avatar?.setState(value, pose, OBSTACLES);
  }

  const load = loadCharacter({ characterUrl, characterData });
  load
    .then(async (gltf) => {
      if (disposed) return;
      character = gltf.scene;
      const bounds = new T.Box3().setFromObject(character);
      const atlasIndex = character.userData.companionRig?.face?.atlas_texture;
      let expressionTexture = null, atlasFailed = false;
      if (Number.isInteger(atlasIndex)) {
        try { expressionTexture = await gltf.parser.getDependency('texture', atlasIndex); }
        catch { atlasFailed = true; }
      }
      if (disposed) { expressionTexture?.dispose(); return; }
      avatar = prepareAvatar(character, { expressionAtlasUrl, expressionTexture,
        onInvalidate: () => { needsRender = true; } });
      if (!avatar) character.scale.setScalar(2.7 / (bounds.max.y - bounds.min.y));
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
      heldPhone.position.set(...PHONE_POSITION);
      box(heldPhone, [0, 0, 0], [0.44, 0.62, 0.065], "dark");
      box(heldPhone, [0, 0, -0.038], [0.37, 0.52, 0.015], "blue");
      sphere(heldPhone, [0.12, 0.22, 0.041], [0.035, 0.035, 0.012], "dark");
      heldPhone.visible = false;
      if (!studio) characterStage.position.copy(targetPosition);
      characterStage.visible = studio || presentation?.presence === "home";
      mixer = new T.AnimationMixer(character);
      actions = Object.fromEntries(
        gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]),
      );
      actions.idle?.play();
      activeAction = "idle";
      if (presentation) setState(presentation);
      needsRender = true;
      onStatus?.(atlasFailed ? "表情暂未载入，显示原表情" : "ready");
    })
    .catch((error) => {
      if (disposed) return;
      console.error('[companion-home] Character loading failed', error);
      onStatus?.('角色载入失败：' + String(error?.message || error).slice(0, 180));
      onCharacterError?.(error);
    });

  function setCameraDistance(value) {
    if (studio) studioDistance = T.MathUtils.clamp(value, 4, 10);
    else distance = T.MathUtils.clamp(value, 11, 23);
    needsRender = true;
  }
  function fingerDistance() {
    const [first, second] = Array.from(pointers.values());
    return Math.hypot(first.x - second.x, first.y - second.y);
  }
  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      pinch = { fingers: Math.max(1, fingerDistance()), camera: studio ? studioDistance : distance };
      if (pointer) pointer.moved = true;
      return;
    }
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle: azimuth,
      elevation,
      moved: false,
    };
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size === 2) {
      setCameraDistance(pinch.camera * pinch.fingers / Math.max(1, fingerDistance()));
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) > 8) {
      pointer.moved = true;
      azimuth = pointer.angle - dx * 0.006;
      elevation = T.MathUtils.clamp(pointer.elevation + dy * 0.004, ...CAMERA_ELEVATION);
      needsRender = true;
    }
  });
  renderer.domElement.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    pinch = null;
    pointer = null;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    pointers.delete(event.pointerId);
    if (pinch) {
      pinch = null;
      pointer = null;
      return;
    }
    if (!pointer || pointer.id !== event.pointerId || pointer.moved) {
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
  renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault();
    setCameraDistance((studio ? studioDistance : distance) + event.deltaY * 0.012);
  }, { passive: false });
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
      elevation = studio ? 0.02 : Math.PI / 4;
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
      elevation = Math.PI / 4;
      distance = 21.2;
    },
    rotate(delta) {
      azimuth += delta;
      needsRender = true;
    },
    zoom(delta) {
      setCameraDistance((studio ? studioDistance : distance) + delta);
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
      avatar?.dispose();
      gardenTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
