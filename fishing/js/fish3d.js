// Cá "4D": mô hình 3D riêng cho từng loài + chuyển động bơi theo thời gian
// (thân uốn lượn, đuôi và vây vẫy), dùng chung bảng màu/hoa văn với hình SVG (art.js).
// - buildFish3D(fishId): tạo Group cá, gọi group.userData.swim(t, strength) mỗi khung hình.
// - createFishViewer(): một khung xem 3D dùng chung (kéo để xoay, hào quang, bong bóng, tia sáng).
import * as THREE from '../vendor/three.module.min.js';
import { LOOK } from './art.js';
import { fishById, rarityOf, rarityIndex } from './data.js';

// Kích thước thân (dài, cao, dày) theo dáng.
const DIM = {
  classic: [1, 0.42, 0.22], round: [0.85, 0.56, 0.26], long: [1.15, 0.32, 0.2], koi: [1, 0.45, 0.25],
  eel: [1.6, 0.17, 0.14], flat: [0.72, 0.74, 0.14], sword: [1.05, 0.34, 0.21], lantern: [0.82, 0.58, 0.4],
  puffer: [0.8, 0.7, 0.6], dragon: [1.15, 0.42, 0.25],
};

// Vẽ da cá lên canvas: chuyển màu lưng → bụng + hoa văn (đối xứng hai bên thân).
function skinTexture(look) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, look.top); grd.addColorStop(0.5, look.top); grd.addColorStop(0.78, look.belly); grd.addColorStop(1, look.belly);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // p: 0 = đuôi, 1 = đầu; vẽ ở cả hai bên thân (u = p/2 và u = 1 - p/2).
  const both = (p, fn) => { fn(p * 0.5 * W); fn((1 - p * 0.5) * W); };
  g.globalAlpha = 0.5;
  g.fillStyle = look.fin; g.strokeStyle = look.fin;
  if (look.pattern === 'stripes' || look.pattern === 'bands') {
    for (const p of [0.3, 0.45, 0.6, 0.75]) both(p, (x) => { g.fillRect(x - (look.pattern === 'bands' ? 10 : 6), 30, look.pattern === 'bands' ? 20 : 12, 120); });
  } else if (look.pattern === 'spots') {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 26; i++) { const p = 0.15 + rnd() * 0.7; const y = 40 + rnd() * 110; const r = 4 + rnd() * 7; both(p, (x) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
  } else if (look.pattern === 'scales') {
    g.lineWidth = 2.5; g.globalAlpha = 0.45;
    for (let y = 30; y < 170; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < W; x += 16) { g.beginPath(); g.arc(x, y, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  } else if (look.pattern === 'rainbow') {
    g.globalAlpha = 0.6;
    ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'].forEach((col, i) => { g.fillStyle = col; both(0.2 + i * 0.14, (x) => g.fillRect(x - 9, 20, 18, 150)); });
  } else if (look.pattern === 'glow') {
    g.globalAlpha = 1; g.fillStyle = '#a5f3fc';
    for (const [p, y] of [[0.3, 90], [0.45, 70], [0.55, 110], [0.7, 85], [0.8, 120], [0.38, 125]]) both(p, (x) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
  }
  // Ánh bóng lưng
  g.globalAlpha = 0.18; g.fillStyle = '#fff'; g.fillRect(0, 48, W, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function finShape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return new THREE.ShapeGeometry(s, 8);
}

export function buildFish3D(fishId) {
  const fish = fishById(fishId);
  const look = LOOK[fishId] || { shape: 'classic', top: '#6b8fa8', belly: '#eef4f8', fin: '#4d6f88', pattern: 'none' };
  const tier = fish ? rarityIndex(fish.rarity) : 0;
  const glowColor = new THREE.Color(rarityOf(fish?.rarity || 'common').color);
  const [lx, ly, lz] = DIM[look.shape] || DIM.classic;
  const root = new THREE.Group();

  // ---- Thân: hình cầu kéo dài, thon dần về đuôi ----
  const geo = new THREE.SphereGeometry(1, 56, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * lx; let y = pos.getY(i) * ly; let z = pos.getZ(i) * lz;
    if (x < 0) { const k = 1 - 0.62 * Math.pow(-x / lx, 1.6); y *= k; z *= k; }
    else if (look.shape !== 'flat') { const k = 1 - 0.18 * Math.pow(x / lx, 3); y *= k; }
    if (y < 0) y *= look.shape === 'lantern' ? 1.1 : 0.92;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const base = Float32Array.from(pos.array);
  const skin = new THREE.MeshPhysicalMaterial({
    map: skinTexture(look), roughness: 0.35, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.25,
    emissive: tier >= 4 || look.pattern === 'glow' ? glowColor : new THREE.Color(0), emissiveIntensity: tier >= 4 ? 0.18 + (tier - 4) * 0.12 : look.pattern === 'glow' ? 0.15 : 0,
  });
  const body = new THREE.Mesh(geo, skin);
  root.add(body);

  const finMat = new THREE.MeshPhysicalMaterial({
    color: look.fin, roughness: 0.4, transparent: true, opacity: 0.9, side: THREE.DoubleSide, clearcoat: 0.4,
    emissive: tier >= 4 ? glowColor : new THREE.Color(0), emissiveIntensity: tier >= 4 ? 0.25 : 0,
  });

  // ---- Đuôi (trục xoay ở cuống đuôi) ----
  const tail = new THREE.Group();
  tail.position.x = -lx * 0.96;
  const tailH = Math.max(0.32, ly * 0.95);
  const tailMesh = new THREE.Mesh(look.shape === 'eel'
    ? finShape([[0, 0], [-0.35, 0.12], [-0.45, 0], [-0.35, -0.12]])
    : finShape([[0.05, 0], [-0.45, tailH], [-0.32, 0.05], [-0.32, -0.05], [-0.45, -tailH * 0.9]]), finMat);
  tail.add(tailMesh);
  root.add(tail);

  // ---- Vây lưng, vây bụng, vây ngực ----
  const dorsal = new THREE.Mesh(look.shape === 'eel'
    ? finShape([[-1.4, 0], [1.2, 0], [1.1, 0.08], [-1.3, 0.1]])
    : finShape([[-lx * 0.45, 0], [lx * 0.3, 0], [-lx * 0.05, ly * 0.75], [-lx * 0.35, ly * 0.55]]), finMat);
  dorsal.position.y = ly * 0.86;
  root.add(dorsal);
  if (look.shape === 'flat') {
    const anal = dorsal.clone();
    anal.scale.y = -1; anal.position.y = -ly * 0.86;
    root.add(anal);
  } else {
    const belly = new THREE.Mesh(finShape([[-lx * 0.55, 0], [-lx * 0.15, 0], [-lx * 0.4, -ly * 0.4]]), finMat);
    belly.position.y = -ly * 0.75;
    root.add(belly);
  }
  const pecs = [1, -1].map((side) => {
    const p = new THREE.Mesh(finShape([[0, 0], [-0.32, -0.12], [-0.22, 0.04]]), finMat);
    p.position.set(lx * 0.42, -ly * 0.25, side * lz * 0.82);
    p.rotation.y = side * 0.5;
    root.add(p);
    return p;
  });

  // ---- Mắt ----
  const ex = lx * (look.shape === 'eel' ? 0.82 : 0.66);
  const ey = ly * 0.22;
  const ez = lz * Math.sqrt(Math.max(0.05, 1 - (ex / lx) ** 2 - (ey / ly) ** 2)) * 0.98;
  const eyeR = Math.min(0.11, ly * 0.22);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.1, metalness: 0.3 });
  for (const side of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 12), white);
    e.position.set(ex, ey, side * ez);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.6, 14, 10), black);
    pupil.position.set(eyeR * 0.15, 0, side * eyeR * 0.55);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.2, 8, 6), white);
    shine.position.set(eyeR * 0.35, eyeR * 0.3, side * eyeR * 0.95);
    e.add(pupil, shine);
    root.add(e);
  }

  // ---- Chi tiết đặc trưng ----
  const extras = new THREE.Group();
  root.add(extras);
  const outlineMat = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.6 });
  if (look.pattern === 'whiskers' || look.shape === 'koi' || look.shape === 'dragon') {
    for (const side of [1, -1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lx * 0.95, -ly * 0.2, side * lz * 0.3), new THREE.Vector3(lx * 1.15, -ly * 0.45, side * lz * 0.9),
        new THREE.Vector3(lx * 1.05, -ly * 0.9, side * lz * 1.3),
      ]);
      extras.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 5), look.shape === 'dragon' ? finMat : outlineMat));
    }
  }
  if (look.shape === 'sword') {
    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.75, 8), new THREE.MeshStandardMaterial({ color: look.top, roughness: 0.4 }));
    bill.rotation.z = -Math.PI / 2;
    bill.position.x = lx + 0.32;
    extras.add(bill);
  }
  let lure = null;
  if (look.shape === 'lantern') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(lx * 0.3, ly * 0.85, 0), new THREE.Vector3(lx * 0.7, ly * 1.6, 0), new THREE.Vector3(lx * 1.25, ly * 1.3, 0)]);
    extras.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.015, 5), outlineMat));
    lure = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 2.5 }));
    lure.position.set(lx * 1.25, ly * 1.25, 0);
    extras.add(lure);
    const l = new THREE.PointLight(0xfde047, 2.5, 2.5);
    l.position.copy(lure.position);
    extras.add(l);
  }
  if (look.shape === 'dragon') {
    for (const side of [1, -1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 8), finMat);
      horn.position.set(lx * 0.62, ly * 0.95, side * lz * 0.45);
      horn.rotation.set(side * 0.3, 0, -0.7);
      extras.add(horn);
    }
  }

  // ---- Bơi: uốn thân theo sóng, đầu gần như đứng yên, đuôi vẫy mạnh ----
  const arr = pos.array;
  const len = lx * 2;
  const wave = (x, t, amp) => {
    const s = Math.max(0, (lx - x) / len); // 0 ở đầu → 1 ở đuôi
    return amp * Math.pow(s, 1.6) * Math.sin(t * 7 - s * 3.4);
  };
  root.userData = {
    tier, tail, lx, ly, lure,
    swim(t, strength = 1) {
      const amp = (look.shape === 'eel' ? 0.32 : 0.16) * strength;
      for (let i = 0; i < arr.length; i += 3) arr[i + 2] = base[i + 2] + wave(base[i], t, amp);
      pos.needsUpdate = true;
      const tz = wave(-lx * 0.96, t, amp);
      tail.position.z = tz;
      tail.rotation.y = -Math.atan2(wave(-lx, t, amp) - wave(-lx * 0.8, t, amp), lx * 0.2) * 1.6 - Math.sin(t * 7 - 3.4) * 0.35 * strength;
      dorsal.rotation.y = -wave(0, t, amp) * 0.8;
      pecs.forEach((p, i) => { p.rotation.z = Math.sin(t * 5 + i * 1.5) * 0.4; });
      extras.position.z = wave(lx, t, amp);
      if (lure) lure.material.emissiveIntensity = 2 + Math.sin(t * 4) * 1;
    },
  };
  return root;
}

// ===================================================================
// Khung xem cá 4D: dùng chung một renderer, chuyển canvas vào chỗ cần hiện.
// ===================================================================
let viewer = null;

export function getFishViewer() {
  if (viewer) return viewer;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'fish-viewer';
  canvas.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.25, 4.6);
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x1b2433, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2);
  rim.position.set(-3, 1.5, -3);
  scene.add(key, rim);

  // Hào quang phía sau
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gc = glowCanvas.getContext('2d');
  const rg = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = rg; gc.fillRect(0, 0, 128, 128);
  const dot = new THREE.CanvasTexture(glowCanvas);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.scale.set(4, 2.6, 1);
  aura.position.z = -1;
  scene.add(aura);

  // Tia lấp lánh bay quanh + bong bóng nước bay lên
  const N = 90;
  const sparkGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(N * 3);
  const seeds = Array.from({ length: N }, () => [Math.random() * 6.28, 0.9 + Math.random() * 0.9, (Math.random() - 0.5) * 1.6, 0.3 + Math.random()]);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.09, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparks);
  const B = 26;
  const bubGeo = new THREE.BufferGeometry();
  const bp = new Float32Array(B * 3);
  const bseed = Array.from({ length: B }, () => [(Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.4]);
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ size: 0.07, color: 0xdff6ff, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(bubbles);

  const holder = new THREE.Group();
  scene.add(holder);
  let fish = null;
  let tier = 0;
  let running = false;
  let yaw = -0.5;
  let pitch = 0.12;
  let dragging = null;
  let idle = 0;

  canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY, yaw, pitch }; idle = 0; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw = dragging.yaw + (e.clientX - dragging.x) * 0.012;
    pitch = Math.max(-0.8, Math.min(0.8, dragging.pitch + (e.clientY - dragging.y) * 0.008));
  });
  const stop = () => { dragging = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  function resize() {
    const w = canvas.parentElement?.clientWidth || 300;
    const h = canvas.parentElement?.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (!dragging) { idle += dt; if (idle > 1.5) yaw += dt * 0.5; }
    if (fish) {
      fish.userData.swim(t, 1);
      holder.rotation.set(pitch, yaw, Math.sin(t * 1.3) * 0.05);
      holder.position.y = Math.sin(t * 1.6) * 0.06;
    }
    aura.material.opacity = 0.35 + tier * 0.1 + Math.sin(t * 2) * 0.08;
    for (let i = 0; i < N; i++) {
      const [a, r, y, s] = seeds[i];
      const ang = a + t * s * 0.6;
      sp[i * 3] = Math.cos(ang) * r * 1.3;
      sp[i * 3 + 1] = y + Math.sin(t * s + a) * 0.15;
      sp[i * 3 + 2] = Math.sin(ang) * r * 0.6;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < B; i++) {
      const [x, off, z, s] = bseed[i];
      bp[i * 3] = x + Math.sin(t * 2 + off * 3) * 0.05;
      bp[i * 3 + 1] = -1.3 + ((off + t * s) % 2.8);
      bp[i * 3 + 2] = z;
    }
    bubGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  viewer = {
    // Gắn khung xem vào phần tử container và hiện cá.
    show(container, fishId) {
      container.appendChild(canvas);
      if (fish) { holder.remove(fish); fish.traverse((o) => { o.geometry?.dispose(); }); }
      fish = buildFish3D(fishId);
      tier = fish.userData.tier;
      const s = 1.55 / Math.max(fish.userData.lx * 2.2, fish.userData.ly * 3);
      fish.scale.setScalar(s * 1.6);
      holder.add(fish);
      const col = new THREE.Color(rarityOf(fishById(fishId)?.rarity || 'common').color);
      aura.material.color.copy(col);
      sparks.material.color.copy(col);
      sparks.visible = tier >= 2;
      sparkGeo.setDrawRange(0, Math.round(N * (0.3 + tier * 0.14)));
      rim.color.copy(col).lerp(new THREE.Color(0xffffff), 0.4);
      yaw = -0.5; pitch = 0.12; idle = 0;
      resize();
      if (!running) { running = true; clock.getDelta(); requestAnimationFrame(loop); }
    },
    hide() { running = false; canvas.remove(); },
    resize,
  };
  return viewer;
}
