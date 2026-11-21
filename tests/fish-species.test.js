import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FISH, ZONES, RARITIES } from '../fishing/js/data.js';
import { LOOK, fishSVG, shade } from '../fishing/js/art.js';

test('khoảng 100 loài cá, mã không trùng, mỗi khu có đủ loài', () => {
  assert.ok(FISH.length >= 100, `chỉ có ${FISH.length} loài`);
  assert.equal(new Set(FISH.map((f) => f.id)).size, FISH.length);
  assert.equal(new Set(FISH.map((f) => f.name)).size, FISH.length, 'tên loài không trùng');
  for (const z of ZONES) assert.ok(FISH.filter((f) => f.zone === z.id).length >= 18, `${z.id} cần ≥ 18 loài`);
  for (const f of FISH) {
    assert.ok(RARITIES.some((r) => r.id === f.rarity), f.id);
    assert.ok(f.kg[0] > 0 && f.kg[1] >= f.kg[0], `${f.id} kg`);
    assert.ok(f.value > 0, f.id);
  }
});

test('mỗi loài có hình riêng (dáng, màu, hoa văn hợp lệ) và vẽ được SVG', () => {
  const shapes = ['classic', 'round', 'long', 'koi', 'eel', 'flat', 'sword', 'lantern', 'puffer', 'dragon', 'angel', 'shark', 'ray', 'betta'];
  const patterns = ['none', 'stripes', 'spots', 'scales', 'bands', 'glow', 'rainbow', 'whiskers', 'tiger', 'clown', 'lines', 'dots', 'crown'];
  for (const f of FISH) {
    const l = LOOK[f.id];
    assert.ok(l, `${f.id} thiếu hình`);
    assert.ok(shapes.includes(l.shape), `${f.id} dáng ${l.shape}`);
    assert.ok(patterns.includes(l.pattern), `${f.id} hoa văn ${l.pattern}`);
    for (const c of [l.top, l.belly, l.fin]) assert.match(c, /^#[0-9a-f]{6}$/i);
    const svg = fishSVG(f.id, { uid: `x${f.id}` });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    assert.ok(!svg.includes('undefined') && !svg.includes('NaN'), `${f.id} SVG lỗi`);
  }
  assert.equal(shade('#808080', -0.5), '#404040');
  assert.equal(shade('#000000', 0.5), '#808080');
});
