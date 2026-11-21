// Bản đồ thế giới minh hoạ (SVG): làng – sông – rừng đước – núi – biển – san hô – vực sâu – biển băng – núi lửa, nối bằng đường đi.
import { ZONES, FISH } from './data.js';

export const MAP_POS = {
  pond: [120, 470], river: [290, 370], mangrove: [470, 530], lake: [410, 150], sea: [660, 300],
  coral: [770, 150], abyss: [850, 360], ice: [920, 95], volcano: [900, 530],
};

const O = '#1b2433';

function tree(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="0" width="4" height="9" fill="#6b4423"/><circle cx="0" cy="-4" r="9" fill="#2f7d3a" stroke="${O}" stroke-width="1.5"/><circle cx="-3" cy="-7" r="3" fill="#4ade80" opacity=".6"/></g>`;
}
function pine(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -18 L10 4 L-10 4 Z" fill="#1f5f3f" stroke="${O}" stroke-width="1.5"/><rect x="-2" y="4" width="4" height="5" fill="#6b4423"/></g>`;
}
function mountain(x, y, w, h) {
  return `<g><path d="M${x - w} ${y} L${x} ${y - h} L${x + w} ${y} Z" fill="#7b8aa0" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M${x - w * 0.33} ${y - h * 0.66} L${x} ${y - h} L${x + w * 0.33} ${y - h * 0.66} L${x + w * 0.12} ${y - h * 0.6} L${x} ${y - h * 0.7} L${x - w * 0.14} ${y - h * 0.58} Z" fill="#fff"/>
    <path d="M${x} ${y - h} L${x + w} ${y} L${x + w * 0.35} ${y} Z" fill="#000" opacity=".12"/></g>`;
}

function mangroveArt() {
  const t = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-6 8 L-2 -2 M6 8 L2 -2 M0 8 L0 -4" stroke="#6b4423" stroke-width="2.5"/><circle cx="0" cy="-9" r="9" fill="#3f6212" stroke="${O}" stroke-width="1.5"/></g>`;
  return `<path d="M410 500 C450 480 520 490 560 520 C570 560 520 590 450 590 C410 580 395 530 410 500 Z" fill="#7a6a4a" stroke="${O}" stroke-width="2" opacity=".85"/>
    ${[[425, 515], [450, 500], [520, 505], [545, 540], [430, 570], [505, 575]].map(([x, y]) => t(x, y)).join('')}`;
}
function coralArt() {
  const c = ['#f472b6', '#fb923c', '#a855f7', '#facc15'];
  return `<ellipse cx="770" cy="150" rx="95" ry="58" fill="#2dd4bf" opacity=".55"/>
    ${[[715, 115], [735, 195], [820, 120], [830, 185], [700, 160], [800, 210]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="M0 8 C-2 0 -8 -4 -6 -10 M0 8 C0 -2 0 -8 2 -14 M0 8 C3 0 8 -4 8 -10" stroke="${c[i % 4]}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`).join('')}`;
}
function iceArt() {
  return `<ellipse cx="920" cy="90" rx="80" ry="60" fill="#e0f2fe" opacity=".55"/>
    ${[[870, 60, 22], [960, 50, 16], [975, 130, 18], [880, 135, 14]].map(([x, y, r]) => `<path d="M${x - r} ${y + r * 0.5} L${x - r * 0.4} ${y - r} L${x + r * 0.3} ${y - r * 0.6} L${x + r} ${y + r * 0.5} Z" fill="#f8fafc" stroke="${O}" stroke-width="2"/><path d="M${x - r * 0.4} ${y - r} L${x} ${y + r * 0.5}" stroke="#7dd3fc" stroke-width="2"/>`).join('')}
    <path d="M840 22 C880 8 940 30 990 12" stroke="#34d399" stroke-width="6" fill="none" opacity=".55"/><path d="M845 34 C890 20 945 42 990 26" stroke="#a78bfa" stroke-width="5" fill="none" opacity=".45"/>`;
}
function volcanoArt() {
  return `<path d="M820 600 L880 470 L920 470 L985 600 Z" fill="#3a2418" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M880 470 L920 470 L912 480 L888 480 Z" fill="#ff6a00"/>
    <path d="M900 480 C896 510 906 530 896 560 C892 580 900 590 896 600" stroke="#ff6a00" stroke-width="5" fill="none"/>
    <circle cx="900" cy="462" r="20" fill="#ff8a3a" opacity=".35"/>
    ${[[890, 440], [906, 428], [898, 412]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${6 + i * 2}" fill="#78716c" opacity=".55"/>`).join('')}`;
}

export function worldMapSVG(state, selected) {
  const path = ZONES.map((z) => MAP_POS[z.id]);
  const d = path.map(([x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = path[i - 1];
    return `Q${(px + x) / 2 + (i % 2 ? 60 : -60)} ${(py + y) / 2 - 40} ${x} ${y}`;
  }).join(' ');
  const opened = ZONES.filter((z) => state.zones.includes(z.id)).length;
  // Đoạn đường đã mở được tô vàng.
  const openD = path.slice(0, opened).map(([x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = path[i - 1];
    return `Q${(px + x) / 2 + (i % 2 ? 60 : -60)} ${(py + y) / 2 - 40} ${x} ${y}`;
  }).join(' ');

  const nodes = ZONES.map((z) => {
    const [x, y] = MAP_POS[z.id];
    const open = state.zones.includes(z.id);
    const here = z.id === state.zone;
    const sel = z.id === selected;
    const found = FISH.filter((f) => f.zone === z.id && state.collection[f.id]).length;
    const total = FISH.filter((f) => f.zone === z.id).length;
    const stars = Math.round((found / total) * 3);
    return `<g class="map-node ${open ? 'open' : 'locked'} ${here ? 'here' : ''} ${sel ? 'sel' : ''}" data-zone="${z.id}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${z.name}">
      <circle class="halo" r="46"/>
      <circle r="34" fill="${open ? `url(#mz-${z.id})` : '#475569'}" stroke="#fff" stroke-width="5"/>
      <circle r="34" fill="none" stroke="${O}" stroke-width="2"/>
      <text y="12" text-anchor="middle" font-size="34">${open ? z.icon : '🔒'}</text>
      <g transform="translate(0 52)">
        <rect x="-66" y="-14" width="132" height="28" rx="14" fill="${here ? '#ffc531' : 'rgba(9,30,48,.88)'}" stroke="${O}" stroke-width="2"/>
        <text y="6" text-anchor="middle" font-size="15" font-weight="800" fill="${here ? '#3b2500' : '#fff'}">${z.name}</text>
      </g>
      <text y="-42" text-anchor="middle" font-size="16">${open ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : `Cấp ${z.level}`}</text>
      ${here ? '<g class="boat" transform="translate(30 -30)"><text font-size="28">⛵</text></g>' : ''}
    </g>`;
  }).join('');

  const zoneGrads = ZONES.map((z) => `<radialGradient id="mz-${z.id}" cx=".4" cy=".35"><stop offset="0" stop-color="${z.sky[1]}"/><stop offset=".55" stop-color="${z.water[0]}"/><stop offset="1" stop-color="${z.water[1]}"/></radialGradient>`).join('');

  return `<svg class="world-map" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Bản đồ khu câu">
  <defs>
    <linearGradient id="m-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".6" stop-color="#0369a1"/><stop offset="1" stop-color="#0b1a4a"/></linearGradient>
    <linearGradient id="m-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3d977"/><stop offset="1" stop-color="#5e9e3c"/></linearGradient>
    <radialGradient id="m-abyss" cx=".5" cy=".5"><stop offset="0" stop-color="#020617"/><stop offset=".7" stop-color="#1e1b4b"/><stop offset="1" stop-color="#1e3a8a" stop-opacity="0"/></radialGradient>
    <pattern id="m-wave" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 q10 -8 20 0 t20 0" stroke="#fff" stroke-width="1.5" fill="none" opacity=".25"/></pattern>
    ${zoneGrads}
  </defs>
  <rect width="1000" height="600" fill="url(#m-sea)"/>
  <rect width="1000" height="600" fill="url(#m-wave)"/>
  <ellipse cx="850" cy="360" rx="150" ry="120" fill="url(#m-abyss)"/>
  <g class="swirl" transform="translate(850 360)">${[0, 1, 2].map((i) => `<path d="M0 0 C${30 + i * 25} -${20 + i * 20} ${60 + i * 30} ${20 + i * 15} 0 ${70 + i * 25}" stroke="#818cf8" stroke-width="2" fill="none" opacity=".45" transform="rotate(${i * 120})"/>`).join('')}</g>
  ${[[790, 300], [910, 320], [880, 430], [800, 420], [940, 380]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#a5f3fc"/>`).join('')}
  <path d="M0 0 H560 C600 80 540 150 600 230 C650 300 560 360 590 440 C610 500 540 560 520 600 H0 Z" fill="url(#m-land)" stroke="${O}" stroke-width="3"/>
  <path d="M560 0 C600 80 540 150 600 230 C650 300 560 360 590 440 C610 500 540 560 520 600" stroke="#fde68a" stroke-width="10" fill="none" opacity=".8"/>
  ${mountain(330, 150, 90, 120)}${mountain(470, 120, 80, 110)}${mountain(560, 170, 60, 80)}${mountain(220, 120, 70, 90)}
  <ellipse cx="420" cy="150" rx="70" ry="30" fill="#38bdf8" stroke="${O}" stroke-width="2.5"/>
  <path d="M410 178 C380 240 300 260 330 330 C350 380 250 400 190 440 C160 460 200 500 240 520 C320 560 470 470 560 520 C600 540 620 560 640 600" stroke="${O}" stroke-width="18" fill="none" stroke-linecap="round"/>
  <path d="M410 178 C380 240 300 260 330 330 C350 380 250 400 190 440 C160 460 200 500 240 520 C320 560 470 470 560 520 C600 540 620 560 640 600" stroke="#38bdf8" stroke-width="13" fill="none" stroke-linecap="round"/>
  <ellipse cx="150" cy="455" rx="62" ry="36" fill="#38bdf8" stroke="${O}" stroke-width="2.5"/>
  ${[[60, 380], [90, 520], [250, 470], [70, 300], [470, 380], [500, 300], [430, 470], [270, 560], [120, 560], [40, 440]].map(([x, y], i) => tree(x, y, 0.9 + (i % 3) * 0.2)).join('')}
  ${[[240, 210], [520, 220], [300, 230], [180, 250], [560, 260], [540, 300]].map(([x, y]) => pine(x, y, 1.1)).join('')}
  <g transform="translate(240 520)"><path d="M-16 0 L16 0 L12 -14 L-12 -14 Z" fill="#b45309" stroke="${O}" stroke-width="2"/><path d="M-18 -14 L0 -28 L18 -14 Z" fill="#7c2d12" stroke="${O}" stroke-width="2"/></g>
  ${[[660, 120, 26], [820, 160, 18], [760, 230, 12]].map(([x, y, r]) => `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="#fde68a" stroke="${O}" stroke-width="2"/><path d="M${x} ${y - 4} C${x + 2} ${y - 20} ${x + 8} ${y - 26} ${x + 14} ${y - 28} M${x + 2} ${y - 22} c-8 -6 -14 -2 -16 2 M${x + 4} ${y - 24} c6 -8 14 -6 16 -2" stroke="#166534" stroke-width="3" fill="none"/></g>`).join('')}
  <g transform="translate(640 380)"><rect x="-6" y="-34" width="12" height="34" fill="#fff" stroke="${O}" stroke-width="2"/><rect x="-6" y="-24" width="12" height="7" fill="#ef4444"/><rect x="-6" y="-10" width="12" height="7" fill="#ef4444"/><path d="M-8 -34 L0 -44 L8 -34 Z" fill="#334155"/><circle cx="0" cy="-38" r="12" fill="#fde047" opacity=".35"/></g>
  ${mangroveArt()}${coralArt()}${iceArt()}${volcanoArt()}
  <path d="${d}" stroke="#1b2433" stroke-width="9" fill="none" stroke-linecap="round" opacity=".55"/>
  <path d="${d}" stroke="#fff" stroke-width="5" fill="none" stroke-dasharray="2 14" stroke-linecap="round" opacity=".85"/>
  ${openD ? `<path d="${openD}" stroke="#ffc531" stroke-width="6" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>` : ''}
  ${nodes}
  <g transform="translate(940 60)"><circle r="30" fill="rgba(9,30,48,.8)" stroke="#fff" stroke-width="2"/><text y="-12" text-anchor="middle" font-size="14" font-weight="800" fill="#ffc531">B</text><path d="M0 -8 L6 8 L0 4 L-6 8 Z" fill="#fff"/></g>
</svg>`;
}
