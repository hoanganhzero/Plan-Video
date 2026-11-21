// Nhân vật 3D theo diện mạo: nam / nữ, màu da, kiểu tóc, màu tóc, trang phục, mũ.
// Dùng chung cho người câu của mình (scene3d), người chơi khác trên hồ, và khung xem trước trong Tủ đồ.
// Toạ độ: mặt nhìn về -z; pose 'sit' (ngồi câu trên cầu) hoặc 'stand' (đứng, xem trước).
import * as THREE from '../vendor/three.module.min.js';
import { SKINS, HAIR_COLORS, OUTFITS, HATS, DEFAULT_LOOK } from './data.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};

const HEAD_Y = 1.08;
const HEAD_Z = -0.02;

function addHair(g, look, mat) {
  const h = look.hair;
  const capR = h === 'buzz' ? 0.207 : 0.218;
  const cap = add(g, new THREE.SphereGeometry(capR, 22, 14, 0, Math.PI * 2, 0, Math.PI * (h === 'buzz' ? 0.42 : 0.52)), mat, 0, HEAD_Y + 0.01, HEAD_Z + 0.01);
  cap.scale.y = 1.05;
  if (h !== 'buzz') {
    // Tóc phủ sau gáy
    const back = add(g, new THREE.SphereGeometry(0.212, 18, 12), mat, 0, HEAD_Y - 0.03, HEAD_Z + 0.05);
    back.scale.set(1, h === 'short' || h === 'spiky' ? 0.8 : 0.95, 0.9);
    // Mái tóc trước trán
    const fringe = add(g, new THREE.SphereGeometry(0.09, 10, 8), mat, 0.05, HEAD_Y + 0.12, HEAD_Z - 0.16);
    fringe.scale.set(1.6, 0.6, 0.6);
  }
  if (h === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const c = add(g, new THREE.ConeGeometry(0.05, 0.15, 5), mat, Math.cos(a) * 0.1, HEAD_Y + 0.2, HEAD_Z + Math.sin(a) * 0.1);
      c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
  } else if (h === 'long') {
    const p = add(g, new THREE.CapsuleGeometry(0.19, 0.38, 4, 10), mat, 0, HEAD_Y - 0.28, HEAD_Z + 0.12);
    p.scale.set(1.08, 1, 0.42);
    for (const sx of [-1, 1]) add(g, new THREE.CapsuleGeometry(0.045, 0.24, 3, 8), mat, sx * 0.17, HEAD_Y - 0.12, HEAD_Z - 0.03);
  } else if (h === 'ponytail') {
    add(g, new THREE.SphereGeometry(0.05, 10, 8), std(0xec4899), 0, HEAD_Y + 0.06, HEAD_Z + 0.21);
    const tail = add(g, new THREE.CapsuleGeometry(0.065, 0.32, 4, 8), mat, 0, HEAD_Y - 0.14, HEAD_Z + 0.27);
    tail.rotation.x = -0.35;
  } else if (h === 'braids') {
    for (const sx of [-1, 1]) {
      const b = add(g, new THREE.CapsuleGeometry(0.05, 0.34, 4, 8), mat, sx * 0.16, HEAD_Y - 0.26, HEAD_Z + 0.06);
      b.rotation.z = sx * 0.12;
      add(g, new THREE.SphereGeometry(0.035, 8, 6), std(0xef4444), sx * 0.18, HEAD_Y - 0.46, HEAD_Z + 0.06);
    }
  } else if (h === 'bun') {
    add(g, new THREE.SphereGeometry(0.1, 14, 10), mat, 0, HEAD_Y + 0.17, HEAD_Z + 0.12);
  }
}

function addHat(g, look) {
  const hat = HATS.find((x) => x.id === look.hat);
  if (!hat || hat.id === 'none') return;
  const c = std(hat.color || '#e9d39a');
  const y = HEAD_Y;
  if (hat.id === 'nonla') {
    add(g, new THREE.ConeGeometry(0.46, 0.3, 24), std(0xe9d39a, { flatShading: true }), 0, y + 0.22, HEAD_Z);
    const rim = add(g, new THREE.TorusGeometry(0.44, 0.015, 4, 32), std(0xc9b073), 0, y + 0.08, HEAD_Z);
    rim.rotation.x = Math.PI / 2;
  } else if (hat.id === 'cap') {
    add(g, new THREE.SphereGeometry(0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, y + 0.03, HEAD_Z);
    add(g, new THREE.BoxGeometry(0.3, 0.02, 0.18), c, 0, y + 0.05, HEAD_Z - 0.27);
    add(g, new THREE.SphereGeometry(0.025, 8, 6), std(0xffffff), 0, y + 0.255, HEAD_Z);
  } else if (hat.id === 'bow') {
    const bow = new THREE.Group();
    for (const sx of [-1, 1]) { const w = add(bow, new THREE.ConeGeometry(0.06, 0.12, 4), c, sx * 0.07, 0, 0); w.rotation.z = sx * Math.PI / 2; }
    add(bow, new THREE.SphereGeometry(0.035, 8, 6), c, 0, 0, 0);
    bow.position.set(0.12, y + 0.17, HEAD_Z + 0.02);
    bow.rotation.z = -0.4;
    g.add(bow);
  } else if (hat.id === 'bucket') {
    add(g, new THREE.CylinderGeometry(0.2, 0.225, 0.17, 18), c, 0, y + 0.17, HEAD_Z);
    add(g, new THREE.CylinderGeometry(0.33, 0.33, 0.02, 24), c, 0, y + 0.09, HEAD_Z);
  } else if (hat.id === 'straw') {
    add(g, new THREE.CylinderGeometry(0.44, 0.44, 0.02, 28), c, 0, y + 0.11, HEAD_Z);
    add(g, new THREE.CylinderGeometry(0.19, 0.215, 0.17, 18), c, 0, y + 0.2, HEAD_Z);
    add(g, new THREE.CylinderGeometry(0.218, 0.218, 0.045, 18), std(0xdc2626), 0, y + 0.15, HEAD_Z);
  } else if (hat.id === 'beanie') {
    add(g, new THREE.SphereGeometry(0.228, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), c, 0, y + 0.02, HEAD_Z);
    const fold = add(g, new THREE.TorusGeometry(0.21, 0.035, 8, 24), c, 0, y + 0.02, HEAD_Z);
    fold.rotation.x = Math.PI / 2;
    add(g, new THREE.SphereGeometry(0.065, 10, 8), std(0xffffff), 0, y + 0.27, HEAD_Z);
  } else if (hat.id === 'captain') {
    add(g, new THREE.CylinderGeometry(0.24, 0.21, 0.15, 20), std(0xffffff), 0, y + 0.2, HEAD_Z);
    add(g, new THREE.CylinderGeometry(0.215, 0.215, 0.06, 20), std(0x111827), 0, y + 0.1, HEAD_Z);
    add(g, new THREE.BoxGeometry(0.26, 0.02, 0.14), std(0x111827), 0, y + 0.08, HEAD_Z - 0.24);
    add(g, new THREE.SphereGeometry(0.035, 8, 6), std(0xfbbf24, { metalness: 0.7, roughness: 0.3 }), 0, y + 0.17, HEAD_Z - 0.235);
  } else if (hat.id === 'crown') {
    const gold = std(0xfbbf24, { metalness: 0.8, roughness: 0.25, emissive: 0xb45309, emissiveIntensity: 0.3 });
    add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16, 1, true), gold, 0, y + 0.22, HEAD_Z).material.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(g, new THREE.ConeGeometry(0.035, 0.11, 6), gold, Math.cos(a) * 0.16, y + 0.32, HEAD_Z + Math.sin(a) * 0.16);
      add(g, new THREE.SphereGeometry(0.022, 8, 6), std([0xef4444, 0x22c55e, 0x3b82f6][i % 3], { emissive: 0x222222 }), Math.cos(a) * 0.172, y + 0.22, HEAD_Z + Math.sin(a) * 0.172);
    }
  }
}

function addOutfitExtras(g, outfit, pose, torsoR) {
  const trim = std(outfit.trim || '#ffffff', outfit.glow ? { emissive: outfit.trim, emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.35 } : {});
  const top = std(outfit.top);
  switch (outfit.extra) {
    case 'scarf': {
      const red = std(0xdc2626);
      const ring = add(g, new THREE.TorusGeometry(0.13, 0.035, 8, 18), red, 0, 0.86, -0.02);
      ring.rotation.x = Math.PI / 2;
      const knot = add(g, new THREE.ConeGeometry(0.07, 0.2, 3), red, 0, 0.72, -0.24);
      knot.rotation.x = Math.PI;
      break;
    }
    case 'vest': {
      const v = add(g, new THREE.CapsuleGeometry(torsoR + 0.03, 0.3, 4, 12), trim, 0, 0.52, 0);
      v.scale.set(1, 1, 1.02);
      add(g, new THREE.BoxGeometry(0.04, 0.42, 0.02), std(0x111827), 0, 0.52, -(torsoR + 0.035));
      break;
    }
    case 'aodai': {
      // Tà áo dài trước / sau
      const front = add(g, new THREE.BoxGeometry(0.32, 0.02, 0.62), top, 0, 0.27, -0.42);
      const back = add(g, new THREE.BoxGeometry(0.36, 0.62, 0.02), top, 0, -0.02, 0.17);
      if (pose === 'stand') { front.rotation.x = Math.PI / 2; front.position.set(0, -0.06, -0.15); }
      else front.position.y = 0.3;
      back.rotation.x = 0.08;
      const collar = add(g, new THREE.CylinderGeometry(0.1, 0.11, 0.07, 14), trim, 0, 0.87, -0.02);
      collar.scale.z = 1.05;
      break;
    }
    case 'collar': {
      const col = add(g, new THREE.BoxGeometry(0.5, 0.02, 0.3), trim, 0, 0.84, 0.14);
      col.rotation.x = -0.35;
      const tie = add(g, new THREE.ConeGeometry(0.06, 0.16, 3), std(0xdc2626), 0, 0.74, -0.25);
      tie.rotation.x = Math.PI;
      break;
    }
    case 'stripes': {
      for (const y of [0.36, 0.56, 0.74]) { const r = add(g, new THREE.TorusGeometry(torsoR + 0.005, 0.015, 6, 20), trim, 0, y, 0); r.rotation.x = Math.PI / 2; }
      add(g, new THREE.BoxGeometry(0.12, 0.16, 0.08), std(0x64748b, { metalness: 0.6 }), 0, 0.58, 0.28); // bình dưỡng khí
      break;
    }
    case 'belt': {
      const b = add(g, new THREE.TorusGeometry(torsoR + 0.01, 0.035, 8, 22), trim, 0, 0.3, 0);
      b.rotation.x = Math.PI / 2;
      add(g, new THREE.SphereGeometry(0.06, 12, 8), std(0xef4444, { emissive: 0x7f1d1d, emissiveIntensity: 0.5 }), 0, 0.3, -(torsoR + 0.04));
      const cape = add(g, new THREE.BoxGeometry(0.44, 0.75, 0.02), std(0xb91c1c), 0, 0.4, torsoR + 0.02);
      cape.rotation.x = 0.06;
      break;
    }
    case 'armor': {
      for (const sx of [-1, 1]) {
        const pad = add(g, new THREE.SphereGeometry(0.13, 14, 10), trim, sx * 0.27, 0.8, 0);
        pad.scale.set(1.1, 0.7, 1);
        for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(0.03, 0.12, 5), trim, sx * (0.25 + i * 0.05), 0.9, -0.04 + i * 0.04);
      }
      const plate = add(g, new THREE.SphereGeometry(torsoR + 0.02, 18, 12, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.2, Math.PI * 0.5), trim, 0, 0.55, 0);
      plate.material.side = THREE.DoubleSide;
      break;
    }
    default:
  }
}

// look: diện mạo; opts.shirtColor: dùng cho người chơi cũ chưa có diện mạo (giữ màu áo cũ).
export function buildCharacter(rawLook = DEFAULT_LOOK, { pose = 'sit', shirtColor = null } = {}) {
  const look = { ...DEFAULT_LOOK, ...(rawLook || {}) };
  const female = look.gender === 'nu';
  const outfit = OUTFITS.find((o) => o.id === look.outfit) || OUTFITS[0];
  const skin = std(SKINS[look.skin] || SKINS[0], { roughness: 0.6 });
  const hairMat = std(HAIR_COLORS[look.hairColor] || HAIR_COLORS[0], { roughness: 0.55 });
  const shirt = std(shirtColor || outfit.top, outfit.glow ? { emissive: outfit.top, emissiveIntensity: 0.12, metalness: 0.3, roughness: 0.45 } : {});
  const pants = std(outfit.bottom);
  const shoe = std(0x3b2a1e);
  const g = new THREE.Group();
  const torsoR = female ? 0.235 : 0.26;

  // Thân, cổ, đầu
  const body = add(g, new THREE.CapsuleGeometry(torsoR, 0.42, 4, 12), shirt, 0, 0.5, 0);
  add(g, new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), skin, 0, 0.86, -0.01);
  add(g, new THREE.SphereGeometry(0.2, 22, 16), skin, 0, HEAD_Y, HEAD_Z);
  // Mặt: mắt, má, miệng (mặt nhìn về -z)
  const eye = std(0x111827, { roughness: 0.2 });
  const white = std(0xffffff, { roughness: 0.2 });
  for (const sx of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.026, 10, 8), eye, sx * 0.07, HEAD_Y + 0.02, HEAD_Z - 0.185);
    add(g, new THREE.SphereGeometry(0.009, 6, 4), white, sx * 0.07 + 0.008, HEAD_Y + 0.03, HEAD_Z - 0.208);
    const cheek = add(g, new THREE.SphereGeometry(0.03, 8, 6), std(0xf9a8b8, { transparent: true, opacity: female ? 0.85 : 0.5 }), sx * 0.11, HEAD_Y - 0.04, HEAD_Z - 0.16);
    cheek.scale.z = 0.4;
    if (female) { const lash = add(g, new THREE.BoxGeometry(0.05, 0.008, 0.01), eye, sx * 0.075, HEAD_Y + 0.055, HEAD_Z - 0.19); lash.rotation.z = sx * -0.25; }
  }
  const smile = add(g, new THREE.TorusGeometry(0.04, 0.009, 6, 14, Math.PI), std(female ? 0xdb2777 : 0x7f1d1d), 0, HEAD_Y - 0.06, HEAD_Z - 0.19);
  smile.rotation.z = Math.PI;
  addHair(g, look, hairMat);
  addHat(g, look);

  // Tay (có bàn tay) – ngồi: đưa ra trước cầm cần; đứng: buông xuôi
  const arms = [-1, 1].map((sx) => {
    const arm = new THREE.Group();
    add(arm, new THREE.CapsuleGeometry(0.07, 0.4, 3, 8), shirt, 0, -0.2, 0);
    add(arm, new THREE.SphereGeometry(0.06, 10, 8), skin, 0, -0.46, 0);
    arm.position.set(sx * (torsoR - 0.02), 0.8, -0.04);
    if (pose === 'sit') arm.rotation.set(0.95, 0, -sx * 0.3); // hai tay đưa ra trước, gặp nhau ở cán cần
    else arm.rotation.set(0, 0, sx * 0.18);
    g.add(arm);
    return arm;
  });

  // Chân
  for (const sx of [-1, 1]) {
    if (pose === 'sit') {
      const thigh = add(g, new THREE.CapsuleGeometry(0.1, 0.32, 3, 8), pants, sx * 0.13, 0.17, -0.16);
      thigh.rotation.x = Math.PI / 2;
      const shin = add(g, new THREE.CapsuleGeometry(0.09, 0.5, 3, 8), pants, sx * 0.13, -0.05, -0.32);
      shin.rotation.x = sx < 0 ? 0.25 : 0.15;
      add(g, new THREE.BoxGeometry(0.14, 0.08, 0.22), shoe, sx * 0.13, -0.36, -0.42);
    } else {
      add(g, new THREE.CapsuleGeometry(0.1, 0.62, 3, 8), pants, sx * 0.12, -0.2, 0);
      add(g, new THREE.BoxGeometry(0.14, 0.08, 0.24), shoe, sx * 0.12, -0.58, -0.04);
    }
  }
  addOutfitExtras(g, outfit, pose, torsoR);
  g.userData = { body, armL: arms[0], armR: arms[1], look };
  return g;
}

export function disposeCharacter(g) {
  g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
}

// ---------------------------------------------------------------------------
// Khung xem trước nhân vật (Tủ đồ): xoay tự động, kéo để xoay.
// ---------------------------------------------------------------------------
let viewer = null;
export function getAvatarViewer() {
  if (viewer) return viewer;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'avatar-viewer';
  canvas.style.touchAction = 'none';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 0.75, 5);
  camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x334155, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe9ff, 1.4);
  rim.position.set(-2, 2, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshStandardMaterial({ color: 0x1d4e6e, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.62;
  floor.receiveShadow = true;
  scene.add(floor);
  const holder = new THREE.Group();
  scene.add(holder);
  let char = null;
  let running = false;
  let yaw = Math.PI + 0.5;
  let drag = null;
  let idle = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; idle = 0; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; });
  const stop = () => { drag = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  function resize() {
    const w = canvas.parentElement?.clientWidth || 260;
    const h = canvas.parentElement?.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const clock = new THREE.Clock();
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (!drag) { idle += dt; if (idle > 1.2) yaw += dt * 0.6; }
    holder.rotation.y = yaw;
    if (char) {
      char.userData.body.scale.y = 1 + Math.sin(t * 2) * 0.015;
      char.userData.armL.rotation.x = Math.sin(t * 1.6) * 0.08;
      char.userData.armR.rotation.x = -Math.sin(t * 1.6) * 0.08;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  viewer = {
    show(container, look) {
      container.appendChild(canvas);
      this.update(look);
      resize();
      if (!running) { running = true; clock.getDelta(); requestAnimationFrame(loop); }
    },
    update(look) {
      if (char) { holder.remove(char); disposeCharacter(char); }
      char = buildCharacter(look, { pose: 'stand' });
      holder.add(char);
    },
    hide() { running = false; canvas.remove(); },
    resize,
  };
  return viewer;
}
