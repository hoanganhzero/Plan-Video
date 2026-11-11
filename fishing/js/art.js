// Hình minh hoạ cá dạng vector (SVG) kiểu thẻ game hoạt hình: viền đậm, đổ bóng mềm, mắt to.
// Mỗi loài có dáng (shape), màu thân (top/belly), vây (fin) và hoa văn (pattern) riêng.
import { fishById, rarityOf, rarityIndex } from './data.js';

// shape: classic | round | long | eel | flat | sword | lantern | puffer | koi | dragon
// pattern: none | stripes | spots | scales | bands | glow | rainbow | whiskers
const LOOK = {
  ro: { shape: 'classic', top: '#6b7f3a', belly: '#d8d48a', fin: '#4e5e27', pattern: 'stripes' },
  diec: { shape: 'round', top: '#9aa3a8', belly: '#eef1e6', fin: '#7c8a90', pattern: 'scales' },
  tre: { shape: 'long', top: '#4b4038', belly: '#a9967f', fin: '#2f2722', pattern: 'whiskers' },
  chep: { shape: 'koi', top: '#b8892f', belly: '#f2d48a', fin: '#8f6420', pattern: 'scales' },
  loc: { shape: 'long', top: '#3d4a3a', belly: '#c9c7a6', fin: '#2a3228', pattern: 'spots' },
  chep_do: { shape: 'koi', top: '#e8402a', belly: '#ffd2b8', fin: '#ff8a5c', pattern: 'scales' },
  me: { shape: 'classic', top: '#8a96a0', belly: '#f1f4f6', fin: '#6d7a85', pattern: 'scales' },
  tram: { shape: 'long', top: '#6e7d4f', belly: '#e3e0bd', fin: '#525e39', pattern: 'scales' },
  basa: { shape: 'long', top: '#7d8fa3', belly: '#f4f6f8', fin: '#5d6f82', pattern: 'whiskers' },
  lang: { shape: 'long', top: '#7a6a8c', belly: '#ece6f1', fin: '#5a4c6b', pattern: 'whiskers' },
  bong: { shape: 'round', top: '#8c6b3e', belly: '#e8d3a8', fin: '#6b4e28', pattern: 'spots' },
  chien: { shape: 'long', top: '#4a5a6e', belly: '#d9dfe6', fin: '#33404f', pattern: 'spots' },
  anh_vu: { shape: 'classic', top: '#c9a24a', belly: '#fff0c2', fin: '#e6c56a', pattern: 'scales' },
  suoi: { shape: 'classic', top: '#5e8a7a', belly: '#e6f2ea', fin: '#3f6b5c', pattern: 'spots' },
  hoi_van: { shape: 'classic', top: '#5f8f9e', belly: '#ffd6cc', fin: '#467584', pattern: 'spots' },
  tam: { shape: 'sword', top: '#5b6670', belly: '#dfe4e8', fin: '#3e4952', pattern: 'bands' },
  chinh: { shape: 'eel', top: '#6a5a2e', belly: '#e8dca2', fin: '#4a3e1e', pattern: 'spots' },
  hoi_vang: { shape: 'classic', top: '#f2b81c', belly: '#fff3c4', fin: '#ff9f1c', pattern: 'scales' },
  chep_rong: { shape: 'dragon', top: '#e2322c', belly: '#ffd27a', fin: '#ffb21e', pattern: 'scales' },
  com: { shape: 'long', top: '#7fa6c4', belly: '#f2f8fc', fin: '#5c86a6', pattern: 'stripes' },
  nuc: { shape: 'classic', top: '#4f7ea8', belly: '#eef4f9', fin: '#e3c43a', pattern: 'stripes' },
  thu: { shape: 'long', top: '#2f5f8f', belly: '#e9f0f6', fin: '#1f4570', pattern: 'bands' },
  mu: { shape: 'round', top: '#8a5a3a', belly: '#f0d6b6', fin: '#6b3f24', pattern: 'spots' },
  ngu: { shape: 'classic', top: '#1f3f78', belly: '#e6eef8', fin: '#f2c230', pattern: 'none' },
  co_xanh: { shape: 'sword', top: '#1d4fa3', belly: '#e3edfa', fin: '#2a74d6', pattern: 'bands' },
  bay_sac: { shape: 'classic', top: '#8b5cf6', belly: '#fde4ff', fin: '#22d3ee', pattern: 'rainbow' },
  den_long: { shape: 'lantern', top: '#3b2f4f', belly: '#7a6a94', fin: '#2a2140', pattern: 'glow' },
  riu_bac: { shape: 'flat', top: '#a7b4c2', belly: '#f4f7fa', fin: '#8597aa', pattern: 'glow' },
  mat_trang: { shape: 'flat', top: '#9aa4b8', belly: '#eef0f6', fin: '#7a859c', pattern: 'spots' },
  mai_cheo: { shape: 'eel', top: '#d9dde6', belly: '#ffffff', fin: '#ff4d6d', pattern: 'bands' },
  vay_tay: { shape: 'classic', top: '#2c4a7a', belly: '#9fb6d9', fin: '#24406b', pattern: 'spots' },
  rong_thieng: { shape: 'dragon', top: '#16a34a', belly: '#fde68a', fin: '#facc15', pattern: 'glow' },
};

// Đường viền thân theo dáng (khung 200×120, đầu quay sang phải).
const BODY = {
  classic: 'M30 60 C45 25 110 18 150 34 C172 43 186 52 188 60 C186 68 172 77 150 86 C110 102 45 95 30 60 Z',
  round: 'M40 60 C48 18 128 12 160 38 C176 50 182 56 182 60 C182 64 176 70 160 82 C128 108 48 102 40 60 Z',
  long: 'M22 60 C40 38 100 32 158 40 C176 44 188 54 190 60 C188 66 176 76 158 80 C100 88 40 82 22 60 Z',
  koi: 'M28 60 C42 22 112 14 152 32 C174 42 186 53 188 60 C186 67 174 78 152 88 C112 106 42 98 28 60 Z',
  eel: 'M14 64 C40 48 70 70 100 56 C130 42 160 46 186 56 C190 60 188 66 184 68 C160 72 132 66 104 78 C74 92 40 74 14 64 Z',
  flat: 'M50 60 C50 14 150 10 170 40 C178 52 180 58 180 60 C180 62 178 68 170 80 C150 110 50 106 50 60 Z',
  sword: 'M26 60 C44 34 104 28 150 40 C168 46 176 54 178 58 L198 60 L178 62 C176 66 168 74 150 80 C104 92 44 86 26 60 Z',
  lantern: 'M44 62 C44 22 132 14 166 44 C178 54 182 60 180 66 C176 76 160 90 130 96 C86 104 44 96 44 62 Z',
  puffer: 'M44 60 C44 16 156 16 170 50 C174 58 174 62 170 70 C156 104 44 104 44 60 Z',
  dragon: 'M24 62 C40 26 112 16 154 32 C176 41 190 54 192 62 C190 70 176 80 154 88 C112 104 40 98 24 62 Z',
};

const esc = (s) => String(s).replace(/[<>&"]/g, '');

export function fishSVG(fishId, { size = 120, uid = fishId } = {}) {
  const fish = fishById(fishId);
  const look = LOOK[fishId] || { shape: 'classic', top: '#6b8fa8', belly: '#eef4f8', fin: '#4d6f88', pattern: 'none' };
  const tier = fish ? rarityIndex(fish.rarity) : 0;
  const id = `f${esc(uid)}`;
  const body = BODY[look.shape] || BODY.classic;
  const outline = '#1b2433';
  const tailX = look.shape === 'eel' ? 14 : look.shape === 'flat' ? 50 : 30;
  const tail = look.shape === 'flat'
    ? `M${tailX + 4} 40 C34 46 34 74 ${tailX + 4} 80 C${tailX - 4} 70 ${tailX - 4} 50 ${tailX + 4} 40 Z`
    : `M${tailX + 6} 60 C${tailX - 6} 40 ${tailX - 20} 26 ${tailX - 24} 30 C${tailX - 16} 46 ${tailX - 16} 74 ${tailX - 24} 90 C${tailX - 20} 94 ${tailX - 6} 80 ${tailX + 6} 60 Z`;
  const eyeX = look.shape === 'flat' ? 150 : look.shape === 'eel' ? 172 : look.shape === 'round' || look.shape === 'puffer' ? 150 : 160;
  const eyeY = look.shape === 'eel' ? 57 : 50;

  let pattern = '';
  if (look.pattern === 'stripes') {
    pattern = [70, 92, 114, 136].map((x) => `<path d="M${x} 30 C${x - 6} 50 ${x - 6} 70 ${x} 90" stroke="${look.fin}" stroke-width="7" opacity=".45" fill="none"/>`).join('');
  } else if (look.pattern === 'bands') {
    pattern = [60, 85, 110, 135].map((x) => `<path d="M${x} 32 L${x + 10} 32 L${x + 4} 88 L${x - 6} 88 Z" fill="${look.fin}" opacity=".35"/>`).join('');
  } else if (look.pattern === 'spots') {
    pattern = [[70, 46, 5], [92, 40, 4], [112, 50, 6], [80, 66, 4], [130, 42, 4], [104, 70, 5], [136, 62, 4]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${look.fin}" opacity=".55"/>`).join('');
  } else if (look.pattern === 'scales') {
    for (let x = 64; x < 150; x += 16) for (let y = 40; y < 84; y += 14) {
      pattern += `<path d="M${x} ${y} q8 9 16 0" stroke="${look.fin}" stroke-width="2.4" fill="none" opacity=".5"/>`;
    }
  } else if (look.pattern === 'rainbow') {
    pattern = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map((c, i) => `<path d="M${50 + i * 26} 28 C${44 + i * 26} 50 ${44 + i * 26} 72 ${50 + i * 26} 92" stroke="${c}" stroke-width="9" opacity=".55" fill="none"/>`).join('');
  } else if (look.pattern === 'glow') {
    pattern = [[70, 50], [96, 64], [122, 48], [146, 66], [84, 76]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#a5f3fc"/><circle cx="${x}" cy="${y}" r="8" fill="#67e8f9" opacity=".25"/>`).join('');
  }
  const whiskers = look.pattern === 'whiskers' || look.shape === 'koi' || look.shape === 'dragon'
    ? `<path d="M182 64 C196 70 200 82 194 90 M180 66 C188 76 186 88 178 94" stroke="${outline}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : '';
  const lure = look.shape === 'lantern'
    ? `<path d="M150 36 C152 10 176 4 184 16" stroke="${outline}" stroke-width="3" fill="none"/><circle cx="185" cy="18" r="9" fill="#fde047"/><circle cx="185" cy="18" r="18" fill="#fde047" opacity=".3"/>
       <path d="M160 74 l6 8 l5 -8 l6 8 l5 -8" stroke="#fff" stroke-width="2.5" fill="none"/>` : '';
  const crown = look.shape === 'dragon'
    ? `<path d="M120 26 L128 4 L136 24 L146 8 L150 30" fill="${look.fin}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>` : '';
  const dorsal = look.shape === 'eel'
    ? `<path d="M40 56 C80 40 130 36 170 48" stroke="${look.fin}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    : look.shape === 'flat'
      ? `<path d="M110 16 C122 -2 138 -2 140 20 Z" fill="${look.fin}" stroke="${outline}" stroke-width="3.5"/><path d="M110 104 C122 122 138 122 140 100 Z" fill="${look.fin}" stroke="${outline}" stroke-width="3.5"/>`
      : `<path d="M70 32 C84 4 124 2 140 30 Z" fill="${look.fin}" stroke="${outline}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const glowFx = tier >= 4
    ? `<ellipse cx="105" cy="60" rx="98" ry="52" fill="url(#${id}g)" />` : '';

  return `<svg class="fish-art" viewBox="-10 -10 220 140" width="${size}" height="${Math.round(size * 0.64)}" role="img" aria-label="${esc(fish?.name || '')}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${look.top}"/><stop offset=".55" stop-color="${look.top}"/><stop offset="1" stop-color="${look.belly}"/>
    </linearGradient>
    <radialGradient id="${id}g"><stop offset=".5" stop-color="${rarityOf(fish?.rarity || 'common').color}" stop-opacity=".45"/><stop offset="1" stop-color="${rarityOf(fish?.rarity || 'common').color}" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}c"><path d="${body}"/></clipPath>
  </defs>
  ${glowFx}
  <ellipse cx="108" cy="116" rx="70" ry="7" fill="#000" opacity=".18"/>
  <path d="${tail}" fill="${look.fin}" stroke="${outline}" stroke-width="3.5" stroke-linejoin="round"/>
  ${dorsal}${crown}
  <path d="${body}" fill="url(#${id}b)" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/>
  <g clip-path="url(#${id}c)">${pattern}
    <ellipse cx="110" cy="40" rx="58" ry="10" fill="#fff" opacity=".28"/>
  </g>
  <path d="M112 66 C120 82 136 84 140 74 Z" fill="${look.fin}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M${eyeX - 22} 40 C${eyeX - 14} 56 ${eyeX - 14} 70 ${eyeX - 22} 82" stroke="${outline}" stroke-width="2.5" fill="none" opacity=".45"/>
  <circle cx="${eyeX}" cy="${eyeY}" r="10" fill="#fff" stroke="${outline}" stroke-width="3"/>
  <circle cx="${eyeX + 2}" cy="${eyeY + 1}" r="5.5" fill="${outline}"/>
  <circle cx="${eyeX + 4}" cy="${eyeY - 2}" r="2" fill="#fff"/>
  ${whiskers}${lure}
</svg>`;
}

export const hasArt = (fishId) => !!LOOK[fishId];
