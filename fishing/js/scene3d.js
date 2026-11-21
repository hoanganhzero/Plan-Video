// Cảnh câu cá 3D (Three.js / WebGL): mặt nước có sóng, phản chiếu trời và nắng, cầu gỗ,
// người câu đội nón lá, cần câu – dây – phao, cá 3D bơi dưới nước, nước bắn, gợn sóng,
// cảnh vật riêng cho từng khu. Cùng giao diện với scene.js (bản 2D dự phòng):
// setZone(zone) · cast() · bite() · reel(emoji, color, fish) · escape() · phase
import * as THREE from '../vendor/three.module.min.js';
import { buildFish3D } from './fish3d.js';
import { buildCharacter, disposeCharacter } from './avatar3d.js';
import { DEFAULT_LOOK } from './data.js';

const CAST_MS = 750;
const REEL_MS = 1100;

// Sóng lớn (vừa làm cong mặt nước vừa cho phao nhấp nhô) – công thức giống hệt trong shader.
const BIG_WAVES = [
  [1.0, 0.3, 0.10, 0.35, 1.1],
  [-0.4, 1.0, 0.07, 0.55, 1.4],
  [0.7, -0.8, 0.04, 1.1, 2.0],
].map(([x, z, a, f, s]) => { const l = Math.hypot(x, z); return [x / l, z / l, a, f, s]; });

const THEMES = {
  pond: {
    top: 0x2f86e0, horizon: 0xd6ecf7, sun: 0xfff1d0, sunDir: [0.5, 0.55, -0.65], sunI: 2.2,
    shallow: 0x3f9a8c, deep: 0x15464f, amp: 0.6, hemiGround: 0x5a7d3a, fogNear: 40, fogFar: 150,
  },
  river: {
    top: 0x6f9fd8, horizon: 0xffd2a0, sun: 0xffc27a, sunDir: [-0.7, 0.25, -0.6], sunI: 2.4,
    shallow: 0x6f9a5c, deep: 0x23432c, amp: 0.8, hemiGround: 0x7a6a3a, fogNear: 35, fogFar: 140,
  },
  lake: {
    top: 0x3e6fc0, horizon: 0xdde7f6, sun: 0xffffff, sunDir: [0.3, 0.7, -0.6], sunI: 2.0,
    shallow: 0x3c9ac0, deep: 0x0d3150, amp: 0.5, hemiGround: 0x46604a, fogNear: 70, fogFar: 300,
  },
  sea: {
    top: 0x1570d6, horizon: 0xc4e6ff, sun: 0xfff6e0, sunDir: [-0.4, 0.6, -0.7], sunI: 2.6,
    shallow: 0x18a8c8, deep: 0x05345e, amp: 1.8, hemiGround: 0x3a6e8a, fogNear: 60, fogFar: 220,
  },
  abyss: {
    top: 0x04041a, horizon: 0x2a2266, sun: 0x9fb4ff, sunDir: [0.3, 0.5, -0.8], sunI: 0.7,
    shallow: 0x2442a8, deep: 0x02061a, amp: 1.2, hemiGround: 0x120a30, fogNear: 30, fogFar: 140,
  },
  mangrove: {
    top: 0x7fae9a, horizon: 0xe6efd2, sun: 0xfff2c8, sunDir: [0.4, 0.45, -0.7], sunI: 2.0,
    shallow: 0x6b8a4a, deep: 0x26391f, amp: 0.4, hemiGround: 0x4a5a2a, fogNear: 25, fogFar: 110,
  },
  coral: {
    top: 0x0ea5e9, horizon: 0xcffafe, sun: 0xfffbe8, sunDir: [-0.3, 0.75, -0.6], sunI: 2.7,
    shallow: 0x2dd4bf, deep: 0x0b5f7a, amp: 0.9, hemiGround: 0xe8d39b, fogNear: 70, fogFar: 260,
  },
  ice: {
    top: 0x5f86c4, horizon: 0xeef4ff, sun: 0xe8f0ff, sunDir: [0.2, 0.35, -0.9], sunI: 1.7,
    shallow: 0x5fb4d8, deep: 0x0c3a5c, amp: 0.7, hemiGround: 0xc8d6e8, fogNear: 80, fogFar: 420,
  },
  volcano: {
    top: 0x2a0606, horizon: 0xff7a3a, sun: 0xff8a4a, sunDir: [-0.2, 0.3, -0.9], sunI: 1.6,
    shallow: 0xff6a1a, deep: 0x3a0800, amp: 0.5, hemiGround: 0x2a0a05, fogNear: 50, fogFar: 340,
  },
};

const RARITY_FISH = {
  common: { body: 0x8a9a7a, fin: 0x5f6d52 },
  uncommon: { body: 0x6bbf59, fin: 0x3d8a35 },
  rare: { body: 0x3b82f6, fin: 0x1e4fb8 },
  epic: { body: 0xa855f7, fin: 0x6b21a8 },
  legendary: { body: 0xf6b928, fin: 0xd97706, glow: 0.35 },
  mythic: { body: 0xef4444, fin: 0xfbbf24, glow: 0.6 },
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export function createScene3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd6ecf7, 40, 150);
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 600);

  // ---------- Ánh sáng ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7d3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // ---------- Bầu trời ----------
  const skyUniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uNight: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uSunDir, uSunColor; uniform float uNight; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
          if (vDir.y < 0.0) col = uHorizon;
          float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(d, 900.0) * 6.0 + pow(d, 12.0) * 0.25 * (1.0 - uNight * 0.5));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // ---------- Mặt nước ----------
  const waveGLSL = BIG_WAVES.map(([x, z, a, f, s]) => `vec4(${x.toFixed(4)}, ${z.toFixed(4)}, ${a.toFixed(3)}, ${f.toFixed(3)}), `).join('');
  const waveSpeed = BIG_WAVES.map((w) => w[4].toFixed(2)).join(', ');
  const waterUniforms = {
    uTime: { value: 0 }, uAmp: { value: 1 },
    uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
    uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() }, uFogNear: { value: 40 }, uFogFar: { value: 150 },
    uGlow: { value: 0 },
  };
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: waterUniforms,
    vertexShader: `
      uniform float uTime, uAmp; varying vec3 vWorld; varying float vH;
      const vec4 W[3] = vec4[3](${waveGLSL.slice(0, -2)});
      const float S[3] = float[3](${waveSpeed});
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0;
        for (int i = 0; i < 3; i++) h += W[i].z * uAmp * sin(dot(W[i].xy, wp.xz) * W[i].w + uTime * S[i]);
        wp.y += h; vH = h; vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime, uAmp, uFogNear, uFogFar, uGlow;
      uniform vec3 uShallow, uDeep, uSkyTop, uSkyHorizon, uSunDir, uSunColor, uFogColor;
      varying vec3 vWorld; varying float vH;
      const vec4 W[3] = vec4[3](${waveGLSL.slice(0, -2)});
      const float S[3] = float[3](${waveSpeed});
      void addWave(vec2 p, vec2 d, float a, float f, float s, inout vec2 g){
        g += a * f * d * cos(dot(d, p) * f + uTime * s);
      }
      void main(){
        vec2 p = vWorld.xz; vec2 g = vec2(0.0);
        for (int i = 0; i < 3; i++) addWave(p, W[i].xy, W[i].z * uAmp, W[i].w, S[i], g);
        addWave(p, normalize(vec2(0.2, 1.0)), 0.016, 2.7, 2.6, g);
        addWave(p, normalize(vec2(-1.0, 0.15)), 0.011, 4.3, 3.1, g);
        addWave(p, normalize(vec2(0.6, 0.6)), 0.007, 7.5, 4.2, g);
        addWave(p, normalize(vec2(-0.5, -0.9)), 0.004, 13.0, 5.0, g);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 skyCol = mix(uSkyHorizon, uSkyTop, pow(clamp(r.y, 0.0, 1.0), 0.6));
        float depthMix = clamp(0.35 + vH * 2.0, 0.0, 1.0);
        vec3 body = mix(uDeep, uShallow, depthMix * (0.6 + 0.4 * max(n.y, 0.0)));
        vec3 col = mix(body, skyCol, clamp(fres * 1.1, 0.0, 1.0));
        float spec = pow(max(dot(r, normalize(uSunDir)), 0.0), 220.0);
        col += uSunColor * spec * 3.0;
        float foam = smoothstep(0.12, 0.22, vH / max(uAmp, 0.3));
        col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.35);
        col += uShallow * uGlow * (0.5 + 0.5 * sin(p.x * 0.7 + uTime) * sin(p.y * 0.6 - uTime * 0.8));
        float dist = length(cameraPosition - vWorld);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(col, mix(0.78, 1.0, clamp(fres + smoothstep(5.0, 14.0, dist), 0.0, 1.0)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 220, 220).rotateX(-Math.PI / 2), waterMat);
  water.position.z = -60;
  scene.add(water);

  const time = { t: 0 };
  function waveHeight(x, z) {
    let h = 0;
    for (const [dx, dz, a, f, s] of BIG_WAVES) h += a * waterUniforms.uAmp.value * Math.sin((dx * x + dz * z) * f + time.t * s);
    return h;
  }

  // ---------- Vật liệu dùng chung ----------
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
  const M = {
    wood: mat(0x8b5a2b), woodDark: mat(0x5e3b1c), skin: mat(0xf0c08a, { flatShading: false }), shirt: mat(0x2f6db5),
    pants: mat(0x2b2b38), hat: mat(0xe9d39a), rod: mat(0x3b2614, { roughness: 0.5 }),
    leaf: mat(0x4f9a3a), leafDark: mat(0x2f6e35), pine: mat(0x2c5e3f), trunk: mat(0x6b4423), grass: mat(0x6aa84f),
    rock: mat(0x7c7f86), rockDark: mat(0x2b2d40), sand: mat(0xe8d39b), snow: mat(0xf4f8ff), mountain: mat(0x667a8a),
    lotus: mat(0xf28bb1), pad: mat(0x3f8f3a), bamboo: mat(0x8cbf45), field: mat(0x9ccc65), roof: mat(0x9b6b3a),
  };
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const mesh = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); return m; };

  // ---------- Cầu gỗ ----------
  const dock = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const plank = shadowed(mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), i % 3 ? M.wood : M.woodDark, 0, 0.7, 7 - i * 0.55));
    plank.rotation.y = (Math.sin(i * 12.9) * 0.02);
    dock.add(plank);
  }
  for (const z of [-2.0, 1.2, 4.4, 7.4]) {
    for (const x of [-0.95, 0.95]) dock.add(shadowed(mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 7), M.woodDark, x, -0.7, z)));
  }
  // Đèn lồng ở đầu cầu
  const lanternPost = shadowed(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), M.woodDark, 0.95, 1.4, 2.4));
  const lantern = mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9d2e, emissiveIntensity: 1.2 }), 0.95, 2.15, 2.4);
  const lanternLight = new THREE.PointLight(0xffb15c, 0, 9, 1.6);
  lanternLight.position.set(0.95, 2.1, 2.4);
  dock.add(lanternPost, lantern, lanternLight);
  // Thùng cá trên cầu
  const bucketMesh = shadowed(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.42, 12, 1, true), mat(0x4a7fb5, { side: THREE.DoubleSide }), 0.75, 0.95, -0.4));
  dock.add(bucketMesh);
  scene.add(dock);

  // ---------- Người câu (diện mạo theo Tủ đồ: nam/nữ, tóc, trang phục, mũ) ----------
  const fisher = new THREE.Group();
  fisher.position.set(0, 0.74, -1.7);
  let character = buildCharacter(DEFAULT_LOOK, { pose: 'sit' });
  let body = character.userData.body;
  fisher.add(character);
  function setLook(look) {
    fisher.remove(character);
    disposeCharacter(character);
    character = buildCharacter(look, { pose: 'sit' });
    body = character.userData.body;
    fisher.add(character);
  }

  // Cần câu: trục quay ở tay
  const rodPivot = new THREE.Group();
  rodPivot.position.set(0, 0.5, -0.45);
  const ROD_LEN = 3.8;
  const rodMesh = shadowed(mesh(new THREE.CylinderGeometry(0.014, 0.045, ROD_LEN, 6), M.rod, 0, ROD_LEN / 2, 0));
  const reelMesh = shadowed(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), mat(0x9ca3af, { metalness: 0.6, roughness: 0.3 }), 0.07, 0.35, 0));
  reelMesh.rotation.z = Math.PI / 2;
  rodPivot.add(rodMesh, reelMesh);
  const rodBase = new THREE.Euler(-0.95, 0, -0.3);
  rodPivot.rotation.copy(rodBase);
  fisher.add(rodPivot);
  scene.add(fisher);
  const tipPos = new THREE.Vector3();

  // ---------- Dây câu & phao ----------
  const LINE_PTS = 32;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  line.frustumCulled = false;
  scene.add(line);

  const bobber = new THREE.Group();
  const bobTop = mesh(new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xef2b2b, roughness: 0.35 }));
  const bobBot = mesh(new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  const bobStick = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0x553300 }), 0, 0.18, 0);
  bobber.add(bobTop, bobBot, bobStick);
  bobber.traverse((o) => { o.castShadow = true; });
  scene.add(bobber);

  // ---------- Cá 3D ----------
  function makeFish(bodyColor, finColor, glow = 0) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor, roughness: 0.35, metalness: 0.25, emissive: bodyColor, emissiveIntensity: glow,
    });
    const finMat = new THREE.MeshStandardMaterial({ color: finColor, roughness: 0.5, side: THREE.DoubleSide, emissive: finColor, emissiveIntensity: glow * 0.6 });
    const b = mesh(new THREE.SphereGeometry(0.5, 20, 14), bodyMat);
    b.scale.set(1, 0.48, 0.24);
    const tail = mesh(new THREE.ConeGeometry(0.28, 0.42, 4), finMat, -0.62, 0, 0);
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.25);
    const dorsal = mesh(new THREE.ConeGeometry(0.14, 0.32, 3), finMat, 0.02, 0.26, 0);
    dorsal.scale.set(1.4, 1, 0.2);
    dorsal.rotation.z = -0.4;
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const eyeL = mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat, 0.32, 0.06, 0.1);
    const eyeR = mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat, 0.32, 0.06, -0.1);
    g.add(b, tail, dorsal, eyeL, eyeR);
    g.userData.tail = tail;
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }

  // Bóng cá bơi dưới nước
  const swimmers = Array.from({ length: 9 }, (_, i) => {
    const f = makeFish(0x183040, 0x10222e);
    f.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; } });
    const s = 0.6 + Math.random() * 0.9;
    f.scale.setScalar(s);
    f.userData.path = { cx: 1 + Math.random() * 6 - 3, cz: -9 - Math.random() * 8, r: 2 + Math.random() * 4, speed: (0.15 + Math.random() * 0.25) * (i % 2 ? 1 : -1), phase: Math.random() * 6.28, depth: 0.5 + Math.random() * 1.2 };
    scene.add(f);
    return f;
  });

  // Cá câu được (tạo lại mỗi lần kéo)
  let caught = null;
  const caughtLight = new THREE.PointLight(0xffffff, 0, 6, 1.5);
  scene.add(caughtLight);

  // ---------- Nước bắn (hạt) ----------
  const P_MAX = 1400;
  const pPos = new Float32Array(P_MAX * 3).fill(-999);
  const pCol = new Float32Array(P_MAX * 3).fill(1);
  const pVel = new Float32Array(P_MAX * 3);
  const pLife = new Float32Array(P_MAX);
  const pGrav = new Float32Array(P_MAX).fill(9.8);
  const pFade = new Float32Array(P_MAX).fill(1.2);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const dctx = dot.getContext('2d');
  const grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  dctx.fillStyle = grad; dctx.fillRect(0, 0, 64, 64);
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.16, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false,
  }));
  particles.frustumCulled = false;
  particles.material.blending = THREE.AdditiveBlending;
  scene.add(particles);
  let pNext = 0;
  function splash(pos, count = 40, power = 1, color = new THREE.Color(0xe8f6ff), up = 3) {
    for (let k = 0; k < count; k++) {
      const i = pNext; pNext = (pNext + 1) % P_MAX;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.6) * power;
      pPos.set([pos.x, pos.y + 0.05, pos.z], i * 3);
      pVel.set([Math.cos(a) * sp, (up * 0.5 + Math.random() * up) * power, Math.sin(a) * sp], i * 3);
      pCol.set([color.r, color.g, color.b], i * 3);
      pLife[i] = 1;
      pGrav[i] = 9.8;
      pFade[i] = 1.2;
    }
  }

  // Hệ hạt hiệu ứng riêng (hạt to, phát sáng) cho kỹ năng và trang bị.
  const F_MAX = 1600;
  const fPos = new Float32Array(F_MAX * 3).fill(-999);
  const fCol = new Float32Array(F_MAX * 3).fill(1);
  const fVel = new Float32Array(F_MAX * 3);
  const fLife = new Float32Array(F_MAX);
  const fGrav = new Float32Array(F_MAX);
  const fFade = new Float32Array(F_MAX).fill(1);
  const fAlpha = new Float32Array(F_MAX);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  fGeo.setAttribute('alpha', new THREE.BufferAttribute(fAlpha, 1));
  // Shader hạt: kích thước theo khoảng cách, lõi sáng trắng + viền màu, mờ dần theo tuổi hạt.
  // Pha trộn thường (không cộng màu) nên giữ đúng màu lửa / vàng / xanh cả trên nền trời sáng.
  const fxPoints = new THREE.Points(fGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { uSize: { value: 0.5 }, uScale: { value: 600 } },
    vertexShader: `
      attribute float alpha; varying vec3 vCol; varying float vA; uniform float uSize; uniform float uScale;
      void main() {
        vCol = color; vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uScale / -mv.z * (0.6 + 0.4 * alpha);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float glow = pow(1.0 - d, 1.6);
        vec3 c = mix(vCol, vec3(1.0), pow(1.0 - d, 6.0) * 0.8);
        gl_FragColor = vec4(c * (1.0 + glow * 0.6), glow * vA);
        #include <colorspace_fragment>
      }`,
  }));
  fxPoints.frustumCulled = false;
  scene.add(fxPoints);
  let fNext = 0;
  function updateFx(dt) {
    for (let i = 0; i < F_MAX; i++) {
      if (fLife[i] <= 0) continue;
      fLife[i] -= dt * fFade[i];
      fVel[i * 3 + 1] -= fGrav[i] * dt;
      fPos[i * 3] += fVel[i * 3] * dt;
      fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt;
      fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt;
      fAlpha[i] = Math.max(0, Math.min(1, fLife[i] * 1.6));
      if (fLife[i] <= 0 || fPos[i * 3 + 1] < -0.5) { fLife[i] = 0; fAlpha[i] = 0; fPos[i * 3 + 1] = -999; }
    }
    fGeo.attributes.position.needsUpdate = true;
    fGeo.attributes.color.needsUpdate = true;
    fGeo.attributes.alpha.needsUpdate = true;
  }

  // Hạt hiệu ứng tuỳ biến (vệt sáng, lửa, lá, bong bóng…).
  // shape: 'sphere' toả đều | 'ring' toả ngang | 'up' phun lên | 'point' gần như đứng yên
  function burst(pos, count, color, { speed = 1.5, up = 0, gravity = 2, fade = 1, shape = 'sphere', jitter = 0, colors = null } = {}) {
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = fNext; fNext = (fNext + 1) % F_MAX;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      let vx; let vy; let vz;
      if (shape === 'ring') { vx = Math.cos(a) * speed; vy = up * (0.5 + Math.random() * 0.5); vz = Math.sin(a) * speed; }
      else if (shape === 'up') { vx = Math.cos(a) * speed * Math.random(); vy = up * (0.6 + Math.random() * 0.8); vz = Math.sin(a) * speed * Math.random(); }
      else if (shape === 'point') { vx = (Math.random() - 0.5) * speed; vy = up + (Math.random() - 0.5) * speed; vz = (Math.random() - 0.5) * speed; }
      else { const sp = speed * (0.4 + Math.random() * 0.8); vx = Math.sin(b) * Math.cos(a) * sp; vy = Math.cos(b) * sp + up; vz = Math.sin(b) * Math.sin(a) * sp; }
      fPos.set([pos.x + (Math.random() - 0.5) * jitter, pos.y + (Math.random() - 0.5) * jitter, pos.z + (Math.random() - 0.5) * jitter], i * 3);
      fVel.set([vx, vy, vz], i * 3);
      c.set(colors ? colors[k % colors.length] : color);
      fCol.set([c.r, c.g, c.b], i * 3);
      fLife[i] = 1;
      fAlpha[i] = 1;
      fGrav[i] = gravity;
      fFade[i] = fade * (0.8 + Math.random() * 0.4);
    }
  }
  // Ánh sáng loé khi dùng kỹ năng / kéo được cá.
  const fxLight = new THREE.PointLight(0xffffff, 0, 14, 1.4);
  scene.add(fxLight);
  function flash(pos, color, power = 8) {
    fxLight.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    fxLight.color.set(color);
    fxLight.intensity = power;
  }

  // ---------- Gợn sóng ----------
  const ripples = Array.from({ length: 14 }, () => {
    const r = mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    r.visible = false;
    scene.add(r);
    return r;
  });
  let rNext = 0;
  function ripple(x, z, strength = 1) {
    const r = ripples[rNext]; rNext = (rNext + 1) % ripples.length;
    r.position.set(x, waveHeight(x, z) + 0.02, z);
    r.userData = { born: time.t, strength };
    r.visible = true;
  }

  // ---------- Cảnh vật theo khu ----------
  function tree(x, z, s = 1, leaf = M.leaf) {
    const g = new THREE.Group();
    g.add(shadowed(mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 6), M.trunk, 0, 0.8 * s, 0)));
    for (const [dx, dy, r] of [[0, 2.0, 0.9], [0.4, 1.6, 0.6], [-0.35, 1.7, 0.65]]) {
      g.add(shadowed(mesh(new THREE.IcosahedronGeometry(r * s, 0), leaf, dx * s, dy * s, 0)));
    }
    g.position.set(x, 0.3, z);
    return g;
  }
  function pine(x, z, s = 1, y = 0.3) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.8 * s, 5), M.trunk, 0, 0.4 * s, 0));
    for (let i = 0; i < 3; i++) g.add(shadowed(mesh(new THREE.ConeGeometry((1.0 - i * 0.25) * s, 1.3 * s, 7), M.pine, 0, (0.9 + i * 0.6) * s, 0)));
    g.position.set(x, y, z);
    return g;
  }
  function bamboo(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const h = 3 + Math.random() * 2.5;
      const c = mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 5), M.bamboo, (Math.random() - 0.5) * 0.9, h / 2, (Math.random() - 0.5) * 0.9);
      c.rotation.z = (Math.random() - 0.5) * 0.2;
      g.add(c);
      g.add(mesh(new THREE.IcosahedronGeometry(0.5, 0), M.leaf, c.position.x, h, c.position.z));
    }
    g.position.set(x, 0.3, z);
    return g;
  }
  function rock(x, z, s, m = M.rock, y = 0) {
    const r = shadowed(mesh(new THREE.DodecahedronGeometry(s, 0), m, x, y, z));
    r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    r.scale.y = 0.7;
    return r;
  }
  function palm(x, y, z, s = 1) {
    const g = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 3 * s, 6), M.trunk, 0, 1.5 * s, 0);
    trunk.rotation.z = 0.15;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.25 * s, 1.8 * s, 4), M.leafDark, 0, 3 * s, 0);
      leaf.rotation.set(0, (i / 6) * Math.PI * 2, 1.9);
      leaf.position.x += 0.2;
      leaf.scale.z = 0.25;
      const holder = new THREE.Group();
      holder.add(leaf);
      holder.rotation.y = (i / 6) * Math.PI * 2;
      holder.position.set(0.22 * s, 0, 0);
      g.add(holder);
    }
    g.position.set(x, y, z);
    return g;
  }
  function mountain(x, z, r, h, snow = true, m = M.mountain) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(r, h, 7, 1), m, 0, h / 2, 0));
    if (snow) g.add(mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 7, 1), M.snow, 0, h * 0.84, 0));
    g.position.set(x, -0.5, z);
    return g;
  }
  function land(points, y = 0.25, m = M.grass, hole = null) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    if (hole) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: y + 1, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const l = mesh(geo, m, 0, -1, 0);
    l.receiveShadow = true;
    return l;
  }

  const decor = {};
  // Ao làng: bờ cỏ bao quanh, cây, sen, lục bình
  decor.pond = (() => {
    const g = new THREE.Group();
    g.add(land([[-110, 40], [110, 40], [110, -140], [-110, -140]], 0.25, M.grass,
      [[-22, 3], [22, 3], [26, -14], [19, -29], [0, -33], [-17, -29], [-26, -14]]));
    [[-28, -6], [-29, -20], [-20, -34], [-5, -38], [9, -37], [23, -33], [30, -18], [29, -4], [-27, 6], [25, 7], [-13, 10], [12, 12], [-40, -30], [40, -25], [0, -50], [-25, -55], [28, -52]]
      .forEach(([x, z], i) => g.add(tree(x, z, 1 + (i % 3) * 0.35, i % 2 ? M.leaf : M.leafDark)));
    for (let i = 0; i < 26; i++) {
      const x = -10 + Math.random() * 20; const z = -6 - Math.random() * 18;
      if (Math.abs(x - 2.2) < 2.2 && z > -13) continue;
      const pad = mesh(new THREE.CylinderGeometry(0.45 + Math.random() * 0.3, 0.45, 0.03, 12, 1, false, 0, Math.PI * 1.8), M.pad, x, 0.05, z);
      pad.userData.float = true;
      g.add(pad);
      if (i % 4 === 0) {
        const lotus = mesh(new THREE.ConeGeometry(0.16, 0.3, 6), M.lotus, x, 0.2, z);
        lotus.rotation.x = Math.PI;
        lotus.userData.float = true;
        g.add(lotus);
      }
    }
    return g;
  })();
  // Sông quê: hai bờ, tre, ruộng lúa, nhà sàn
  decor.river = (() => {
    const g = new THREE.Group();
    g.add(land([[-80, 12], [-14, 12], [-16, -40], [-12, -90], [-80, -90]]));
    g.add(land([[14, 12], [80, 12], [80, -90], [16, -90], [18, -40]]));
    g.add(land([[-80, 30], [80, 30], [80, 10], [-80, 10]], 0.25, M.grass));
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(5, 0.1, 6), M.field, -24 - (i % 2) * 6, 0.32, -6 - Math.floor(i / 2) * 7));
    [[-15, -4], [-16, -16], [-15, -30], [16, -8], [17, -22], [16, -36]].forEach(([x, z]) => g.add(bamboo(x, z)));
    const hut = new THREE.Group();
    hut.add(shadowed(mesh(new THREE.BoxGeometry(3, 1.6, 2.4), M.wood, 0, 1.8, 0)));
    const roof = shadowed(mesh(new THREE.ConeGeometry(2.6, 1.4, 4), M.roof, 0, 3.3, 0));
    roof.rotation.y = Math.PI / 4;
    hut.add(roof);
    for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) hut.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 5), M.woodDark, x, 0.6, z));
    hut.position.set(22, 0.3, -20);
    hut.rotation.y = -0.5;
    g.add(hut);
    [[-22, -40], [26, -46], [-30, -60]].forEach(([x, z]) => g.add(tree(x, z, 1.6)));
    return g;
  })();
  // Hồ trên núi: núi tuyết, rừng thông
  decor.lake = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 14], [90, 14], [90, 4], [-90, 4]], 0.3));
    g.add(land([[-90, 4], [-22, 4], [-26, -40], [-90, -40]], 0.3));
    g.add(land([[22, 4], [90, 4], [90, -40], [28, -40]], 0.3));
    [[-80, -170, 40, 52], [-25, -200, 50, 74], [35, -185, 44, 60], [95, -160, 36, 46], [-130, -140, 34, 40], [10, -240, 40, 56]].forEach(([x, z, r, h]) => g.add(mountain(x, z, r, h)));
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      g.add(pine(side * (24 + Math.random() * 30), -Math.random() * 38, 1 + Math.random() * 1.2));
    }
    return g;
  })();
  // Biển xanh: đảo xa, dừa, ngọn hải đăng
  decor.sea = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.3, M.sand));
    [[-40, -90, 10], [55, -120, 16], [10, -170, 22]].forEach(([x, z, r]) => {
      const isl = mesh(new THREE.SphereGeometry(r, 16, 8), M.sand, x, -r * 0.82, z);
      g.add(isl);
      g.add(palm(x - r * 0.2, r * 0.15, z, r / 8), palm(x + r * 0.25, r * 0.12, z + 1, r / 9));
    });
    const lh = new THREE.Group();
    lh.add(rock(0, 0, 3, M.rock, 0));
    for (let i = 0; i < 5; i++) lh.add(mesh(new THREE.CylinderGeometry(0.75 - i * 0.07, 0.8 - i * 0.07, 1.4, 12), mat(i % 2 ? 0xe23b3b : 0xffffff), 0, 1.5 + i * 1.4, 0));
    lh.add(mesh(new THREE.ConeGeometry(0.75, 1, 12), mat(0x333333), 0, 9, 0));
    lh.position.set(24, 0, -48);
    g.add(lh);
    [[-12, -22, 1.4], [-16, -26, 0.9], [14, -28, 1.1]].forEach(([x, z, s]) => g.add(rock(x, z, s, M.rock, s * 0.3)));
    return g;
  })();
  // Vực sâu: đêm sao, trăng, đá đen, sinh vật phát sáng
  const glowCount = 160;
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(glowCount * 3);
  const glowCol = new Float32Array(glowCount * 3);
  for (let i = 0; i < glowCount; i++) {
    glowPos.set([(Math.random() - 0.5) * 40, 0.2 + Math.random() * 3, -4 - Math.random() * 40], i * 3);
    const c = new THREE.Color().setHSL(0.5 + Math.random() * 0.3, 1, 0.6);
    glowCol.set([c.r, c.g, c.b], i * 3);
  }
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
  const glowPts = new THREE.Points(glowGeo, new THREE.PointsMaterial({
    size: 0.22, map: particles.material.map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  decor.abyss = (() => {
    const g = new THREE.Group();
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const th = Math.random() * Math.PI * 2; const ph = Math.random() * 1.3;
      sp.set([Math.cos(th) * Math.sin(ph) * 400, Math.cos(ph) * 400 + 10, Math.sin(th) * Math.sin(ph) * 400], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.4, color: 0xffffff, fog: false, sizeAttenuation: true })));
    g.add(mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe6ecff, fog: false }), 120, 160, -300));
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.3, M.rockDark));
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const r = rock(side * (16 + Math.random() * 35), -25 - Math.random() * 80, 1.5 + Math.random() * 3.5, M.rockDark, 0);
      r.scale.y = 1.3 + Math.random() * 1.2;
      g.add(r);
    }
    g.add(glowPts);
    return g;
  })();
  // ---------- Rừng ngập mặn: cây đước rễ chống, bãi bùn, xuồng ba lá ----------
  const mudMat = mat(0x6b5a3a);
  function mangroveTree(x, z, s = 1) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const root = mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 1.6 * s, 4), M.trunk, Math.cos(a) * 0.45 * s, 0.6 * s, Math.sin(a) * 0.45 * s);
      root.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(root);
    }
    g.add(shadowed(mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1.8 * s, 6), M.trunk, 0, 2.1 * s, 0)));
    for (const [dx, dy, dz, r] of [[0, 3.3, 0, 1.2], [0.8, 2.9, 0.3, 0.8], [-0.7, 3.0, -0.2, 0.85], [0.1, 3.0, 0.8, 0.7]]) {
      g.add(shadowed(mesh(new THREE.IcosahedronGeometry(r * s, 0), M.leafDark, dx * s, dy * s, dz * s)));
    }
    g.position.set(x, -0.2, z);
    return g;
  }
  decor.mangrove = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.2, mudMat));
    g.add(land([[-90, 6], [-16, 6], [-20, -60], [-90, -60]], 0.15, mudMat));
    g.add(land([[16, 6], [90, 6], [90, -60], [22, -60]], 0.15, mudMat));
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      g.add(mangroveTree(side * (13 + Math.random() * 22), 4 - Math.random() * 60, 0.8 + Math.random() * 0.6));
    }
    // Xuồng ba lá neo bên bờ
    const boat = new THREE.Group();
    const hull = shadowed(mesh(new THREE.BoxGeometry(0.9, 0.3, 3.2), M.woodDark, 0, 0.05, 0));
    boat.add(hull, mesh(new THREE.ConeGeometry(0.45, 0.8, 4), M.woodDark, 0, 0.05, -2).rotateX(-Math.PI / 2));
    boat.position.set(-8, 0, -12);
    boat.rotation.y = 0.6;
    boat.userData.float = true;
    g.add(boat);
    return g;
  })();

  // ---------- Rạn san hô: san hô nhiều màu nhô lên mặt nước, đảo cát, phao ----------
  const CORAL_COLORS = [0xf472b6, 0xfb923c, 0xa855f7, 0xfacc15, 0xef4444, 0x22d3ee];
  function coralClump(x, z, s = 1) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const c = mat(CORAL_COLORS[Math.floor(Math.random() * CORAL_COLORS.length)], { roughness: 0.6 });
      const k = Math.random();
      const px = (Math.random() - 0.5) * 1.6 * s; const pz = (Math.random() - 0.5) * 1.6 * s;
      if (k < 0.35) g.add(mesh(new THREE.SphereGeometry(0.35 * s + Math.random() * 0.3 * s, 8, 6), c, px, 0.05, pz));
      else if (k < 0.7) {
        for (let b = 0; b < 4; b++) {
          const br = mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.9 * s, 5), c, px + (Math.random() - 0.5) * 0.4, 0.35 * s, pz + (Math.random() - 0.5) * 0.4);
          br.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8);
          g.add(br);
        }
      } else g.add(mesh(new THREE.ConeGeometry(0.3 * s, 0.9 * s, 6), c, px, 0.3, pz));
    }
    g.position.set(x, -0.15, z);
    return g;
  }
  decor.coral = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.3, M.sand));
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (6 + Math.random() * 26);
      const z = -8 - Math.random() * 50;
      if (Math.abs(x - 2.2) < 3 && z > -14) continue;
      g.add(coralClump(x, z, 0.8 + Math.random() * 0.8));
    }
    [[-45, -110, 12], [60, -140, 16]].forEach(([x, z, r]) => {
      g.add(mesh(new THREE.SphereGeometry(r, 16, 8), M.sand, x, -r * 0.84, z));
      g.add(palm(x - r * 0.2, r * 0.12, z, r / 8), palm(x + r * 0.25, r * 0.1, z + 1, r / 9));
    });
    for (const [x, z, c] of [[-6, -18, 0xef4444], [9, -26, 0xfacc15]]) {
      const buoy = mesh(new THREE.SphereGeometry(0.35, 12, 8), mat(c, { roughness: 0.4 }), x, 0.15, z);
      buoy.userData.float = true;
      g.add(buoy);
    }
    return g;
  })();

  // ---------- Biển băng: núi băng trôi, bờ tuyết, cực quang, tuyết rơi ----------
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xe6f4ff, roughness: 0.25, metalness: 0.05, flatShading: true });
  const iceBlue = new THREE.MeshStandardMaterial({ color: 0x9fd4f5, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
  const SNOW_N = 500;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) snowPos.set([(Math.random() - 0.5) * 60, Math.random() * 18, 6 - Math.random() * 50], i * 3);
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const aurora = [];
  decor.ice = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.35, M.snow));
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const s2 = 1.5 + Math.random() * 4;
      const berg = shadowed(mesh(new THREE.IcosahedronGeometry(s2, 0), i % 3 ? iceMat : iceBlue, side * (10 + Math.random() * 40), s2 * 0.1, -16 - Math.random() * 90));
      berg.scale.set(1.3, 0.8 + Math.random() * 0.8, 1);
      berg.rotation.y = Math.random() * 3;
      g.add(berg);
    }
    [[-90, -230, 45, 42], [5, -260, 60, 55], [95, -235, 48, 40]].forEach(([x, z, r, h]) => g.add(mountain(x, z, r, h, true, mat(0x8fb3d4))));
    g.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: particles.material.map, color: 0xffffff, transparent: true, depthWrite: false })));
    // Cực quang: các dải sáng xanh – tím uốn lượn trên trời
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(220, 40, 60, 1);
      const m = new THREE.MeshBasicMaterial({ color: [0x34d399, 0x22d3ee, 0xa78bfa][i], transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const a = new THREE.Mesh(geo, m);
      a.position.set(-20 + i * 25, 60 + i * 8, -220 - i * 20);
      a.userData.base = Float32Array.from(geo.attributes.position.array);
      a.userData.k = i;
      aurora.push(a);
      g.add(a);
    }
    return g;
  })();

  // ---------- Hồ dung nham: núi lửa phát sáng, đá bazan, khe dung nham, tàn lửa bay ----------
  const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xff4500, emissiveIntensity: 1.6, roughness: 0.6 });
  const EMBER_N = 220;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBER_N * 3);
  for (let i = 0; i < EMBER_N; i++) emberPos.set([(Math.random() - 0.5) * 50, Math.random() * 14, 4 - Math.random() * 45], i * 3);
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  decor.volcano = (() => {
    const g = new THREE.Group();
    g.add(land([[-90, 30], [90, 30], [90, 6], [-90, 6]], 0.3, M.rockDark));
    // Núi lửa lớn ở xa với miệng phun sáng
    const v = mountain(-15, -210, 75, 75, false, mat(0x2a1a14));
    v.add(mesh(new THREE.CylinderGeometry(8, 11, 4, 10), lavaMat, 0, 73, 0));
    const crater = new THREE.PointLight(0xff6a00, 60, 260, 1.4);
    crater.position.set(0, 80, 0);
    v.add(crater);
    g.add(v);
    g.add(mountain(85, -200, 45, 40, false, mat(0x3a2418)), mountain(-100, -190, 40, 34, false, mat(0x3a2418)));
    // Đá bazan có khe dung nham
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (12 + Math.random() * 30); const z = -12 - Math.random() * 55;
      const r = rock(x, z, 1.4 + Math.random() * 2.6, M.rockDark, 0);
      r.scale.y = 1 + Math.random() * 1.4;
      g.add(r);
      if (i % 2 === 0) g.add(mesh(new THREE.BoxGeometry(0.25, 0.08, 2 + Math.random() * 2), lavaMat, x + 0.3, 0.12, z + 1));
    }
    g.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.2, map: particles.material.map, color: 0xffa030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    return g;
  })();
  Object.values(decor).forEach((g) => { g.visible = false; scene.add(g); });

  // ---------- Khu & chủ đề ----------
  let zoneId = null;
  function setZone(z) {
    if (!z || z.id === zoneId) return;
    zoneId = z.id;
    const th = THEMES[z.id] || THEMES.pond;
    Object.entries(decor).forEach(([id, g]) => { g.visible = id === z.id; });
    const sunDir = new THREE.Vector3(...th.sunDir).normalize();
    skyUniforms.uTop.value.setHex(th.top);
    skyUniforms.uHorizon.value.setHex(th.horizon);
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value.setHex(th.sun);
    skyUniforms.uNight.value = z.id === 'abyss' ? 1 : z.id === 'volcano' ? 0.45 : 0;
    waterUniforms.uShallow.value.setHex(th.shallow);
    waterUniforms.uDeep.value.setHex(th.deep);
    waterUniforms.uSkyTop.value.setHex(th.top);
    waterUniforms.uSkyHorizon.value.setHex(th.horizon);
    waterUniforms.uSunDir.value.copy(sunDir);
    waterUniforms.uSunColor.value.setHex(th.sun);
    waterUniforms.uFogColor.value.setHex(th.horizon);
    waterUniforms.uFogNear.value = th.fogNear;
    waterUniforms.uFogFar.value = th.fogFar;
    waterUniforms.uAmp.value = th.amp;
    waterUniforms.uGlow.value = z.id === 'abyss' ? 0.25 : z.id === 'volcano' ? 0.55 : z.id === 'coral' ? 0.08 : 0;
    scene.fog.color.setHex(th.horizon);
    scene.fog.near = th.fogNear;
    scene.fog.far = th.fogFar;
    hemi.color.setHex(th.top).lerp(new THREE.Color(0xffffff), 0.5);
    hemi.groundColor.setHex(th.hemiGround);
    hemi.intensity = z.id === 'abyss' ? 0.5 : z.id === 'volcano' ? 0.6 : z.id === 'ice' ? 1.05 : 0.9;
    sun.color.setHex(th.sun);
    sun.intensity = th.sunI;
    sun.position.copy(sunDir).multiplyScalar(30);
    lanternLight.intensity = z.id === 'abyss' ? 6 : z.id === 'volcano' ? 3 : z.id === 'river' || z.id === 'mangrove' ? 1.5 : 0;
    lantern.material.emissiveIntensity = ['abyss', 'river', 'mangrove', 'volcano'].includes(z.id) ? 1.6 : 0.3;
    if (caught) { scene.remove(caught); caught = null; caughtLight.intensity = 0; }
  }

  // ---------- Pha hoạt động ----------
  let phase = 'idle';
  let phaseStart = 0;
  const setPhase = (p) => { phase = p; phaseStart = time.t; };
  const target = new THREE.Vector3(2.2, 0, -9.5);
  const reelFrom = new THREE.Vector3();
  const fightNear = new THREE.Vector3(1.3, 0, -3.2);
  const fightState = { k: 1, tension: 0, surging: false, power: 0, tier: 0 };
  // Trang bị hiện tại (cần, dây, mồi, vật phẩm hỗ trợ) – quyết định hiệu ứng.
  const gear = { rod: 'bamboo', fx: new THREE.Color('#d9f99d'), line: new THREE.Color('#ffffff'), bait: 'worm', charm: false, tea: false, net: false };
  const bobGlow = new THREE.PointLight(0xffd54a, 0, 3, 1.5);
  scene.add(bobGlow);
  let fxTick = 0;
  const FIRE = ['#fde047', '#fb923c', '#ef4444', '#f97316'];
  const GOLD = ['#fde68a', '#fbbf24', '#f59e0b', '#fff7cc'];
  // Bóng cá đang mắc câu bơi giằng co dưới nước
  const hooked = makeFish(0x0c2230, 0x081820);
  hooked.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.9; } });
  hooked.visible = false;
  scene.add(hooked);
  const lineWhite = new THREE.Color(0xffffff);
  const lineRed = new THREE.Color(0xff3b3b);
  const bobPos = new THREE.Vector3();
  let lastRipple = 0;
  let shake = 0;

  function resize() {
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    if (typeof fxPoints !== 'undefined') fxPoints.material.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.9;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.5 ? 58 : 48;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const camBase = new THREE.Vector3(-3.8, 2.3, 1.6);
  const camLook = new THREE.Vector3(1.8, 0.4, -8);
  const camPos = camBase.clone();
  const camTarget = camLook.clone();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function updateLine(from, to, sag) {
    const arr = lineGeo.attributes.position.array;
    for (let i = 0; i < LINE_PTS; i++) {
      const k = i / (LINE_PTS - 1);
      arr[i * 3] = from.x + (to.x - from.x) * k;
      arr[i * 3 + 1] = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * sag;
      arr[i * 3 + 2] = from.z + (to.z - from.z) * k;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time.t += dt;
    const t = time.t;
    const el = t - phaseStart;
    waterUniforms.uTime.value = t;

    // Cần câu: nhịp thở, rung khi cá cắn, giật lên khi kéo
    let rodPitch = 0;
    if (phase === 'cast') rodPitch = el < 0.15 ? 0.6 * (el / 0.15) : -0.5 * Math.max(0, 1 - (el - 0.15) / 0.4);
    else if (phase === 'bite') rodPitch = -0.18 - Math.abs(Math.sin(t * 18)) * 0.1;
    else if (phase === 'reel') rodPitch = 0.45 * Math.min(1, el / 0.25);
    else if (phase === 'charge') rodPitch = 0.75 * fightState.power;
    else if (phase === 'fight') rodPitch = -0.12 - fightState.tension * 0.4 + (fightState.tension > 0.8 ? Math.sin(t * 40) * 0.04 : 0);
    else if (phase === 'escape') rodPitch = 0.35 * Math.max(0, 1 - el / 0.8);
    rodPivot.rotation.x = rodBase.x + rodPitch + Math.sin(t * 1.3) * 0.015;
    rodPivot.rotation.z = rodBase.z + (phase === 'bite' ? Math.sin(t * 30) * 0.03 : 0);
    body.scale.y = 1 + Math.sin(t * 2) * 0.015;
    fisher.updateMatrixWorld(true);
    rodMesh.localToWorld(tipPos.set(0, ROD_LEN / 2, 0));

    // Phao
    let sag = 0.3;
    let hideBobber = false;
    hooked.visible = phase === 'fight';
    line.material.color.copy(gear.line);
    if (phase === 'idle' || phase === 'charge') {
      bobPos.set(tipPos.x + Math.sin(t * 1.5) * 0.08, tipPos.y - 1.1, tipPos.z + Math.cos(t * 1.2) * 0.05);
      sag = 0;
    } else if (phase === 'cast') {
      const k = Math.min(1, el / (CAST_MS / 1000));
      bobPos.lerpVectors(tipPos, target, k);
      bobPos.y = tipPos.y + (waveHeight(target.x, target.z) - tipPos.y) * k + Math.sin(k * Math.PI) * 2.5;
      sag = 0.1;
      if (k >= 1) {
        splash(target, 50, 0.8);
        landFx(target);
        ripple(target.x, target.z, 1.3);
        setPhase('wait');
      }
    } else if (phase === 'wait') {
      bobPos.set(target.x, waveHeight(target.x, target.z) + Math.sin(t * 2.2) * 0.02, target.z);
      if (Math.random() < 0.006) ripple(target.x, target.z, 0.5);
    } else if (phase === 'bite') {
      const dunk = Math.max(0, Math.sin(t * 9)) * 0.22;
      bobPos.set(target.x + Math.sin(t * 23) * 0.05, waveHeight(target.x, target.z) - 0.05 - dunk, target.z + Math.cos(t * 19) * 0.05);
      sag = 0;
      if (t - lastRipple > 0.28) { ripple(bobPos.x, bobPos.z, 0.9); splash(bobPos, 6, 0.35, undefined, 2); lastRipple = t; }
      shake = 0.025;
    } else if (phase === 'fight') {
      // Cá giằng co: càng xa càng gần chỗ thả câu, vùng vẫy sang hai bên.
      const sway = Math.sin(t * 1.7) * (0.6 + fightState.k * 1.2) * (fightState.surging ? 1.8 : 1);
      bobPos.lerpVectors(fightNear, target, fightState.k);
      bobPos.x += sway;
      bobPos.y = waveHeight(bobPos.x, bobPos.z) - 0.1 - (fightState.surging ? Math.abs(Math.sin(t * 12)) * 0.15 : 0);
      sag = 0;
      hooked.position.set(bobPos.x, -0.22 - (fightState.surging ? 0 : 0.1), bobPos.z - 0.35);
      hooked.rotation.y = Math.PI / 2 + Math.cos(t * 1.7) * 0.8 + Math.PI;
      hooked.userData.tail.rotation.y = Math.sin(t * (fightState.surging ? 30 : 12)) * 0.6;
      hooked.scale.setScalar(1.2 + fightState.tier * 0.2);
      if (fightState.surging && t - lastRipple > 0.12) { splash(bobPos, 8, 0.55, undefined, 2.2); ripple(bobPos.x, bobPos.z, 1.2); lastRipple = t; }
      else if (t - lastRipple > 0.3) { ripple(bobPos.x, bobPos.z, 0.8); splash(bobPos, 4, 0.35, undefined, 1.6); lastRipple = t; }
      line.material.color.copy(gear.line).lerp(lineRed, Math.max(0, (fightState.tension - 0.55) / 0.45));
      shake = Math.max(shake, fightState.surging ? 0.03 : fightState.tension > 0.85 ? 0.02 : 0);
    } else if (phase === 'reel' || phase === 'escape') {
      const k = Math.min(1, el / (REEL_MS / 1000));
      const e = 1 - (1 - k) ** 3;
      const hang = tmp2.set(tipPos.x, tipPos.y - 1.5, tipPos.z);
      bobPos.lerpVectors(reelFrom, hang, e);
      bobPos.y += Math.sin(e * Math.PI) * 1.6;
      sag = 0.05;
      if (phase === 'reel' && caught) {
        hideBobber = false;
        caught.position.copy(bobPos).add(tmp.set(0, -0.35 * caught.scale.y, 0));
        caught.rotation.set(Math.sin(t * 14) * 0.5, t * 0.8, Math.PI / 2 + Math.sin(t * 9) * 0.25);
        caught.userData.swim(t * 2.2, 1.6);
        caughtLight.position.copy(caught.position);
        if (Math.random() < 0.5) splash(caught.position, 1, 0.3, caught.userData.sparkle, 1);
      }
      if (k >= 1 && el > REEL_MS / 1000 + 0.15) setPhase(phase === 'reel' ? 'hold' : 'idle');
    } else if (phase === 'hold') {
      // Cá treo lủng lẳng ở đầu dây chờ người chơi xem kết quả.
      bobPos.set(tipPos.x + Math.sin(t * 1.6) * 0.15, tipPos.y - 1.5, tipPos.z + Math.cos(t * 1.3) * 0.1);
      sag = 0;
      if (caught) {
        caught.position.copy(bobPos).add(tmp.set(0, -0.35 * caught.scale.y, 0));
        caught.rotation.set(Math.sin(t * 3) * 0.3, t * 0.6, Math.PI / 2 + Math.sin(t * 4) * 0.15);
        caught.userData.swim(t, 1.1);
        caughtLight.position.copy(caught.position);
        if (Math.random() < 0.15) splash(caught.position, 1, 0.15, caught.userData.sparkle, 0.6);
      }
    }
    gearFx(t, dt);
    updateRemotes(t, dt);
    bobber.position.copy(bobPos);
    bobber.visible = !hideBobber;
    updateLine(tipPos, bobPos, sag);

    // Cá dưới nước
    for (const f of swimmers) {
      const p = f.userData.path;
      const a = p.phase + t * p.speed;
      f.position.set(p.cx + Math.cos(a) * p.r, -p.depth, p.cz + Math.sin(a) * p.r);
      f.rotation.y = -a - (p.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      f.userData.tail.rotation.y = Math.sin(t * 6 + p.phase) * 0.4;
    }
    // Lá sen nổi theo sóng
    if (zoneId === 'pond') decor.pond.children.forEach((c) => { if (c.userData.float) c.position.y = waveHeight(c.position.x, c.position.z) + 0.04; });
    if (zoneId === 'mangrove' || zoneId === 'coral') decor[zoneId].children.forEach((c) => { if (c.userData.float) c.position.y = waveHeight(c.position.x, c.position.z) + 0.05; });
    if (zoneId === 'ice') {
      for (let i = 0; i < SNOW_N; i++) {
        snowPos[i * 3 + 1] -= dt * (0.8 + (i % 5) * 0.15);
        snowPos[i * 3] += Math.sin(t + i) * dt * 0.3;
        if (snowPos[i * 3 + 1] < 0) snowPos[i * 3 + 1] = 18;
      }
      snowGeo.attributes.position.needsUpdate = true;
      for (const a of aurora) {
        const arr = a.geometry.attributes.position.array;
        const b = a.userData.base;
        for (let i = 0; i < arr.length; i += 3) arr[i + 2] = b[i + 2] + Math.sin(b[i] * 0.04 + t * 0.6 + a.userData.k) * 10;
        a.geometry.attributes.position.needsUpdate = true;
        a.material.opacity = 0.16 + Math.sin(t * 0.8 + a.userData.k * 2) * 0.08;
      }
    }
    if (zoneId === 'volcano') {
      for (let i = 0; i < EMBER_N; i++) {
        emberPos[i * 3 + 1] += dt * (0.6 + (i % 7) * 0.15);
        emberPos[i * 3] += Math.sin(t * 1.5 + i) * dt * 0.4;
        if (emberPos[i * 3 + 1] > 14) emberPos[i * 3 + 1] = 0;
      }
      emberGeo.attributes.position.needsUpdate = true;
      lavaMat.emissiveIntensity = 1.4 + Math.sin(t * 2.2) * 0.4;
    }
    if (zoneId === 'abyss') {
      const arr = glowGeo.attributes.position.array;
      for (let i = 0; i < glowCount; i++) arr[i * 3 + 1] = 0.3 + ((i * 0.37 + t * 0.15) % 3);
      glowGeo.attributes.position.needsUpdate = true;
    }

    // Hạt nước
    for (let i = 0; i < P_MAX; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt * pFade[i];
      pVel[i * 3 + 1] -= pGrav[i] * dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pLife[i] <= 0 || pPos[i * 3 + 1] < -0.3) { pLife[i] = 0; pPos[i * 3 + 1] = -999; }
    }
    fxLight.intensity *= Math.pow(0.04, dt);
    updateFx(dt);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    for (const r of ripples) {
      if (!r.visible) continue;
      const age = t - r.userData.born;
      if (age > 1.6) { r.visible = false; continue; }
      const s = 0.2 + age * 1.6 * r.userData.strength;
      r.scale.set(s, 1, s);
      r.material.opacity = (1 - age / 1.6) * 0.6;
    }

    // Camera: lắc nhẹ, rung khi cá cắn, tiến lại gần khi kéo cá
    const narrow = camera.aspect < 1.5;
    camPos.copy(camBase);
    if (narrow) camPos.add(tmp.set(-1.4, 1.2, 2.6));
    camTarget.copy(camLook);
    if (phase === 'fight') camTarget.lerp(bobPos, 0.35);
    if ((phase === 'reel' || phase === 'hold') && caught) {
      const k = phase === 'hold' ? 1 : Math.min(1, el / (REEL_MS / 1000));
      camPos.lerp(tmp.set(-2.6, 2.1, 0.2 + (narrow ? 1.5 : 0)), k * 0.7);
      camTarget.lerp(caught.position, k * 0.6);
    }
    camPos.add(tmp.set(Math.sin(t * 0.4) * 0.15, Math.sin(t * 0.6) * 0.08, 0));
    // Khung đầu tiên hoặc khi đổi kích thước lớn: đặt camera thẳng vào chỗ, không lướt từ xa tới.
    if (camera.position.distanceTo(camPos) > 2.5) camera.position.copy(camPos);
    else camera.position.lerp(camPos, 0.06);
    shake *= 0.9;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    camera.userData.look = (camera.userData.look || camTarget.clone()).lerp(camTarget, camera.userData.look ? 0.06 : 1);
    camera.lookAt(camera.userData.look);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Hiệu ứng liên tục theo trang bị.
  function gearFx(t, dt) {
    fxTick += dt;
    const every = (s) => { if (fxTick >= s) { fxTick = 0; return true; } return false; };
    // Mồi vàng: phao phát sáng
    const goldBait = ['golden', 'glow', 'rainbow'].includes(gear.bait) && (phase === 'wait' || phase === 'bite' || phase === 'cast');
    bobGlow.intensity = goldBait ? 2.5 + Math.sin(t * 6) * 0.8 : 0;
    bobGlow.position.copy(bobPos).add(tmp.set(0, 0.25, 0));
    bobTop.material.emissive.set(goldBait ? 0xffb21e : 0x000000);
    bobTop.material.emissiveIntensity = goldBait ? 0.8 : 0;
    if (phase === 'cast') {
      // Vệt sáng theo cần câu
      if (gear.rod === 'dragon') burst(bobPos, 5, null, { colors: FIRE, speed: 0.5, up: 0.6, gravity: -0.5, fade: 1.1, shape: 'point', jitter: 0.15 });
      else if (gear.rod === 'gold') burst(bobPos, 4, null, { colors: GOLD, speed: 0.3, gravity: 0.5, fade: 1.1, shape: 'point', jitter: 0.1 });
      else if (gear.rod !== 'bamboo') burst(bobPos, 3, gear.fx, { speed: 0.2, gravity: 0, fade: 1.3, shape: 'point', jitter: 0.06 });
      return;
    }
    if (phase === 'wait' || phase === 'bite') {
      if (gear.bait === 'shrimp' && Math.random() < dt * 4) burst(tmp.copy(bobPos).add(tmp2.set((Math.random() - 0.5) * 0.4, -0.05, (Math.random() - 0.5) * 0.4)), 1, '#dff6ff', { speed: 0.05, up: 0.5, gravity: -0.3, fade: 0.9, shape: 'point' });
      if (goldBait && Math.random() < dt * 6) burst(bobPos, 1, null, { colors: GOLD, speed: 0.3, up: 0.6, gravity: 0, fade: 1.2, shape: 'point' });
      if (gear.charm && every(0.06)) {
        const a = t * 3;
        burst(tmp.set(bobPos.x + Math.cos(a) * 0.5, bobPos.y + 0.1, bobPos.z + Math.sin(a) * 0.5), 1, null, { colors: ['#4ade80', '#86efac', '#bbf7d0'], speed: 0.05, up: 0.7, gravity: 0, fade: 0.9, shape: 'point' });
      }
    }
    if (phase === 'fight') {
      if (gear.tea && Math.random() < dt * 8) burst(tmp.copy(bobPos).add(tmp2.set(0, 0.1, 0)), 1, null, { colors: ['#d9f99d', '#ecfccb', '#fef9c3'], speed: 0.15, up: 0.5, gravity: -0.2, fade: 0.8, shape: 'point' });
      if (fightState.stun > 0 && Math.random() < dt * 20) {
        const a = Math.random() * 6.28;
        burst(tmp.set(bobPos.x + Math.cos(a) * 0.6, bobPos.y + 0.4, bobPos.z + Math.sin(a) * 0.6), 1, null, { colors: gear.rod === 'dragon' ? FIRE : GOLD, speed: 0.1, gravity: 0, fade: 1.5, shape: 'point' });
      }
    }
  }

  // Phao rơi xuống nước: mỗi cần một kiểu.
  function landFx(pos) {
    if (gear.rod === 'fiber') { ripple(pos.x, pos.z, 2.6); burst(pos, 40, gear.fx, { shape: 'ring', speed: 2.2, up: 1.2, gravity: 4, fade: 1.4 }); }
    else if (gear.rod === 'carbon') { burst(pos, 50, '#f8fafc', { shape: 'ring', speed: 3, up: 0.4, gravity: 1, fade: 1.6 }); ripple(pos.x, pos.z, 2); }
    else if (gear.rod === 'gold') { burst(pos, 60, null, { colors: GOLD, shape: 'up', speed: 1.2, up: 4, gravity: 6, fade: 1 }); flash(pos, '#fbbf24', 5); }
    else if (gear.rod === 'dragon') { burst(pos, 80, null, { colors: FIRE, shape: 'ring', speed: 3, up: 2, gravity: 2, fade: 1.2 }); flash(pos, '#f97316', 7); ripple(pos.x, pos.z, 3); }
    else if (gear.rod === 'phoenix') { burst(pos, 100, null, { colors: ['#fb7185', '#fde047', '#f97316'], shape: 'up', speed: 1.6, up: 6, gravity: 5, fade: 1.2 }); flash(pos, '#fb7185', 9); ripple(pos.x, pos.z, 3); }
    else if (gear.rod === 'thunder') { burst(pos, 70, null, { colors: ['#c4b5fd', '#f5f3ff', '#a78bfa'], shape: 'up', speed: 0.6, up: 8, gravity: 9, fade: 0.6 }); flash(pos, '#a78bfa', 10); }
    else if (gear.rod === 'jade') { burst(pos, 50, null, { colors: ['#34d399', '#a7f3d0'], shape: 'ring', speed: 2, up: 1.5, gravity: 2, fade: 1.3 }); ripple(pos.x, pos.z, 2.4); }
    else if (gear.rod === 'steel' || gear.rod === 'reed') { burst(pos, 30, gear.fx, { shape: 'ring', speed: 2, up: 1, gravity: 3, fade: 1.2 }); ripple(pos.x, pos.z, 1.8); }
    if (gear.bait === 'rainbow') burst(pos, 50, null, { colors: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'], shape: 'up', speed: 0.8, up: 3, gravity: 1, fade: 1.2 });
    if (gear.charm) burst(pos, 30, null, { colors: ['#4ade80', '#bbf7d0'], shape: 'up', speed: 0.6, up: 2.5, gravity: 0.5, fade: 0.9 });
  }

  // Vòng sáng quanh người câu khi tung kỹ năng.
  function heroAura(colors, n = 90, up = 3) {
    const base = new THREE.Vector3(fisher.position.x, 0.8, fisher.position.z);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      burst(tmp2.set(base.x + Math.cos(a) * 0.9, base.y + Math.random() * 0.3, base.z + Math.sin(a) * 0.9), 1, null,
        { colors, shape: 'point', speed: 0.3, up: up * (0.5 + Math.random() * 0.5), gravity: 0.8, fade: 0.9 });
    }
    burst(tipPos, 40, null, { colors, shape: 'sphere', speed: 1.6, gravity: 0.5, fade: 1.2 });
  }

  // Kỹ năng câu cá: hiệu ứng riêng cho từng kỹ năng.
  function skillFx(skill) {
    const pos = bobPos.clone();
    const tip = tipPos.clone();
    const AURA = { calm: ['#86efac', '#d9f99d'], wave: ['#38bdf8', '#e0f2fe'], gust: ['#f8fafc', '#cbd5e1'], gold: GOLD, dragon: FIRE,
      storm: ['#e2e8f0', '#94a3b8'], jade: ['#34d399', '#a7f3d0'], thunder: ['#c4b5fd', '#f5f3ff'], phoenix: ['#fb7185', '#fde047', '#f97316'] };
    const big = skill === 'dragon' || skill === 'phoenix';
    heroAura(AURA[skill] || GOLD, big ? 140 : 90, big ? 5 : 3);
    if (['storm', 'jade', 'thunder', 'phoenix'].includes(skill)) {
      burst(pos, big ? 140 : 90, null, { colors: AURA[skill], shape: skill === 'thunder' ? 'up' : 'ring', speed: skill === 'thunder' ? 0.8 : 3, up: skill === 'thunder' ? 9 : 3, gravity: 5, fade: 1.1 });
      flash(pos, AURA[skill][0], big ? 10 : 7);
      for (let i = 0; i < 3; i++) setTimeout(() => ripple(pos.x, pos.z, 1.5 + i), i * 120);
      shake = skill === 'thunder' || big ? 0.08 : 0.03;
    }
    // Dải sáng chạy dọc dây câu từ đầu cần tới cá
    for (let i = 0; i < 40; i++) {
      const k = i / 40;
      burst(tmp2.copy(tip).lerp(pos, k), 1, null, { colors: AURA[skill] || GOLD, shape: 'point', speed: 0.2, gravity: 0, fade: 1.1 });
    }
    if (skill === 'calm') {
      for (let i = 0; i < 4; i++) setTimeout(() => ripple(pos.x, pos.z, 1 + i * 0.5), i * 140);
      burst(pos, 40, null, { colors: ['#86efac', '#d9f99d', '#4ade80'], shape: 'up', speed: 0.8, up: 2, gravity: 0.4, fade: 0.7 });
      flash(pos, '#86efac', 4);
    } else if (skill === 'wave') {
      for (let i = 0; i < 3; i++) setTimeout(() => ripple(pos.x, pos.z, 2 + i), i * 120);
      burst(pos, 120, null, { colors: ['#38bdf8', '#7dd3fc', '#e0f2fe'], shape: 'ring', speed: 4, up: 3, gravity: 7, fade: 1.1 });
      flash(pos, '#38bdf8', 9);
      shake = 0.05;
    } else if (skill === 'gust') {
      // Lốc xoáy cuộn từ chỗ cá về đầu cần
      for (let i = 0; i < 70; i++) {
        const k = i / 70;
        const a = k * Math.PI * 8;
        const p = pos.clone().lerp(tip, k).add(tmp.set(Math.cos(a) * 0.5 * (1 - k), Math.sin(a) * 0.5 * (1 - k), 0));
        burst(p, 1, null, { colors: ['#f8fafc', '#cbd5e1', '#e0f2fe'], shape: 'point', speed: 0.3, up: 0.2, gravity: 0, fade: 0.9 });
      }
      burst(pos, 60, '#f8fafc', { shape: 'ring', speed: 3.5, up: 1.5, gravity: 2, fade: 1.2 });
      ripple(pos.x, pos.z, 3);
      shake = 0.06;
    } else if (skill === 'gold') {
      burst(pos, 140, null, { colors: GOLD, shape: 'sphere', speed: 3, up: 1, gravity: 1, fade: 0.8 });
      for (let i = 0; i < 3; i++) setTimeout(() => burst(pos, 30, null, { colors: GOLD, shape: 'ring', speed: 1.5 + i, up: 0.3, gravity: 0, fade: 1 }), i * 150);
      flash(pos, '#fbbf24', 14);
    } else if (skill === 'dragon') {
      // Cột lửa – nước phun lên như rồng cuộn
      burst(pos, 220, null, { colors: FIRE, shape: 'up', speed: 0.9, up: 9, gravity: 4, fade: 0.8, jitter: 0.3 });
      burst(pos, 120, null, { colors: ['#e0f2fe', '#7dd3fc'], shape: 'up', speed: 1.5, up: 6, gravity: 8, fade: 0.9 });
      for (let i = 0; i < 4; i++) setTimeout(() => { ripple(pos.x, pos.z, 2 + i); burst(pos, 40, null, { colors: FIRE, shape: 'ring', speed: 3 + i, up: 0.5, gravity: 0, fade: 1.2 }); }, i * 160);
      flash(pos, '#f97316', 18);
      shake = 0.1;
    }
  }

  // ===================================================================
  // NGƯỜI CHƠI KHÁC – ngồi trên bè gỗ quanh hồ, hành động theo thời gian thực
  // ===================================================================
  // Chỗ ngồi (x, z) trên mặt nước, tránh đường ném câu của chính mình.
  // Chỗ ngồi nằm trong khung nhìn của camera và tránh đường ném phao của mình.
  const SEATS = [[13, -20], [-1, -16], [17, -27], [-3, -11], [1, -24], [9, -12], [-2, -29]];
  const LAKE_CENTER = new THREE.Vector3(3, 0, -15);
  const remotes = new Map(); // id → avatar

  function labelSprite(lines, { bg = 'rgba(9,30,48,.85)', fg = '#fff', accent = '#ffc531', font = 34 } = {}) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = `800 ${font}px "Baloo 2", system-ui, sans-serif`;
    const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l.text).width))) + 44;
    const h = lines.length * (font + 10) + 20;
    c.width = w; c.height = h;
    g.font = `800 ${font}px "Baloo 2", system-ui, sans-serif`;
    g.fillStyle = bg;
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 22); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.fillStyle = l.color || fg; g.fillText(l.text, w / 2, 10 + (font + 10) * (i + 0.5)); });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const k = 0.0105;
    sp.scale.set(w * k, h * k, 1);
    sp.renderOrder = 10;
    return sp;
  }

  function makeAvatar(meta, seat) {
    const g = new THREE.Group();
    const [sx, sz] = SEATS[seat % SEATS.length];
    g.position.set(sx, 0, sz);
    // Quay mặt về giữa hồ
    const look = Math.atan2(LAKE_CENTER.x - sx, LAKE_CENTER.z - sz);
    const body = new THREE.Group();
    body.rotation.y = look + Math.PI;
    g.add(body);
    // Bè gỗ
    const raft = new THREE.Group();
    for (let i = 0; i < 4; i++) raft.add(shadowed(mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 7).rotateZ(Math.PI / 2), i % 2 ? M.wood : M.woodDark, 0, 0.12, -0.5 + i * 0.33)));
    body.add(raft);
    // Người câu: diện mạo người đó chọn (người dùng bản cũ: áo theo màu riêng)
    const person = buildCharacter(meta.look || DEFAULT_LOOK, { pose: 'sit', shirtColor: meta.look ? null : meta.color });
    person.position.set(0, 0.3, 0.2);
    person.scale.setScalar(0.95);
    body.add(person);
    // Cần câu
    const pivot = new THREE.Group();
    pivot.position.set(0.05, 0.85, -0.45);
    const rodColors = { bamboo: 0x8a6a2f, fiber: 0x0369a1, carbon: 0x111827, gold: 0xd97706, dragon: 0x991b1b };
    const rod = shadowed(mesh(new THREE.CylinderGeometry(0.012, 0.035, 3, 6), new THREE.MeshStandardMaterial({ color: rodColors[meta.rod] || 0x8a6a2f, roughness: 0.5 }), 0, 1.5, 0));
    pivot.add(rod);
    pivot.rotation.x = -0.95;
    body.add(pivot);
    // Dây + phao
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    const lineObj = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    lineObj.frustumCulled = false;
    scene.add(lineObj);
    const bob = new THREE.Group();
    bob.add(mesh(new THREE.SphereGeometry(0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: meta.color })));
    bob.add(mesh(new THREE.SphereGeometry(0.09, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff })));
    scene.add(bob);
    // Bảng tên
    const tag = labelSprite([{ text: `${meta.name}` }, { text: `⭐ Cấp ${meta.level}`, color: '#ffc531' }], { accent: meta.color, font: 30 });
    tag.position.set(0, 2.45, 0);
    g.add(tag);
    scene.add(g);
    const target = new THREE.Vector3(sx, 0, sz).lerp(LAKE_CENTER, 0.35);
    return {
      meta, seat, g, body, pivot, rod, lineObj, bob, tag, bubble: null, bubbleUntil: 0, target,
      phase: 'idle', phaseAt: time.t, fish: null, fishUntil: 0, tension: 0, tip: new THREE.Vector3(), bobPos: new THREE.Vector3(),
    };
  }

  function disposeAvatar(a) {
    scene.remove(a.g); scene.remove(a.lineObj); scene.remove(a.bob);
    if (a.fish) scene.remove(a.fish);
    a.g.traverse((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); });
  }

  function setBubble(a, text, ms = 3200) {
    if (a.bubble) a.g.remove(a.bubble);
    a.bubble = labelSprite([{ text }], { bg: 'rgba(255,255,255,.95)', fg: '#0b2233', accent: '#ffc531', font: 36 });
    a.bubble.position.set(0, 3.25, 0);
    a.g.add(a.bubble);
    a.bubbleUntil = time.t + ms / 1000;
  }

  function updateRemotes(t, dt) {
    for (const a of remotes.values()) {
      const el = t - a.phaseAt;
      // Bè nổi theo sóng
      a.g.position.y = waveHeight(a.g.position.x, a.g.position.z) * 0.8;
      a.body.rotation.z = Math.sin(t * 1.2 + a.seat) * 0.03;
      let pitch = 0;
      if (a.phase === 'charge') pitch = 0.6;
      else if (a.phase === 'cast') pitch = el < 0.2 ? 0.6 : -0.3;
      else if (a.phase === 'bite') pitch = -0.2 - Math.abs(Math.sin(t * 16)) * 0.1;
      else if (a.phase === 'fight' || a.phase === 'question') pitch = -0.1 - a.tension * 0.35 + Math.sin(t * 20) * 0.02;
      else if (a.phase === 'reel') pitch = 0.45;
      a.pivot.rotation.x = -0.95 + pitch;
      a.g.updateMatrixWorld(true);
      a.rod.localToWorld(a.tip.set(0, 1.5, 0));
      const wh = waveHeight(a.target.x, a.target.z);
      let sag = 0.2;
      if (a.phase === 'idle' || a.phase === 'charge' || a.phase === 'result') {
        a.bobPos.set(a.tip.x, a.tip.y - 1, a.tip.z); sag = 0;
      } else if (a.phase === 'cast') {
        const k = Math.min(1, el / 0.75);
        a.bobPos.lerpVectors(a.tip, a.target, k);
        a.bobPos.y = a.tip.y + (wh - a.tip.y) * k + Math.sin(k * Math.PI) * 1.8;
        if (k >= 1 && !a.landed) { a.landed = true; splash(a.target, 20, 0.6); ripple(a.target.x, a.target.z, 1); }
      } else if (a.phase === 'wait') {
        a.bobPos.set(a.target.x, wh + Math.sin(t * 2 + a.seat) * 0.02, a.target.z);
      } else if (a.phase === 'bite') {
        a.bobPos.set(a.target.x, wh - 0.05 - Math.max(0, Math.sin(t * 9)) * 0.2, a.target.z);
        if (Math.random() < dt * 3) ripple(a.target.x, a.target.z, 0.7);
      } else if (a.phase === 'fight' || a.phase === 'question') {
        a.bobPos.set(a.target.x + Math.sin(t * 1.7 + a.seat) * 0.6, wh - 0.1, a.target.z + Math.cos(t * 1.3) * 0.3);
        sag = 0;
        if (Math.random() < dt * 4) { splash(a.bobPos, 4, 0.35, undefined, 1.5); ripple(a.bobPos.x, a.bobPos.z, 0.7); }
      } else if (a.phase === 'reel') {
        const k = Math.min(1, el / 1);
        a.bobPos.lerpVectors(a.target, tmp2.set(a.tip.x, a.tip.y - 1.2, a.tip.z), 1 - (1 - k) ** 3);
        a.bobPos.y += Math.sin(k * Math.PI) * 1.2;
      }
      if (a.fish) {
        if (t > a.fishUntil) { scene.remove(a.fish); a.fish = null; }
        else {
          if (a.phase !== 'reel') a.bobPos.set(a.tip.x + Math.sin(t * 1.5) * 0.1, a.tip.y - 1.2, a.tip.z);
          a.fish.position.copy(a.bobPos).add(tmp.set(0, -0.3 * a.fish.scale.y, 0));
          a.fish.rotation.set(Math.sin(t * 6) * 0.3, t * 0.8, Math.PI / 2 + Math.sin(t * 5) * 0.2);
          a.fish.userData.swim?.(t * 1.6, 1.2);
        }
      }
      a.bob.position.copy(a.bobPos);
      a.bob.visible = !a.fish;
      const arr = a.lineObj.geometry.attributes.position.array;
      for (let i = 0; i < 12; i++) {
        const k = i / 11;
        arr[i * 3] = a.tip.x + (a.bobPos.x - a.tip.x) * k;
        arr[i * 3 + 1] = a.tip.y + (a.bobPos.y - a.tip.y) * k - Math.sin(k * Math.PI) * sag;
        arr[i * 3 + 2] = a.tip.z + (a.bobPos.z - a.tip.z) * k;
      }
      a.lineObj.geometry.attributes.position.needsUpdate = true;
      if (a.bubble && t > a.bubbleUntil) { a.g.remove(a.bubble); a.bubble = null; }
      if (a.bubble) a.bubble.position.y = 3.25 + Math.sin(t * 3) * 0.05;
    }
    if (selfBubble && time.t > selfBubbleUntil) { scene.remove(selfBubble); selfBubble = null; }
    if (selfBubble) { fisher.updateMatrixWorld(true); selfBubble.position.copy(fisher.position).add(tmp.set(0, 2.3 + Math.sin(t * 3) * 0.05, 0)); }
  }
  let selfBubble = null;
  let selfBubbleUntil = 0;

  return {
    // players: [{ id, name, level, rod, color, look, seat }]
    setRemotePlayers(players) {
      const keep = new Set(players.map((p) => p.id));
      for (const [id, a] of remotes) {
        if (!keep.has(id)) { burst(a.g.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 30, '#e0f2fe', { shape: 'sphere', speed: 1.5, gravity: 1, fade: 1.2 }); disposeAvatar(a); remotes.delete(id); }
      }
      for (const p of players) {
        const cur = remotes.get(p.id);
        if (cur && cur.seat === p.seat && cur.meta.name === p.name && cur.meta.level === p.level && cur.meta.rod === p.rod && JSON.stringify(cur.meta.look) === JSON.stringify(p.look)) continue;
        if (cur) { disposeAvatar(cur); remotes.delete(p.id); }
        const a = makeAvatar(p, p.seat);
        remotes.set(p.id, a);
        if (!cur) { burst(a.g.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 40, p.color, { shape: 'up', speed: 1, up: 2.5, gravity: 1, fade: 1 }); setBubble(a, '👋 Xin chào!', 2200); }
      }
    },
    remoteAct(id, ev) {
      const a = remotes.get(id);
      if (!a) return;
      if (ev.phase === 'fight' && a.phase === 'fight') { a.tension = ev.tension; return; }
      if (ev.phase === 'cast') {
        a.landed = false;
        const [sx, sz] = SEATS[a.seat % SEATS.length];
        const dir = tmp.set(LAKE_CENTER.x - sx, 0, LAKE_CENTER.z - sz).normalize();
        a.target.set(sx + dir.x * (2 + ev.dist * 0.2), 0, sz + dir.z * (2 + ev.dist * 0.2));
      }
      if (ev.phase === 'bite') setBubble(a, '❗', 1200);
      a.phase = ev.phase === 'question' ? 'fight' : ev.phase;
      a.tension = ev.tension || 0;
      a.phaseAt = time.t;
    },
    remoteCatch(id, fishId, color, label) {
      const a = remotes.get(id);
      if (!a) return;
      if (a.fish) scene.remove(a.fish);
      a.fish = buildFish3D(fishId);
      a.fish.scale.setScalar(0.45);
      scene.add(a.fish);
      a.fishUntil = time.t + 6;
      a.phase = 'reel';
      a.phaseAt = time.t;
      splash(a.target, 50, 0.9);
      burst(a.target, 50, color, { shape: 'up', speed: 1.2, up: 5, gravity: 5, fade: 0.9 });
      setBubble(a, label, 4000);
    },
    remoteEmote(id, text) { const a = remotes.get(id); if (a) setBubble(a, text); },
    selfEmote(text) {
      if (selfBubble) scene.remove(selfBubble);
      selfBubble = labelSprite([{ text }], { bg: 'rgba(255,255,255,.95)', fg: '#0b2233', accent: '#ffc531', font: 36 });
      scene.add(selfBubble);
      selfBubbleUntil = time.t + 3;
    },
    setZone,
    setLook,
    setGear({ rod, rodFx, lineColor, bait, charm = false, tea = false, net = false }) {
      Object.assign(gear, { rod, bait, charm, tea, net });
      gear.fx.set(rodFx || '#ffffff');
      gear.line.set(lineColor || '#ffffff');
    },
    skill(skillId) { skillFx(skillId); },
    stun(seconds) { fightState.stun = seconds; },
    // Giữ nút lấy lực: cần câu ngả ra sau theo lực.
    charge(power) {
      if (caught) { scene.remove(caught); caught = null; caughtLight.intensity = 0; }
      fightState.power = power;
      if (phase !== 'charge') setPhase('charge');
    },
    // dist: khoảng cách ném (m) – ném càng xa phao rơi càng xa.
    cast(dist = 12) {
      if (caught) { scene.remove(caught); caught = null; caughtLight.intensity = 0; }
      // Đặt phao dọc theo hướng nhìn của camera để luôn thấy rõ dù ném gần hay xa.
      const z = -3 - dist * 0.8;
      const along = (camBase.z - z) / (camBase.z - camLook.z);
      target.set(camBase.x + (camLook.x - camBase.x) * along * 0.8 + (Math.random() - 0.5) * 2, 0, z);
      setPhase('cast');
    },
    bite() { setPhase('bite'); splash(target, 20, 0.6); ripple(target.x, target.z, 1.6); },
    hook(rarity) {
      fightState.tier = Math.max(0, ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarity));
      fightState.k = 1;
      splash(target, 60, 1.0);
      ripple(target.x, target.z, 2);
      shake = 0.05;
      setPhase('fight');
    },
    // k: 1 = ở chỗ thả câu, 0 = sát cầu; tension 0–1; surging: cá đang vùng vẫy.
    fight(k, tension, surging, stun = 0) {
      fightState.stun = stun;
      fightState.k = Math.max(0, Math.min(1.4, k));
      fightState.tension = tension;
      fightState.surging = surging;
    },
    reel(_emoji, color, fish) {
      const look = RARITY_FISH[fish?.rarity] || { body: new THREE.Color(color).getHex(), fin: 0x333333 };
      // Mỗi loài một sắc màu riêng dựa trên mã loài.
      let hash = 0;
      for (const ch of fish?.id || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      const bodyCol = new THREE.Color(look.body).offsetHSL(((hash % 100) / 100 - 0.5) * 0.12, 0, ((hash % 7) - 3) * 0.03);
      // Cá 4D đúng loài (thân uốn lượn, đuôi vẫy) thay cho cá chung chung.
      caught = fish?.id ? buildFish3D(fish.id) : makeFish(bodyCol, look.fin, look.glow || 0);
      if (!caught.userData.swim) caught.userData.swim = () => {};
      caught.traverse((o) => { o.castShadow = true; });
      const tier = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(fish?.rarity);
      caught.scale.setScalar((0.7 + Math.max(0, tier) * 0.12) * (fish?.id ? 0.55 : 1));
      caught.userData.sparkle = new THREE.Color(color);
      scene.add(caught);
      caughtLight.color.set(color);
      caughtLight.intensity = tier >= 3 ? 4 + tier : 0;
      reelFrom.copy(phase === 'idle' || phase === 'charge' ? target : bobPos);
      splash(reelFrom, 90, 1.1);
      if (tier >= 4) splash(reelFrom, 60, 1.3, new THREE.Color(color), 4);
      ripple(reelFrom.x, reelFrom.z, 2.2);
      // Hiệu ứng mừng theo cần câu và vợt vàng
      if (gear.rod === 'gold') { burst(reelFrom, 120, null, { colors: GOLD, shape: 'up', speed: 1.5, up: 7, gravity: 6, fade: 0.8 }); flash(reelFrom, '#fbbf24', 10); }
      else if (gear.rod === 'dragon') { burst(reelFrom, 180, null, { colors: FIRE, shape: 'up', speed: 1, up: 9, gravity: 5, fade: 0.8 }); flash(reelFrom, '#f97316', 14); shake = 0.08; }
      else if (gear.rod !== 'bamboo') burst(reelFrom, 70, gear.fx, { shape: 'ring', speed: 3, up: 2, gravity: 4, fade: 1 });
      if (gear.net) setTimeout(() => { if (caught) { burst(caught.position, 90, null, { colors: GOLD, shape: 'ring', speed: 2, up: 0.2, gravity: 0, fade: 0.9 }); flash(caught.position, '#fde047', 8); } }, 700);
      setPhase('reel');
    },
    escape() {
      reelFrom.copy(phase === 'idle' || phase === 'charge' ? target : bobPos);
      splash(reelFrom, 70, 1); ripple(reelFrom.x, reelFrom.z, 2.5); setPhase('escape');
    },
    get phase() { return phase; },
  };
}
