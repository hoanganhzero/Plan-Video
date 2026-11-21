import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, normalizeState, normalizeLook, setLook, buyWear, ownsWear, levelFromXp } from '../fishing/js/engine.js';
import { ZONES, FISH, QUESTS, OUTFITS, HATS, HAIRS, DEFAULT_LOOK } from '../fishing/js/data.js';
import { sanitizeMeta } from '../fishing/js/world.js';
import { MAP_POS, worldMapSVG } from '../fishing/js/map.js';

test('diện mạo mặc định, bản lưu cũ được thêm diện mạo; dữ liệu lạ bị loại', () => {
  assert.deepEqual(newGame().look, DEFAULT_LOOK);
  const old = normalizeState({ xp: 10, coins: 5 });
  assert.deepEqual(old.look, DEFAULT_LOOK);
  assert.deepEqual(old.wardrobe, []);
  const bad = normalizeLook({ gender: 'x', skin: 99, hair: '<b>', hairColor: -1, outfit: 'hack', hat: 'nope' });
  assert.deepEqual(bad, DEFAULT_LOOK);
  // Đồ chưa mua không được mặc khi nạp bản lưu
  const st = normalizeState({ look: { outfit: 'royal', hat: 'crown', gender: 'nu' }, wardrobe: ['royal', 'fake'] });
  assert.equal(st.look.outfit, 'royal');
  assert.equal(st.look.hat, 'nonla');
  assert.equal(st.look.hair, 'ponytail', 'nữ mặc định tóc đuôi ngựa');
  assert.deepEqual(st.wardrobe, ['royal']);
});

test('đổi giới tính tự đổi kiểu tóc; mua trang phục cần đủ cấp và xu', () => {
  const st = newGame();
  st.coins = 1000;
  assert.ok(setLook(st, { gender: 'nu' }).ok);
  assert.equal(st.look.hair, 'ponytail');
  assert.ok(setLook(st, { hair: 'short' }).ok);
  assert.ok(setLook(st, { gender: 'nam' }).ok);
  assert.equal(st.look.hair, 'short', 'tóc hợp giới tính thì giữ nguyên');
  assert.equal(setLook(st, { outfit: 'baba' }).ok, false, 'chưa mua');
  assert.match(buyWear(st, 'aodai').reason, /cấp 6/);
  st.xp = 5000;
  assert.ok(levelFromXp(st.xp) >= 6);
  st.coins = 100;
  assert.match(buyWear(st, 'aodai').reason, /đủ xu/);
  st.coins = 2000;
  assert.ok(buyWear(st, 'aodai').ok);
  assert.equal(st.coins, 500);
  assert.equal(st.look.outfit, 'aodai', 'mua xong mặc luôn');
  assert.ok(ownsWear(st, 'aodai') && ownsWear(st, 'school') && ownsWear(st, 'none'));
  assert.match(buyWear(st, 'aodai').reason, /đã có/);
  assert.ok(buyWear(st, 'cap').ok);
  assert.equal(st.look.hat, 'cap');
  assert.ok(OUTFITS.length >= 10 && HATS.length >= 9 && HAIRS.some((h) => h.gender === 'nu') && HAIRS.some((h) => h.gender === 'nam'));
});

test('người chơi khác: diện mạo được lọc; người dùng bản cũ không có diện mạo', () => {
  const m = sanitizeMeta({ id: 'abcdef1234', name: 'Na', look: { gender: 'nu', hair: 'bun', outfit: 'royal', hat: 'crown', skin: 2, hairColor: 9 } });
  assert.deepEqual(m.look, { gender: 'nu', skin: 2, hair: 'bun', hairColor: 0, outfit: 'royal', hat: 'crown' });
  assert.equal(sanitizeMeta({ id: 'abcdef1234', name: 'Na' }).look, null);
  assert.equal(sanitizeMeta({ id: 'abcdef1234', look: 'xx' }).look, null);
});

test('9 khu câu: cấp tăng dần, có vị trí trên bản đồ, nhiệm vụ mở khu, mỗi khu ≥ 15 loài', () => {
  assert.equal(ZONES.length, 9);
  for (let i = 1; i < ZONES.length; i++) assert.ok(ZONES[i].level > ZONES[i - 1].level, ZONES[i].id);
  for (const z of ZONES) {
    assert.ok(MAP_POS[z.id], `${z.id} chưa có trên bản đồ`);
    assert.ok(FISH.filter((f) => f.zone === z.id).length >= 15, z.id);
    assert.ok(z.weights.length === 6 && z.weights.some((w) => w > 0));
    if (z.id !== 'pond') assert.ok(QUESTS.some((q) => q.reward.zone === z.id), `${z.id} cần nhiệm vụ mở khu`);
  }
  const svg = worldMapSVG({ zones: ['pond', 'mangrove'], zone: 'pond', collection: {} }, 'mangrove');
  for (const z of ZONES) assert.ok(svg.includes(`data-zone="${z.id}"`));
  assert.ok(!svg.includes('undefined') && !svg.includes('NaN'));
});
