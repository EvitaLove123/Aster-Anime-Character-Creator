import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SkeletonHelper } from "three";

const $ = (selector) => document.querySelector(selector);
const viewport = $("#viewport");
const status = $("#status");
const state = {
  showSkeleton: false, showGrid: true,
  colors: { skin: "#f1cdbf", hair: "#d8c18d", outfit: "#aaa0e8", eyes: "#78a9e8", accent: "#e9a9c7" },
  anatomy: { bust: 1, waist: 1, hips: 1, thighs: 1, shoulders: 1 },
  texture: { detail: 35, freckles: false, shading: true }
};

let scene, camera, renderer, orbit, avatar, skeleton, skeletonHelper, grid;
let skinMaterial = null;
let uploadedSkinImage = null;
const partMeshes = new Map();
const boneByName = new Map();

function material(color, roughness = 0.78, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function addPart(name, geometry, mat, boneA, boneB = boneA, blend = null) {
  geometry.computeVertexNormals();
  const count = geometry.getAttribute("position").count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < count; i++) {
    let wa = 1, wb = 0;
    if (boneA !== boneB && blend) {
      const y = positions.getY(i);
      wa = THREE.MathUtils.clamp((y - blend.low) / (blend.high - blend.low), 0, 1);
      wb = 1 - wa;
    }
    indices[i * 4] = boneA;
    indices[i * 4 + 1] = boneB;
    weights[i * 4] = wa;
    weights[i * 4 + 1] = wb;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, mat);
  mesh.userData.basePositions = Float32Array.from(geometry.getAttribute("position").array);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, new THREE.Matrix4());
  avatar.add(mesh);
  partMeshes.set(name, mesh);
  return mesh;
}
function sphereGeometry(x, y, z, sx, sy, sz, width = 24, height = 18) {
  const g = new THREE.SphereGeometry(1, width, height);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
function capsuleGeometry(a, b, radius, radial = 14) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 5, radial);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  const m = new THREE.Matrix4().compose(start.add(end).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}
function cylinderGeometry(top, bottom, height, x, y, z, sx = 1, sz = 1) {
  const g = new THREE.CylinderGeometry(top, bottom, height, 32, 1, false);
  g.scale(sx, 1, sz);
  g.translate(x, y, z);
  return g;
}
function makeBone(name, parent, position) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(position[0], position[1], position[2]);
  if (parent) parent.add(bone);
  boneByName.set(name, bone);
  return bone;
}
function buildRig() {
  boneByName.clear();
  const hips = makeBone("J_Bip_C_Hips", null, [0, 1.02, 0]);
  const spine = makeBone("J_Bip_C_Spine", hips, [0, 0.32, 0]);
  const chest = makeBone("J_Bip_C_Chest", spine, [0, 0.34, 0]);
  const neck = makeBone("J_Bip_C_Neck", chest, [0, 0.22, 0]);
  makeBone("J_Bip_C_Head", neck, [0, 0.18, 0]);
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? -1 : 1;
    const upperLeg = makeBone("J_Bip_" + side + "_UpperLeg", hips, [sign * 0.145, -0.04, 0]);
    makeBone("J_Bip_" + side + "_LowerLeg", upperLeg, [0, -0.50, 0]);
    makeBone("J_Bip_" + side + "_Foot", boneByName.get("J_Bip_" + side + "_LowerLeg"), [0, -0.43, 0.055]);
    const shoulder = makeBone("J_Bip_" + side + "_Shoulder", chest, [sign * 0.25, 0.16, 0]);
    const upperArm = makeBone("J_Bip_" + side + "_UpperArm", shoulder, [sign * 0.13, -0.035, 0]);
    makeBone("J_Bip_" + side + "_LowerArm", upperArm, [sign * 0.0, -0.40, 0]);
    makeBone("J_Bip_" + side + "_Hand", boneByName.get("J_Bip_" + side + "_LowerArm"), [0, -0.36, 0]);
  }
  avatar.add(hips);
  avatar.updateMatrixWorld(true);
  const bones = [];
  avatar.traverse((o) => { if (o.isBone) bones.push(o); });
  skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
}
function boneIndex(name) {
  return skeleton.bones.findIndex((bone) => bone.name === name);
}
function addWeightedSphere(name, coords, mat, a, b = a, blend = null, scale = [1, 1, 1]) {
  return addPart(name, sphereGeometry(...coords, ...scale), mat, boneIndex(a), boneIndex(b), blend);
}
function makeSkinTexture() {
  if (uploadedSkinImage) {
    const imported = new THREE.Texture(uploadedSkinImage);
    imported.colorSpace = THREE.SRGBColorSpace;
    imported.wrapS = imported.wrapT = THREE.RepeatWrapping;
    imported.needsUpdate = true;
    return imported;
  }
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const detail = state.texture.detail / 100;
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 18 * detail;
    image.data[i] = 238 + grain;
    image.data[i + 1] = 202 + grain;
    image.data[i + 2] = 188 + grain;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (state.texture.shading) {
    const shade = ctx.createLinearGradient(0, 0, size, size);
    shade.addColorStop(0, "rgba(255,255,255,0.16)");
    shade.addColorStop(0.48, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(117,69,78,0.13)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
  }
  if (state.texture.freckles) {
    ctx.fillStyle = "rgba(139,78,66,0.42)";
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const radius = 0.45 + Math.random() * 1.15;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (detail > 0) {
    ctx.fillStyle = "rgba(130,91,82,0.20)";
    for (let i = 0; i < Math.floor(1800 * detail); i++) {
      const x = Math.random() * size, y = Math.random() * size;
      ctx.fillRect(x, y, 0.7 + detail, 0.7 + detail);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}
function applyAnatomy() {
  for (const [name, mesh] of partMeshes) {
    const attr = mesh.geometry.getAttribute("position");
    const base = mesh.userData.basePositions;
    for (let i = 0; i < attr.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      let factor = 1;
      if (name === "body-torso" || name === "outfit-top") {
        const waistBand = THREE.MathUtils.smoothstep(y, 1.30, 1.49);
        const bustBand = THREE.MathUtils.smoothstep(y, 1.53, 1.78);
        const shoulderBand = THREE.MathUtils.smoothstep(y, 1.76, 1.91);
        factor *= THREE.MathUtils.lerp(1, state.anatomy.waist, waistBand * (1 - bustBand));
        factor *= THREE.MathUtils.lerp(1, state.anatomy.bust, bustBand * (1 - shoulderBand));
        factor *= THREE.MathUtils.lerp(1, state.anatomy.shoulders, shoulderBand);
      } else if (name === "body-pelvis" || name === "outfit-skirt" || name === "outfit-waist-band") {
        factor *= state.anatomy.hips;
      } else if (name.startsWith("leg-") && name.includes("-upper")) {
        factor *= state.anatomy.thighs;
      }
      attr.setXYZ(i, x * factor, y, z * factor);
    }
    attr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
}
function buildFemaleCharacter() {
  if (skeletonHelper) {
    scene.remove(skeletonHelper);
    skeletonHelper = null;
  }
  if (avatar) {
    scene.remove(avatar);
    avatar.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of materials) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }
  avatar = new THREE.Group();
  avatar.name = "Aster_Female_Base";
  scene.add(avatar);
  partMeshes.clear();
  buildRig();

  const skin = material(state.colors.skin);
  skin.map = makeSkinTexture();
  skin.needsUpdate = true;
  skinMaterial = skin;
  const hair = material(state.colors.hair);
  const outfit = material(state.colors.outfit);
  const eye = material(state.colors.eyes, 0.3);
  const white = material("#fffaf7", 0.45);
  const dark = material("#514658");
  const accent = material(state.colors.accent);

  const hips = "J_Bip_C_Hips", spine = "J_Bip_C_Spine", chest = "J_Bip_C_Chest";
  const head = "J_Bip_C_Head";
  const torsoBlend = { low: 1.15, high: 1.65 };

  addWeightedSphere("body-pelvis", [0, 1.06, 0], skin, hips, spine, { low: 1.0, high: 1.2 }, [0.30, 0.25, 0.19]);
  addWeightedSphere("body-torso", [0, 1.48, 0], skin, spine, chest, torsoBlend, [0.33, 0.46, 0.205]);
  addWeightedSphere("neck", [0, 1.91, 0], skin, chest, head, { low: 1.88, high: 2.02 }, [0.115, 0.19, 0.115]);

  addPart("outfit-top", sphereGeometry(0, 1.49, 0, 0.345, 0.455, 0.216), outfit, boneIndex(spine), boneIndex(chest), torsoBlend);
  addPart("outfit-skirt", cylinderGeometry(0.34, 0.59, 0.52, 0, 1.02, 0, 1, 0.78), outfit, boneIndex(hips));
  addPart("outfit-waist-band", cylinderGeometry(0.305, 0.34, 0.10, 0, 1.29, 0, 1, 0.78), accent, boneIndex(hips));

  for (const side of ["L", "R"]) {
    const sign = side === "L" ? -1 : 1;
    const upperLeg = "J_Bip_" + side + "_UpperLeg";
    const lowerLeg = "J_Bip_" + side + "_LowerLeg";
    const foot = "J_Bip_" + side + "_Foot";
    const shoulder = "J_Bip_" + side + "_Shoulder";
    const upperArm = "J_Bip_" + side + "_UpperArm";
    const lowerArm = "J_Bip_" + side + "_LowerArm";
    const hand = "J_Bip_" + side + "_Hand";
    const hipX = sign * 0.145;

    addPart("leg-" + side + "-upper", capsuleGeometry([hipX, 1.02, 0], [hipX, 0.52, 0], 0.125), skin, boneIndex(upperLeg), boneIndex(lowerLeg), { low: 0.49, high: 0.63 });
    addPart("leg-" + side + "-lower", capsuleGeometry([hipX, 0.53, 0], [hipX, 0.12, 0.015], 0.09), skin, boneIndex(lowerLeg), boneIndex(foot), { low: 0.08, high: 0.25 });
    addPart("shoe-" + side, sphereGeometry(hipX, 0.09, 0.105, 0.13, 0.09, 0.24), outfit, boneIndex(foot));

    addPart("arm-" + side + "-upper", capsuleGeometry([sign * 0.38, 1.80, 0], [sign * 0.53, 1.43, 0.01], 0.095), skin, boneIndex(upperArm), boneIndex(lowerArm), { low: 1.40, high: 1.56 });
    addPart("arm-" + side + "-lower", capsuleGeometry([sign * 0.53, 1.44, 0.01], [sign * 0.58, 1.08, 0.025], 0.075), skin, boneIndex(lowerArm), boneIndex(hand), { low: 1.05, high: 1.20 });
    addPart("hand-" + side, sphereGeometry(sign * 0.58, 1.02, 0.03, 0.085, 0.105, 0.065), skin, boneIndex(hand));
    for (let f = 0; f < 4; f++) {
      const x = sign * (0.535 + f * 0.03);
      addPart("finger-" + side + "-" + f, capsuleGeometry([x, 1.00, 0.04], [x, 0.92 - (f % 2) * 0.025, 0.045], 0.014, 8), skin, boneIndex(hand));
    }
  }

  addWeightedSphere("head", [0, 2.22, 0], skin, head, head, null, [0.34, 0.43, 0.30]);
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? -1 : 1;
    addWeightedSphere("ear-" + side, [sign * 0.34, 2.20, 0], skin, head, head, null, [0.075, 0.115, 0.055]);
    addWeightedSphere("eye-white-" + side, [sign * 0.125, 2.25, 0.267], white, head, head, null, [0.083, 0.105, 0.035]);
    addWeightedSphere("iris-" + side, [sign * 0.125, 2.245, 0.298], eye, head, head, null, [0.047, 0.068, 0.022]);
    addWeightedSphere("eye-highlight-" + side, [sign * 0.11, 2.278, 0.318], white, head, head, null, [0.018, 0.024, 0.012]);
    addWeightedSphere("eyebrow-" + side, [sign * 0.13, 2.39, 0.255], hair, head, head, null, [0.075, 0.018, 0.018]);
    addPart("side-hair-" + side, sphereGeometry(sign * 0.29, 2.10, 0.015, 0.105, 0.32, 0.13), hair, boneIndex(head));
  }
  addWeightedSphere("nose", [0, 2.17, 0.294], skin, head, head, null, [0.035, 0.05, 0.035]);
  addWeightedSphere("mouth", [0, 2.075, 0.287], dark, head, head, null, [0.038, 0.012, 0.012]);
  addWeightedSphere("hair-cap", [0, 2.51, -0.015], hair, head, head, null, [0.36, 0.22, 0.32]);
  addPart("hair-back", sphereGeometry(0, 2.20, -0.19, 0.34, 0.48, 0.17), hair, boneIndex(head));
  addPart("fringe-center", capsuleGeometry([-0.17, 2.52, 0.17], [0.12, 2.34, 0.27], 0.075), hair, boneIndex(head));
  addPart("fringe-left", capsuleGeometry([-0.27, 2.49, 0.12], [-0.20, 2.24, 0.24], 0.065), hair, boneIndex(head));
  addPart("fringe-right", capsuleGeometry([0.27, 2.49, 0.12], [0.20, 2.24, 0.24], 0.065), hair, boneIndex(head));
  addWeightedSphere("hair-ribbon", [0, 2.69, -0.04], accent, head, head, null, [0.12, 0.055, 0.07]);
  addWeightedSphere("hair-ribbon-left", [-0.12, 2.68, -0.04], accent, head, head, null, [0.11, 0.055, 0.055]);
  addWeightedSphere("hair-ribbon-right", [0.12, 2.68, -0.04], accent, head, head, null, [0.11, 0.055, 0.055]);

  avatar.updateMatrixWorld(true);
  skeleton.update();
  skeletonHelper = new SkeletonHelper(avatar);
  skeletonHelper.visible = state.showSkeleton;
  scene.add(skeletonHelper);
  updatePartVisibility();
  applyAnatomy();
}
function updatePartVisibility() {
  for (const [name, mesh] of partMeshes) {
    let key = "head";
    if (name.startsWith("hair-") || name.startsWith("side-hair-") || name.startsWith("fringe-")) key = "hair";
    else if (name.startsWith("body-") || name === "neck") key = "body";
    else if (name.startsWith("arm-") || name.startsWith("hand-") || name.startsWith("finger-")) key = "arm";
    else if (name.startsWith("leg-") || name.startsWith("shoe-")) key = "leg";
    else if (name.startsWith("outfit-")) key = "outfit";
    const input = document.querySelector('[data-part="' + key + '"]');
    mesh.visible = input ? input.checked : true;
  }
}
function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f2fb");
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(3.8, 2.55, 7.5);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 1.38, 0);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.minDistance = 3.6;
  orbit.maxDistance = 10;
  orbit.maxPolarAngle = Math.PI * 0.88;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c1df, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xded8ff, 1.0);
  fill.position.set(-4, 3, -4);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshStandardMaterial({ color: "#ebe8f6", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  scene.add(floor);
  grid = new THREE.GridHelper(6, 24, "#c9c2e2", "#dedbea");
  grid.position.y = -0.018;
  scene.add(grid);
  resize();
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(viewport);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    status.textContent = "WebGL tạm dừng — tải lại trang để khôi phục";
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => status.textContent = "WebGL đã khôi phục");
  renderer.setAnimationLoop(() => {
    orbit.update();
    if (skeleton) skeleton.update();
    renderer.render(scene, camera);
  });
}
function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
function setView(view) {
  const target = new THREE.Vector3(0, 1.38, 0);
  orbit.target.copy(target);
  const distance = 7.2;
  const positions = {
    front: [0, 2.35, distance],
    side: [distance, 2.35, 0],
    back: [0, 2.35, -distance],
    threequarter: [3.8, 2.55, 7.5]
  };
  camera.position.set(...positions[view]);
  orbit.update();
}
function buildPartsPanel() {
  const groups = [
    ["head", "Head & Face"], ["hair", "Hair"], ["body", "Body"], ["arm", "Arms & Hands"],
    ["leg", "Legs & Feet"], ["outfit", "Outfit"]
  ];
  const host = $("#parts-list");
  host.innerHTML = "";
  for (const [key, label] of groups) {
    const row = document.createElement("label");
    row.className = "part-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.dataset.part = key;
    input.addEventListener("change", updatePartVisibility);
    const text = document.createElement("span");
    text.textContent = label;
    row.append(input, text);
    host.append(row);
  }
}
function setColor(key, value) {
  state.colors[key] = value;
  buildFemaleCharacter();
}
function bindCustomization() {
  document.querySelectorAll("[data-anatomy]").forEach((input) => {
    const key = input.dataset.anatomy;
    input.addEventListener("input", () => {
      state.anatomy[key] = Number(input.value);
      const output = document.querySelector("#v-" + key);
      if (output) output.value = Number(input.value).toFixed(2) + "×";
      applyAnatomy();
    });
  });
  const detail = $("#texture-detail");
  detail.addEventListener("input", () => {
    state.texture.detail = Number(detail.value);
    $("#v-detail").value = detail.value + "%";
  });
  detail.addEventListener("change", buildFemaleCharacter);
  $("#skin-texture-file").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      status.textContent = "Texture quá lớn — giới hạn 12 MB";
      event.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      uploadedSkinImage = image;
      buildFemaleCharacter();
      status.textContent = "Đã áp dụng skin texture cục bộ";
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      status.textContent = "Không đọc được texture — hãy thử PNG/JPG/WebP";
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
  $("#reset-skin-texture").addEventListener("click", () => {
    uploadedSkinImage = null;
    $("#skin-texture-file").value = "";
    buildFemaleCharacter();
    status.textContent = "Đã chuyển về procedural skin texture";
  });
  $("#texture-freckles").addEventListener("change", (event) => {
    state.texture.freckles = event.target.checked;
    buildFemaleCharacter();
  });
  $("#texture-shading").addEventListener("change", (event) => {
    state.texture.shading = event.target.checked;
    buildFemaleCharacter();
  });
}
function bindUI() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#reset-camera").addEventListener("click", () => setView("threequarter"));
  $("#toggle-grid").addEventListener("change", (event) => { state.showGrid = event.target.checked; grid.visible = state.showGrid; });
  $("#toggle-skeleton").addEventListener("change", (event) => {
    state.showSkeleton = event.target.checked;
    if (skeletonHelper) skeletonHelper.visible = state.showSkeleton;
  });
  document.querySelectorAll("[data-color]").forEach((input) => {
    input.value = state.colors[input.dataset.color];
    input.addEventListener("input", () => setColor(input.dataset.color, input.value));
  });
  $("#reset-character").addEventListener("click", () => {
    state.colors = { skin: "#f1cdbf", hair: "#d8c18d", outfit: "#aaa0e8", eyes: "#78a9e8", accent: "#e9a9c7" };
    state.anatomy = { bust: 1, waist: 1, hips: 1, thighs: 1, shoulders: 1 };
    state.texture = { detail: 35, freckles: false, shading: true };
    document.querySelectorAll("[data-color]").forEach((input) => input.value = state.colors[input.dataset.color]);
    document.querySelectorAll("[data-anatomy]").forEach((input) => { input.value = 1; document.querySelector("#v-" + input.dataset.anatomy).value = "1.00×"; });
    $("#texture-detail").value = 35; $("#v-detail").value = "35%";
    $("#texture-freckles").checked = false; $("#texture-shading").checked = true;
    buildFemaleCharacter();
    status.textContent = "Đã khôi phục base character";
  });
}
try {
  setupScene();
  buildFemaleCharacter();
  buildPartsPanel();
  bindUI();
  bindCustomization();
  status.textContent = "Female Base Mesh · Modular Rig";
} catch (error) {
  console.error(error);
  status.textContent = "Không thể khởi tạo 3D: " + error.message;
  $("#error-panel").hidden = false;
  $("#error-panel").textContent = "3D engine không khởi tạo được. Hãy tải lại Chrome và kiểm tra WebGL.";
}
