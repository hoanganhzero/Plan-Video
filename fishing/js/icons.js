// Biểu tượng vật phẩm dạng SVG (viền đậm, đổ bóng mềm) – cùng phong cách với hình cá.
const O = '#1b2433';
let seq = 0;

function wrap(body, size, defs = '') {
  return `<svg class="ico-art" viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>${defs}</defs><ellipse cx="32" cy="58" rx="20" ry="3.5" fill="#000" opacity=".2"/>${body}</svg>`;
}
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const DRAW = {
  worm: () => `<path d="M14 44 C10 30 26 26 30 36 C34 46 48 44 46 30 C45 22 52 18 54 24" stroke="${O}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M14 44 C10 30 26 26 30 36 C34 46 48 44 46 30 C45 22 52 18 54 24" stroke="#f39aa8" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M22 32 l2 4 M34 40 l2 -4 M44 36 l3 -2" stroke="#c96a7c" stroke-width="2"/><circle cx="54" cy="23" r="1.6" fill="${O}"/>`,
  shrimp: (g) => `<path d="M48 16 C30 10 12 22 16 40 C18 50 30 54 40 48 L34 42 C28 46 22 42 24 36 C26 26 38 22 46 26 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M26 30 l6 4 M24 38 l7 1 M30 24 l4 6" stroke="#c2410c" stroke-width="2.4"/><path d="M48 16 C54 10 58 12 60 8 M48 18 C56 16 58 20 62 18" stroke="${O}" stroke-width="2" fill="none"/>
    <circle cx="44" cy="20" r="2.4" fill="${O}"/><path d="M40 48 L46 56 L34 52 Z" fill="#fb923c" stroke="${O}" stroke-width="3"/>`,
  golden: (g) => `<circle cx="32" cy="32" r="18" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/><circle cx="26" cy="26" r="5" fill="#fff" opacity=".7"/>
    <path d="M32 8 l3 7 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 Z" fill="#fff7cc" stroke="${O}" stroke-width="2.5" transform="translate(16 -4) scale(.5)"/>`,
  hint: (g) => `<path d="M32 6 C20 6 14 16 16 26 C17 32 22 35 24 40 L40 40 C42 35 47 32 48 26 C50 16 44 6 32 6 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/>
    <rect x="24" y="40" width="16" height="10" rx="3" fill="#94a3b8" stroke="${O}" stroke-width="3"/><path d="M26 45 h12" stroke="${O}" stroke-width="2"/>
    <path d="M26 18 C26 13 30 11 33 11" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><text x="32" y="33" font-size="12" font-weight="900" text-anchor="middle" fill="${O}" font-family="system-ui">50</text>`,
  time: (g) => `<rect x="16" y="6" width="32" height="6" rx="3" fill="#a16207" stroke="${O}" stroke-width="3"/><rect x="16" y="50" width="32" height="6" rx="3" fill="#a16207" stroke="${O}" stroke-width="3"/>
    <path d="M20 12 C20 26 30 28 30 31 C30 34 20 36 20 50 L44 50 C44 36 34 34 34 31 C34 28 44 26 44 12 Z" fill="#e0f2fe" stroke="${O}" stroke-width="3"/>
    <path d="M24 16 L40 16 C38 24 33 26 32 30 C31 26 26 24 24 16 Z M24 48 C26 40 30 38 32 36 C34 38 38 40 40 48 Z" fill="url(#${g})"/>`,
  charm: () => ['#22c55e', '#16a34a', '#4ade80', '#15803d'].map((c, i) => `<circle cx="${[24, 40, 24, 40][i]}" cy="${[22, 22, 36, 36][i]}" r="10" fill="${c}" stroke="${O}" stroke-width="3"/>`).join('')
    + `<path d="M32 30 C34 42 38 48 44 54" stroke="${O}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="32" cy="29" r="4" fill="#fde047" stroke="${O}" stroke-width="2"/>`,
  tea: (g) => `<path d="M12 26 L46 26 L42 50 C41 54 38 56 34 56 L24 56 C20 56 17 54 16 50 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M46 30 C56 30 56 44 44 44" stroke="${O}" stroke-width="4" fill="none"/><ellipse cx="29" cy="27" rx="15" ry="3" fill="#a3e635" stroke="${O}" stroke-width="2"/>
    <path d="M22 18 C20 14 24 12 22 6 M30 18 C28 14 32 12 30 6 M38 18 C36 14 40 12 38 6" stroke="#94a3b8" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  net: (g) => `<path d="M40 30 L58 56" stroke="#a16207" stroke-width="7" stroke-linecap="round"/><path d="M40 30 L58 56" stroke="${O}" stroke-width="2" stroke-linecap="round" opacity=".4"/>
    <ellipse cx="26" cy="24" rx="18" ry="16" fill="none" stroke="url(#${g})" stroke-width="6"/><ellipse cx="26" cy="24" rx="18" ry="16" fill="none" stroke="${O}" stroke-width="1.5"/>
    <path d="M12 16 L40 32 M10 26 L36 40 M16 34 L28 40 M18 10 L42 24 M26 8 L42 18 M14 32 L28 8 M22 38 L38 10 M30 40 L42 22" stroke="#fef3c7" stroke-width="1.8" opacity=".9"/>`,
  bread: (g) => `<path d="M10 34 C10 18 54 18 54 34 L54 48 C54 52 50 54 46 54 L18 54 C14 54 10 52 10 48 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/>
    <path d="M14 34 C14 24 50 24 50 34" fill="none" stroke="#fde68a" stroke-width="3" opacity=".8"/><path d="M22 30 l4 6 M32 28 l4 6 M42 30 l4 6" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>`,
  cricket: (g) => `<ellipse cx="34" cy="36" rx="18" ry="10" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/><circle cx="16" cy="32" r="7" fill="#65a30d" stroke="${O}" stroke-width="3"/>
    <circle cx="14" cy="30" r="1.8" fill="${O}"/><path d="M12 26 C6 14 14 8 20 6 M16 25 C14 14 22 10 28 8" stroke="${O}" stroke-width="2" fill="none"/>
    <path d="M40 44 L50 54 M30 44 L26 54 M46 30 L58 20 L60 34" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  minnow: (g) => `<path d="M8 32 C18 20 40 20 48 32 C40 44 18 44 8 32 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/><path d="M48 32 L60 22 L58 32 L60 42 Z" fill="#7dd3fc" stroke="${O}" stroke-width="3"/>
    <circle cx="18" cy="30" r="2.6" fill="${O}"/><path d="M24 26 C28 30 28 34 24 38" stroke="#e0f2fe" stroke-width="2" fill="none"/>`,
  squid: (g) => `<path d="M32 4 L46 24 L44 36 L20 36 L18 24 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="26" cy="30" r="2.6" fill="${O}"/><circle cx="38" cy="30" r="2.6" fill="${O}"/>
    <path d="M22 36 C20 46 14 50 12 56 M28 36 C28 46 24 52 24 58 M36 36 C36 46 40 52 40 58 M42 36 C44 46 50 50 52 56" stroke="#f472b6" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  glow: (g) => `<circle cx="32" cy="32" r="22" fill="#fef9c3" opacity=".35"/><path d="M32 8 L38 26 L56 26 L42 36 L48 54 L32 44 L16 54 L22 36 L8 26 L26 26 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="28" cy="26" r="3" fill="#fff"/>`,
  rainbow: () => `<path d="M8 46 A24 24 0 0 1 56 46" fill="none" stroke="#ef4444" stroke-width="5"/><path d="M13 46 A19 19 0 0 1 51 46" fill="none" stroke="#f59e0b" stroke-width="5"/>
    <path d="M18 46 A14 14 0 0 1 46 46" fill="none" stroke="#22c55e" stroke-width="5"/><path d="M23 46 A9 9 0 0 1 41 46" fill="none" stroke="#3b82f6" stroke-width="5"/>
    <path d="M6 46 H58" stroke="${O}" stroke-width="3"/><circle cx="50" cy="14" r="5" fill="#fff7cc" stroke="${O}" stroke-width="2"/>`,
};

const PALETTE = {
  shrimp: ['#fdba74', '#f97316'], golden: ['#fde68a', '#f59e0b'], hint: ['#fef08a', '#facc15'],
  time: ['#fde68a', '#f59e0b'], tea: ['#fef3c7', '#d97706'], net: ['#fde047', '#ca8a04'],
  bread: ['#fcd34d', '#b45309'], cricket: ['#a3e635', '#3f6212'], minnow: ['#e0f2fe', '#38bdf8'], squid: ['#fbcfe8', '#db2777'],
  glow: ['#fffbeb', '#facc15'],
};

export function itemIcon(id, size = 48) {
  const draw = DRAW[id];
  if (!draw) return '';
  const g = `ig${id}${seq++}`;
  const [a, b] = PALETTE[id] || ['#fff', '#ccc'];
  return wrap(draw(g), size, grad(g, a, b));
}

// Cần câu: màu theo cấp, cần xịn có ánh kim.
const ROD_COLORS = {
  bamboo: ['#d9b26a', '#8a6a2f'], reed: ['#fde047', '#a16207'], fiber: ['#7dd3fc', '#0369a1'], steel: ['#e5e7eb', '#475569'],
  carbon: ['#6b7280', '#111827'], jade: ['#6ee7b7', '#047857'], gold: ['#fde68a', '#d97706'], thunder: ['#c4b5fd', '#5b21b6'],
  dragon: ['#f87171', '#7f1d1d'], phoenix: ['#fda4af', '#be123c'],
};
export function rodIcon(id, size = 48) {
  const [a, b] = ROD_COLORS[id] || ROD_COLORS.bamboo;
  const g = `rg${id}${seq++}`;
  const bamboo = id === 'bamboo' || id === 'reed' ? '<path d="M22 44 l4 -3 M32 34 l4 -3 M42 24 l4 -3" stroke="#6b4e1f" stroke-width="2.5"/>' : '';
  const shine = ['gold', 'dragon', 'thunder', 'phoenix', 'jade'].includes(id) ? '<path d="M50 6 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 l5 -1 Z" fill="#fff7cc" stroke="#1b2433" stroke-width="1.5"/>' : '';
  return wrap(`<path d="M10 56 L54 12" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M10 56 L54 12" stroke="url(#${g})" stroke-width="5" stroke-linecap="round"/>
    ${bamboo}<circle cx="20" cy="46" r="7" fill="#cbd5e1" stroke="${O}" stroke-width="3"/><circle cx="20" cy="46" r="2.5" fill="${O}"/>
    <path d="M54 12 C58 24 56 34 52 40" stroke="#fff" stroke-width="1.5" fill="none" opacity=".9"/><circle cx="52" cy="42" r="3" fill="#ef4444" stroke="${O}" stroke-width="1.5"/>${shine}`, size, grad(g, a, b));
}

// Dây câu: cuộn dây có màu riêng.
export function lineIcon(color = '#e5e7eb', size = 48) {
  const g = `lg${seq++}`;
  return wrap(`<rect x="12" y="14" width="40" height="36" rx="6" fill="#475569" stroke="${O}" stroke-width="3.5"/>
    <rect x="18" y="18" width="28" height="28" rx="4" fill="url(#${g})" stroke="${O}" stroke-width="2.5"/>
    ${[22, 26, 30, 34, 38, 42].map((y) => `<path d="M18 ${y} H46" stroke="${O}" stroke-width="1" opacity=".35"/>`).join('')}
    <circle cx="32" cy="32" r="5" fill="#cbd5e1" stroke="${O}" stroke-width="2.5"/><path d="M46 22 C54 20 58 12 56 6" stroke="${color}" stroke-width="2.5" fill="none"/>`, size, grad(g, color, '#334155'));
}

// Thùng đựng cá: túi lưới, giỏ tre, thùng gỗ, thùng giữ lạnh, bể kính.
export function bucketIcon(id, size = 48) {
  const g = `bg${id}${seq++}`;
  const fish = '<path d="M22 22 C26 16 34 16 38 22 C34 28 26 28 22 22 Z M38 22 L44 17 L44 27 Z" fill="#fb923c" stroke="#1b2433" stroke-width="2"/>';
  const body = {
    bag: () => [`<path d="M14 20 L50 20 L44 54 L20 54 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>`,
      ...[24, 30, 36, 42, 48].map((x) => `<path d="M${x - 8} 20 L${x - 4} 54" stroke="${O}" stroke-width="1.5" opacity=".5"/>`),
      `<path d="M14 20 C18 8 46 8 50 20" fill="none" stroke="${O}" stroke-width="3"/>`].join(''),
    basket: () => `<path d="M10 24 L54 24 L48 54 L16 54 Z" fill="url(#${g})" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
      ${[32, 40, 48].map((y) => `<path d="M12 ${y} L52 ${y}" stroke="#92400e" stroke-width="2"/>`).join('')}<path d="M16 24 C16 6 48 6 48 24" fill="none" stroke="${O}" stroke-width="4"/>`,
    wood: () => `<rect x="10" y="22" width="44" height="32" rx="3" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/>
      <path d="M10 33 H54 M10 44 H54" stroke="${O}" stroke-width="2"/><rect x="26" y="16" width="12" height="6" rx="2" fill="#78350f" stroke="${O}" stroke-width="2.5"/>`,
    cooler: () => `<rect x="10" y="24" width="44" height="30" rx="5" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/>
      <rect x="8" y="18" width="48" height="10" rx="4" fill="#f8fafc" stroke="${O}" stroke-width="3"/><rect x="24" y="12" width="16" height="6" rx="3" fill="#cbd5e1" stroke="${O}" stroke-width="2.5"/>
      <path d="M18 34 l4 4 l-4 4 M18 38 h8" stroke="#e0f2fe" stroke-width="2"/>`,
    aquarium: () => `<rect x="8" y="16" width="48" height="38" rx="4" fill="url(#${g})" stroke="${O}" stroke-width="3.5"/>
      <path d="M8 24 H56" stroke="#e0f2fe" stroke-width="2" opacity=".8"/><path d="M14 54 C18 46 16 40 20 36 M46 54 C44 46 48 42 44 36" stroke="#16a34a" stroke-width="3" fill="none"/>
      <g transform="translate(2 14)">${fish}</g><circle cx="44" cy="30" r="2" fill="#fff" opacity=".8"/><circle cx="48" cy="26" r="1.4" fill="#fff" opacity=".8"/>`,
  }[id] || (() => '');
  const colors = { bag: ['#d4d4d4', '#737373'], basket: ['#fcd34d', '#b45309'], wood: ['#d97706', '#78350f'], cooler: ['#7dd3fc', '#0369a1'], aquarium: ['#a5f3fc', '#0891b2'] }[id] || ['#ddd', '#999'];
  return wrap(body(), size, grad(g, colors[0], colors[1]));
}
