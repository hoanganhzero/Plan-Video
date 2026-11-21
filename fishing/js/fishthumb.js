// Ảnh cá "4D": chụp mô hình 3D (fish3d.js) thành ảnh để dùng trong Sưu tập, Thùng cá, bản đồ.
// - Lúc đầu vẫn hiện hình vẽ SVG (nhanh, không cần WebGL); mỗi khung hình dựng thêm vài con rồi thay bằng ảnh 3D.
// - Ảnh giữ trong bộ nhớ của trang (mỗi loài dựng một lần). Máy không có WebGL → giữ nguyên hình SVG.
// - Bấm vào cá ở Sưu tập vẫn mở khung xem 4D (cá bơi, xoay được).
import * as THREE from '../vendor/three.module.min.js';
import { buildFish3D } from './fish3d.js';
import { fishSVG } from './art.js';

const W = 360;
const H = 270;
const cache = new Map();
let renderer = null;
let scene = null;
let camera = null;
let failed = false;

function setup() {
  if (renderer || failed) return !failed;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(0, 0.35, 5);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x1b2433, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight(0xbfe9ff, 2);
    rim.position.set(-3, 1.5, -3);
    scene.add(key, rim);
  } catch {
    failed = true;
    renderer = null;
  }
  return !failed;
}

function dispose(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
  });
}

// Dựng ảnh 3D của một loài (đồng bộ). Trả về data URL hoặc null nếu không dựng được.
export function fishThumbURL(fishId) {
  if (cache.has(fishId)) return cache.get(fishId);
  if (!setup()) return null;
  let url = null;
  let fish = null;
  try {
    fish = buildFish3D(fishId);
    fish.userData.swim(0.35, 0.7); // hơi uốn thân cho sinh động
    const holder = new THREE.Group();
    holder.add(fish);
    // Cá đuối dẹt: nghiêng để thấy lưng.
    if (fish.userData.shape === 'ray') holder.rotation.set(0.95, -0.35, 0);
    else holder.rotation.set(0.12, -0.42, 0);
    // Canh vừa khung: đưa tâm về gốc toạ độ, phóng cho vừa chiều rộng/cao.
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    fish.position.sub(center);
    const s = Math.min(3.2 / Math.max(size.x, 0.01), 2.2 / Math.max(size.y, 0.01));
    holder.scale.setScalar(s);
    scene.add(holder);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/webp', 0.9);
    if (!url.startsWith('data:image/webp')) url = renderer.domElement.toDataURL('image/png');
    scene.remove(holder);
  } catch (err) {
    console.warn('Không dựng được ảnh 3D cho', fishId, err);
    url = null;
  }
  if (fish) dispose(fish);
  cache.set(fishId, url);
  return url;
}

// Hình cá dùng trong giao diện: có sẵn ảnh 3D thì dùng luôn, chưa có thì hiện SVG và đánh dấu để thay sau.
export function fishArt(fishId, { size = 120, uid = fishId } = {}) {
  const url = cache.get(fishId);
  const h = Math.round(size * 0.75);
  if (url) return `<img class="fish-art fish-3d" src="${url}" width="${size}" height="${h}" alt="" draggable="false">`;
  return fishSVG(fishId, { size, uid }).replace('<svg class="fish-art"', `<svg class="fish-art" data-fish="${fishId}"`);
}

// Thay dần các hình SVG có data-fish bằng ảnh 3D (vài con mỗi khung hình để không giật).
const pending = new Set();
let pumping = false;
function pump() {
  pumping = true;
  const start = performance.now();
  for (const el of pending) {
    if (performance.now() - start > 14) break;
    pending.delete(el);
    if (!el.isConnected) continue;
    const id = el.dataset.fish;
    const url = fishThumbURL(id);
    if (!url) { if (failed) { pending.clear(); break; } continue; }
    const img = new Image();
    img.className = 'fish-art fish-3d';
    img.alt = '';
    img.draggable = false;
    img.width = Number(el.getAttribute('width')) || 120;
    img.height = Number(el.getAttribute('height')) || 90;
    img.src = url;
    el.replaceWith(img);
  }
  if (pending.size && !failed) requestAnimationFrame(pump);
  else pumping = false;
}

export function upgradeFishArt(root = document) {
  if (failed) return;
  root.querySelectorAll?.('svg.fish-art[data-fish]').forEach((el) => pending.add(el));
  if (pending.size && !pumping) requestAnimationFrame(pump);
}

// Tự thay mọi hình cá mới xuất hiện trên trang.
export function autoUpgradeFishArt(root = document.body) {
  if (typeof MutationObserver === 'undefined') return;
  const mo = new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) upgradeFishArt(n.matches?.('svg.fish-art[data-fish]') ? n.parentNode : n);
  });
  mo.observe(root, { childList: true, subtree: true });
  upgradeFishArt(root);
}
