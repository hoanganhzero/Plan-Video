// Giao diện "Câu Cá Học Giỏi" kiểu game câu cá 3D:
// giữ để lấy lực ném → chờ cá cắn → giật cần → giữ/thả để kéo cá, trả lời câu hỏi ở các mốc → thẻ kết quả.
import {
  SAVE_KEY, newGame, normalizeState, levelProgress, levelFromXp, currentBait, totalLuck, rarityChances,
  startCast, nextQuestion, currentLine, buyLine, LINES, lineById, answerQuestion, landFish, loseFish, useHelper, fiftyFifty, sellFish, bucketValue,
  activeQuests, questProgress, claimQuest, describeReward, buyShopItem, buyRod, unlockZone, zoneFish, speciesTotal,
  RARITIES, ZONES, RODS, ITEMS, SHOP, QUESTS, fishById, zoneById, rodById,
} from './engine.js';
import { SUBJECTS, GRADES, rarityOf, rarityIndex, subjectById } from './data.js';
import { parseCustomQuestions } from './questions.js';
import { createFight, stepFight, answerInFight, surging } from './fight.js';
import { createScene } from './scene.js';
import { fishSVG } from './art.js';
import { itemIcon, rodIcon, lineIcon } from './icons.js';
import { worldMapSVG } from './map.js';
import { getFishViewer } from './fish3d.js';
import {
  submitScore, topPlayers, myRank, validNickname, cleanNickname, ensurePlayerKey, rarityColor, rarityName,
} from './online.js';
import { createScene3D, webglAvailable } from './scene3d.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const tag = (rarityId, label) => { const r = rarityOf(rarityId); return `<span class="rarity-tag" style="background:${r.color}">${label || r.name}</span>`; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Lưu / tải ----------
function load() {
  try { return normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return newGame(); }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
}
let state = load();

// Ưu tiên cảnh 3D; máy không hỗ trợ WebGL thì dùng cảnh 2D.
function makeScene() {
  if (webglAvailable()) {
    try { return createScene3D($('#scene')); } catch (err) { console.warn('3D không khởi tạo được, dùng 2D:', err); }
    const fresh = $('#scene').cloneNode(false);
    $('#scene').replaceWith(fresh);
  }
  return createScene($('#scene'));
}
const scene = makeScene();
let doneQuestIds = new Set(activeQuests(state).filter((q) => questProgress(state, q).done).map((q) => q.id));

// ---------- Âm thanh ----------
let audioCtx = null;
function beep(notes, type = 'triangle', vol = 0.12) {
  if (!state.settings.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const [freq, dur] of notes) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = freq;
      o.type = type;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch { /* không hỗ trợ âm thanh */ }
}
const SOUND = {
  cast: [[420, 0.06], [260, 0.14]],
  splash: [[180, 0.12], [120, 0.18]],
  bite: [[880, 0.07], [990, 0.07], [880, 0.07]],
  hook: [[660, 0.06], [990, 0.12]],
  right: [[523, 0.09], [659, 0.09], [784, 0.16]],
  wrong: [[300, 0.14], [220, 0.24]],
  snap: [[900, 0.04], [200, 0.3]],
  catch: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.28]],
  level: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [1319, 0.3]],
  click: [[700, 0.04]],
};

// ---------- Thông báo ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
let bannerTimer;
function banner(html, cls = '', ms = 1300) {
  const el = $('#banner');
  el.className = `banner show ${cls}`;
  el.innerHTML = html;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
}
const hint = (html) => { $('#scene-msg').innerHTML = html; };

// ---------- Bảng (sheet) ----------
const RENDER = {};
function openSheet(id) {
  if (game.mode !== 'idle' && id !== 'settings') { toast('Đang câu – hãy chờ xong lượt này nhé!'); return; }
  const dlg = $(`#sheet-${id}`);
  if (!dlg) return;
  RENDER[id]?.();
  beep(SOUND.click);
  dlg.showModal();
}
$$('[data-open]').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.open)));
$$('.sheet [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('.sheet').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', renderHud);
});

// ---------- HUD ----------
function renderHud() {
  const lp = levelProgress(state.xp);
  $('#hud-coins').textContent = fmt(state.coins);
  $('#hud-level').textContent = lp.level;
  $('#hud-xp').style.width = `${Math.round(lp.ratio * 100)}%`;
  $('#hud-xptext').textContent = `${fmt(lp.current)} / ${fmt(lp.needed)} KN`;
  $('#hud-title').textContent = state.titles.at(-1) || '';
  $('#hud-streak').textContent = state.stats.streak;
  $('#hud-species').textContent = `${Object.keys(state.collection).length}/${speciesTotal()}`;
  const z = zoneById(state.zone);
  $('#zone-pill').innerHTML = `${z.icon} ${esc(z.name)} ▾`;
  const ready = activeQuests(state).filter((q) => questProgress(state, q).done).length;
  $('#quest-badge').hidden = !ready;
  $('#quest-badge').textContent = ready;
  $('#bucket-badge').hidden = !state.bucket.length;
  $('#bucket-badge').textContent = state.bucket.length;
  const on = state.online || {};
  $('#hud-rank-text').textContent = on.nickname && on.rank ? `#${on.rank}` : 'Đua top';
  $('#review-badge').hidden = !state.review.length;
  $('#review-badge').textContent = state.review.length;
  renderGear();
  scene.setZone(z);
}

const BAITS = ['worm', 'shrimp', 'golden'];
const BOOSTS = ['charm', 'tea', 'net'];
const BOOST_TIP = {
  charm: '🍀 Lần ném tới chắc chắn gặp cá Hiếm trở lên!',
  tea: '🍵 Trận kéo cá tới: dây căng chậm hơn 35%.',
  net: '🥅 Con cá tới bán được giá gấp đôi!',
};
function renderGear() {
  const rod = rodById(state.rod);
  const line = currentLine(state);
  const bait = currentBait(state);
  const it = ITEMS[bait];
  const idle = game.mode === 'idle';
  $('#rod-chip').innerHTML = `${rodIcon(rod.id, 30)}<span>${esc(rod.name)}</span>`;
  $('#line-chip').innerHTML = `${lineIcon(line.color, 30)}<span>${esc(line.name)} <b>${'❤️'.repeat(line.lives)}</b></span>`;
  $('#bait-chip').innerHTML = `${itemIcon(bait, 30)}<span>${esc(it.name)} <b>${bait === 'worm' ? '∞' : state.items[bait]}</b></span>`;
  $$('.gear-chip').forEach((c) => { c.disabled = !idle; });
  for (const id of BOOSTS) {
    const n = state.items[id] || 0;
    if (!n) game.boosts[id] = false;
    const btn = $(`[data-boost="${id}"]`);
    btn.innerHTML = `${itemIcon(id, 34)}<i>${n}</i>`;
    btn.title = `${ITEMS[id].name}: ${ITEMS[id].desc}`;
    btn.classList.toggle('on', game.boosts[id]);
    btn.disabled = !n || !idle;
  }
  const chances = rarityChances(state.zone, totalLuck(state), game.boosts.charm ? rarityIndex('rare') : 0);
  $('#odds').innerHTML = RARITIES.map((r, i) => (chances[i] > 0
    ? `<span style="border-color:${r.color};color:${r.color}">${r.name} ${(chances[i] * 100).toFixed(chances[i] < 0.01 ? 1 : 0)}%</span>` : '')).join('');
  $('#odds').hidden = !idle;
}
$('#bait-chip').addEventListener('click', () => {
  const owned = BAITS.filter((b) => b === 'worm' || state.items[b] > 0);
  state.bait = owned[(owned.indexOf(currentBait(state)) + 1) % owned.length];
  if (owned.length === 1) toast('Bạn chỉ có Giun đất. Mua mồi tôm / mồi vàng ở Cửa hàng hoặc nhận từ nhiệm vụ.');
  beep(SOUND.click);
  save();
  renderGear();
});
$('#boosts').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-boost]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.boost;
  game.boosts[id] = !game.boosts[id] && (state.items[id] || 0) > 0;
  if (game.boosts[id]) toast(BOOST_TIP[id]);
  beep(SOUND.click);
  renderGear();
});

// ---------- Bản đồ ----------
let mapSel = null;
RENDER.map = () => {
  const level = levelFromXp(state.xp);
  mapSel ||= state.zone;
  $('#world-map').innerHTML = worldMapSVG(state, mapSel);
  const z = zoneById(mapSel);
  const open = state.zones.includes(z.id);
  const fishList = zoneFish(z.id);
  const found = fishList.filter((f) => state.collection[f.id]).length;
  const canBuy = !open && level >= z.level && state.coins >= z.price;
  let action;
  if (z.id === state.zone) action = '<span class="rarity-tag" style="background:#c47f00">📍 Bạn đang câu ở đây</span>';
  else if (open) action = `<button class="btn gold big" data-go="${z.id}">⛵ Đến câu</button>`;
  else action = `<button class="btn ${canBuy ? 'gold' : ''} big" data-unlock="${z.id}" ${canBuy ? '' : 'disabled'}>🔓 Mở khu · 🪙 ${fmt(z.price)}</button>
    <span class="small muted">${level < z.level ? `Cần cấp ${z.level} (bạn cấp ${level})` : state.coins < z.price ? 'Chưa đủ xu' : ''}</span>`;
  $('#zone-list').innerHTML = `<div class="zone-info" style="--sky:${z.sky[0]};--water:${z.water[1]}">
    <div class="zi">${z.icon}</div>
    <div class="zbody">
      <div class="zn">${esc(z.name)} <span class="small muted">· 🐟 ${found}/${fishList.length} loài</span></div>
      <div class="zd">${esc(z.desc)}</div>
      <div class="zfish">${fishList.map((f) => `<span class="${state.collection[f.id] ? '' : 'unknown'}" title="${state.collection[f.id] ? esc(f.name) : '???'}">${fishSVG(f.id, { size: 56, uid: `m${f.id}` })}</span>`).join('')}</div>
      <div class="actions">${action}</div>
    </div>
  </div>`;
};
$('#world-map').addEventListener('click', (e) => {
  const node = e.target.closest('[data-zone]');
  if (!node) return;
  mapSel = node.dataset.zone;
  beep(SOUND.click);
  RENDER.map();
});
$('#zone-list').addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  const un = e.target.closest('[data-unlock]');
  if (go) {
    state.zone = go.dataset.go;
    mapSel = null;
    save();
    $('#sheet-map').close();
    const z = zoneById(state.zone);
    banner(`${z.icon} ${esc(z.name)}<small>${esc(z.desc)}</small>`, 'gold', 2200);
    renderHud();
  } else if (un) {
    const r = unlockZone(state, un.dataset.unlock);
    if (r.ok) { beep(SOUND.level); toast(`🗺️ Đã mở khu ${esc(zoneById(un.dataset.unlock).name)}!`); save(); renderHud(); RENDER.map(); } else toast(`⚠️ ${r.reason}`);
  }
});

// ---------- Nhiệm vụ ----------
function goalText(g) {
  switch (g.type) {
    case 'catch': return `Câu được ${g.n} con cá${g.minRarity ? ` loại ${rarityOf(g.minRarity).name} trở lên` : ''}.`;
    case 'correct': return `Trả lời đúng ${g.n} câu${g.subject ? ` môn ${subjectById(g.subject).name}` : ''}.`;
    case 'streak': return `Trả lời đúng ${g.n} câu liên tiếp.`;
    case 'sell': return `Bán ${g.n} con cá.`;
    case 'level': return `Đạt cấp ${g.n}.`;
    case 'coinsEarned': return `Kiếm tổng cộng ${fmt(g.n)} xu từ bán cá.`;
    case 'species': return `Sưu tập ${g.n} loài cá khác nhau.`;
    default: return '';
  }
}
RENDER.quests = () => {
  const list = activeQuests(state);
  $('#quest-list').innerHTML = list.length ? list.map((q) => {
    const p = questProgress(state, q);
    const subj = q.goal.subject && !state.settings.subjects.includes(q.goal.subject)
      ? `<span class="muted small">⚠️ Hãy bật môn ${esc(subjectById(q.goal.subject).name)} trong Cài đặt.</span>` : '';
    return `<div class="card ${p.done ? 'done' : ''}">
      <div class="title">${p.done ? '✅' : '📜'} ${esc(q.title)}</div>
      <div class="muted">${esc(goalText(q.goal))}</div>
      <div class="progress"><span style="width:${(p.current / p.target) * 100}%"></span></div>
      <div class="small">${fmt(p.current)} / ${fmt(p.target)}</div>
      <div class="small">🎁 ${describeReward(q.reward)}</div>
      ${subj}
      <div class="actions"><button class="btn ${p.done ? 'gold' : ''}" data-claim="${q.id}" ${p.done ? '' : 'disabled'}>Nhận thưởng</button></div>
    </div>`;
  }).join('') : '<div class="card">🏆 Bạn đã hoàn thành mọi nhiệm vụ. Thật xuất sắc!</div>';
  $('#quest-total').textContent = `Đã hoàn thành ${state.claimed.length}/${QUESTS.length} nhiệm vụ.${state.titles.length ? ` Danh hiệu: ${state.titles.join(', ')}.` : ''}`;
};
$('#quest-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-claim]');
  if (!btn) return;
  const before = levelFromXp(state.xp);
  const q = claimQuest(state, btn.dataset.claim);
  if (!q) return;
  beep(SOUND.catch);
  toast(`🎁 Nhận thưởng "${esc(q.title)}": ${describeReward(q.reward)}`);
  if (levelFromXp(state.xp) > before) { beep(SOUND.level); banner(`⭐ LÊN CẤP ${levelFromXp(state.xp)}!`, 'gold', 1800); }
  save();
  doneQuestIds = new Set(activeQuests(state).filter((x) => questProgress(state, x).done).map((x) => x.id));
  RENDER.quests();
  renderHud();
  syncOnline();
});

// ---------- Thùng cá ----------
function fishCard(f, extra = '') {
  const fish = fishById(f.fishId);
  const r = rarityOf(fish.rarity);
  return `<div class="fish-card" style="border-color:${r.color}">
    <div class="art">${fishSVG(fish.id, { size: 120, uid: `b${f.uid}` })}</div>
    <div class="name">${esc(fish.name)}</div>
    ${tag(fish.rarity)}
    <div class="meta">${f.kg} kg · 🪙 ${fmt(f.value)}</div>
    ${extra}
  </div>`;
}
RENDER.bucket = () => {
  const sorted = [...state.bucket].sort((a, b) => b.value - a.value);
  $('#bucket-summary').textContent = state.bucket.length
    ? `${state.bucket.length} con cá · tổng giá trị 🪙 ${fmt(bucketValue(state))}`
    : 'Thùng đang trống – đi câu thôi!';
  $('#bucket-list').innerHTML = sorted.map((f) => fishCard(f, `<button class="btn small gold" data-sell="${f.uid}">Bán</button>`)).join('');
  $('#sell-all').disabled = !state.bucket.length;
  $('#sell-common').disabled = !state.bucket.some((f) => rarityIndex(fishById(f.fishId).rarity) <= 1);
};
function doSell(uids) {
  if (!uids.length) return;
  const r = sellFish(state, uids);
  beep(SOUND.catch);
  toast(`🪙 Bán ${r.count} con cá được ${fmt(r.coins)} xu!`);
  save();
  afterAction();
  RENDER.bucket();
}
$('#bucket-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sell]');
  if (btn) doSell([Number(btn.dataset.sell)]);
});
$('#sell-all').addEventListener('click', () => {
  const rare = state.bucket.filter((f) => rarityIndex(fishById(f.fishId).rarity) >= rarityIndex('legendary')).length;
  if (rare && !confirm(`Trong thùng có ${rare} con cá Huyền thoại/Thần thoại. Bán hết chứ?`)) return;
  doSell(state.bucket.map((f) => f.uid));
});
$('#sell-common').addEventListener('click', () => doSell(state.bucket.filter((f) => rarityIndex(fishById(f.fishId).rarity) <= 1).map((f) => f.uid)));

// ---------- Bộ sưu tập ----------
RENDER.dex = () => {
  const have = Object.keys(state.collection).length;
  $('#dex-summary').textContent = `Đã tìm thấy ${have}/${speciesTotal()} loài. Cá đã bán vẫn được ghi trong bộ sưu tập.`;
  $('#dex-list').innerHTML = ZONES.map((z) => `
    <div class="dex-zone">
      <h3>${z.icon} ${esc(z.name)} ${state.zones.includes(z.id) ? '' : '<span class="muted small">🔒</span>'}</h3>
      <div class="fish-grid">${zoneFish(z.id).map((fish) => {
        const c = state.collection[fish.id];
        const r = rarityOf(fish.rarity);
        return c
          ? `<div class="fish-card" style="border-color:${r.color}"><button class="view4d" data-view="${fish.id}" title="Xem cá 4D">4D</button><div class="art">${fishSVG(fish.id, { size: 120, uid: `d${fish.id}` })}</div><div class="name">${esc(fish.name)}</div>${tag(fish.rarity)}<div class="meta">Đã câu ${c.count} lần · kỷ lục ${c.bestKg} kg<br>Giá gốc 🪙 ${fmt(fish.value)}</div></div>`
          : `<div class="fish-card unknown"><div class="art">${fishSVG(fish.id, { size: 120, uid: `u${fish.id}` })}</div><div class="name">???</div>${tag(fish.rarity)}<div class="meta">Chưa khám phá</div></div>`;
      }).join('')}</div>
    </div>`).join('');
};

// ---------- Cá 4D ----------
const has3D = webglAvailable();
function show4D(box, fishId) {
  if (!has3D || !box) return;
  try {
    getFishViewer().show(box, fishId);
    box.classList.add('live');
  } catch (err) { console.warn('Không mở được cá 4D:', err); }
}
function hide4D() {
  if (!has3D) return;
  try { getFishViewer().hide(); } catch { /* bỏ qua */ }
  $$('.viewer-box.live').forEach((b) => b.classList.remove('live'));
}
$('#dex-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  const fish = fishById(btn.dataset.view);
  const c = state.collection[fish.id];
  const r = rarityOf(fish.rarity);
  const z = zoneById(fish.zone);
  $('#f4d-body').innerHTML = `
    <div class="f4d-stage" style="--ray:${r.color}"><div class="rays"></div><div class="viewer-box big" id="f4d-viewer">${fishSVG(fish.id, { size: 260, uid: 'f4d' })}</div></div>
    ${tag(fish.rarity)}<h2>${esc(fish.name)}</h2>
    <div class="stats">
      <div class="stat"><span class="muted small">Đã câu</span><b>${c.count} lần</b></div>
      <div class="stat"><span class="muted small">Kỷ lục</span><b>${c.bestKg} kg</b></div>
      <div class="stat"><span class="muted small">Giá gốc</span><b>🪙 ${fmt(fish.value)}</b></div>
      <div class="stat"><span class="muted small">Khu</span><b>${z.icon} ${esc(z.name)}</b></div>
    </div>
    <p class="muted small">${has3D ? '🖐️ Kéo để xoay con cá' : 'Thiết bị không hỗ trợ 3D – đang hiện hình phẳng.'}</p>`;
  const dlg = $('#fish4d-dlg');
  dlg.showModal();
  show4D($('#f4d-viewer'), fish.id);
  dlg.addEventListener('close', hide4D, { once: true });
});
$('#f4d-close').addEventListener('click', () => $('#fish4d-dlg').close());

// ---------- Cửa hàng ----------
let shopTab = 'rods';
const bar = (label, v, max, color) => `<div class="stat-bar"><span>${label}</span><div><i style="width:${Math.max(4, Math.min(100, (v / max) * 100))}%;background:${color}"></i></div></div>`;
function shopCard({ icon, title, desc = '', stats = '', action, owned = false, using = false }) {
  return `<div class="shop-card ${owned ? 'owned' : ''} ${using ? 'using' : ''}">
    <div class="shop-icon">${icon}</div>
    <div class="shop-main"><div class="title">${title}</div>${desc ? `<div class="muted small">${desc}</div>` : ''}${stats}</div>
    <div class="shop-act">${action}</div>
  </div>`;
}
RENDER.shop = () => {
  const level = levelFromXp(state.xp);
  $('#shop-coins').textContent = fmt(state.coins);
  $$('#shop-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === shopTab));
  const buyBtn = (attr, id, price, need) => {
    const can = level >= need && state.coins >= price;
    return `<button class="btn ${can ? 'gold' : ''}" ${attr}="${id}" ${can ? '' : 'disabled'}>🪙 ${fmt(price)}</button>${level < need ? `<span class="small muted">Cấp ${need}</span>` : ''}`;
  };
  const inUse = '<span class="rarity-tag" style="background:#1f9d55">Đang dùng</span>';
  let html = '';
  if (shopTab === 'rods') {
    html = RODS.map((r) => {
      const owned = state.ownedRods.includes(r.id);
      const using = state.rod === r.id;
      return shopCard({
        icon: rodIcon(r.id, 64), title: esc(r.name), owned, using,
        stats: bar('🍀 May mắn', r.luck, 5, '#4ade80') + bar('💪 Sức kéo', r.luck, 5, '#38bdf8'),
        action: using ? inUse : owned ? `<button class="btn sea" data-rod-use="${r.id}">Dùng</button>` : buyBtn('data-rod-buy', r.id, r.price, r.level),
      });
    }).join('');
  } else if (shopTab === 'lines') {
    html = LINES.map((l) => {
      const owned = state.ownedLines.includes(l.id);
      const using = state.line === l.id;
      return shopCard({
        icon: lineIcon(l.color, 64), title: esc(l.name), owned, using,
        desc: `${'❤️'.repeat(l.lives)} – được trả lời sai ${l.lives - 1} câu mà vẫn giữ được cá`,
        stats: bar('❤️ Độ bền', l.lives, 4, '#f87171') + bar('💪 Chịu căng', l.strength, 0.4, '#fbbf24'),
        action: using ? inUse : owned ? `<button class="btn sea" data-line-use="${l.id}">Dùng</button>` : buyBtn('data-line-buy', l.id, l.price, l.level),
      });
    }).join('');
  } else {
    html = SHOP.map((o) => {
      const it = ITEMS[o.item];
      return shopCard({
        icon: itemIcon(o.item, 64), title: `${esc(it.name)} ×${o.qty}`, desc: esc(it.desc),
        stats: `<div class="small">Đang có: <b>${state.items[o.item] || 0}</b></div>`,
        action: buyBtn('data-item-buy', o.id, o.price, o.level),
      });
    }).join('');
  }
  $('#shop-list').innerHTML = html;
  $('#inventory').innerHTML = Object.entries(ITEMS).filter(([id]) => id !== 'worm')
    .map(([id, it]) => `<span class="inv-slot" title="${esc(it.name)}: ${esc(it.desc)}">${itemIcon(id, 42)}<b>${state.items[id] || 0}</b></span>`).join('');
};
$('#shop-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  shopTab = b.dataset.tab;
  beep(SOUND.click);
  RENDER.shop();
});
$('#sheet-shop').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  let r = null;
  if (t.dataset.rodBuy) r = buyRod(state, t.dataset.rodBuy);
  else if (t.dataset.itemBuy) r = buyShopItem(state, t.dataset.itemBuy);
  else if (t.dataset.rodUse) { state.rod = t.dataset.rodUse; r = { ok: true }; }
  else if (t.dataset.lineBuy) r = buyLine(state, t.dataset.lineBuy);
  else if (t.dataset.lineUse) { state.line = t.dataset.lineUse; r = { ok: true }; }
  if (!r) return;
  if (r.ok) { beep(SOUND.catch); toast('✅ Thành công!'); save(); } else toast(`⚠️ ${r.reason}`);
  RENDER.shop();
  renderHud();
});

// ---------- Ôn tập ----------
RENDER.review = () => {
  $('#review-summary').textContent = state.review.length
    ? `${state.review.length} câu cần ôn · đã sửa được ${state.stats.reviewedOk} câu`
    : `Không có câu nào cần ôn 🎉 (đã sửa được ${state.stats.reviewedOk} câu)`;
  $('#review-clear').disabled = !state.review.length;
  $('#review-list').innerHTML = state.review.map((q) => {
    const s = subjectById(q.subject);
    return `<div class="review-item">
      <div class="muted small">${s ? `${s.icon} ${esc(s.name)}` : ''}</div>
      <div><b>${esc(q.text)}</b></div>
      <div>Đáp án đúng: <span class="ans">${esc(q.choices[q.answer])}</span></div>
      ${q.explain ? `<div class="muted small">${esc(q.explain)}</div>` : ''}
    </div>`;
  }).join('');
};
$('#review-clear').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ sổ ôn tập?')) return;
  state.review = [];
  save();
  RENDER.review();
  renderHud();
});

// ---------- Cài đặt ----------
RENDER.settings = () => {
  $('#subject-list').innerHTML = SUBJECTS.map((s) => `<label class="pill"><input type="checkbox" data-subject="${s.id}" ${state.settings.subjects.includes(s.id) ? 'checked' : ''}> ${s.icon} ${esc(s.name)}</label>`).join('');
  $('#grade-list').innerHTML = GRADES.map((g) => `<label class="pill"><input type="radio" name="grade" data-grade="${g.id}" ${state.settings.grade === g.id ? 'checked' : ''}> ${esc(g.name)}</label>`).join('');
  $('#sound-toggle').checked = state.settings.sound;
  $('#custom-text').value = state.custom.map((c) => [c.q, c.a, ...c.w].join(' | ')).join('\n');
  $('#custom-status').textContent = state.custom.length ? `Đang có ${state.custom.length} câu hỏi riêng.` : '';
};
$('#subject-list').addEventListener('change', (e) => {
  const id = e.target.dataset.subject;
  if (!id) return;
  const set = new Set(state.settings.subjects);
  if (e.target.checked) set.add(id); else set.delete(id);
  if (!set.size) { e.target.checked = true; toast('Cần chọn ít nhất một môn.'); return; }
  state.settings.subjects = SUBJECTS.map((s) => s.id).filter((s) => set.has(s));
  if (id === 'custom' && e.target.checked && !state.custom.length) toast('Hãy nhập câu hỏi của bạn ở ô bên dưới rồi bấm Lưu.');
  save();
});
$('#grade-list').addEventListener('change', (e) => { if (e.target.dataset.grade) { state.settings.grade = e.target.dataset.grade; save(); } });
$('#sound-toggle').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });
$('#custom-save').addEventListener('click', () => {
  const { questions, errors } = parseCustomQuestions($('#custom-text').value);
  state.custom = questions;
  if (questions.length && !state.settings.subjects.includes('custom')) state.settings.subjects.push('custom');
  save();
  RENDER.settings();
  $('#custom-status').textContent = `Đã lưu ${questions.length} câu.${errors.length ? ` Bỏ qua dòng ${errors.join(', ')} (thiếu đáp án).` : ''}`;
});
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cau-ca-hoc-gioi-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !('stats' in data)) throw new Error('bad');
    state = normalizeState(data);
    save();
    renderHud();
    RENDER.settings();
    toast('✅ Đã nhập dữ liệu.');
  } catch { toast('⚠️ File không hợp lệ.'); }
  e.target.value = '';
});
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ tiến trình và chơi lại từ đầu?')) return;
  state = newGame();
  save();
  $('#sheet-settings').close();
  renderHud();
  toast('Bắt đầu lại từ Ao làng 🏡');
});

function afterAction() {
  const nowDone = activeQuests(state).filter((q) => questProgress(state, q).done);
  for (const q of nowDone) {
    if (!doneQuestIds.has(q.id)) toast(`📜 Hoàn thành nhiệm vụ "<b>${esc(q.title)}</b>"! Mở 📜 Nhiệm vụ để nhận thưởng.`);
  }
  doneQuestIds = new Set(nowDone.map((q) => q.id));
  renderHud();
}

// ---------- Bảng xếp hạng (online) ----------
let syncing = null;
// Nộp điểm lên bảng xếp hạng chung (không chặn trò chơi nếu mất mạng).
async function syncOnline({ force = false } = {}) {
  if (!state.online?.nickname) return null;
  if (syncing) return syncing;
  if (!force && Date.now() - (state.online.lastSubmit || 0) < 8000) return null;
  const before = state.online.rank;
  syncing = submitScore(state)
    .then((row) => {
      save();
      renderHud();
      if (row && before && row.rank < before) {
        toast(`🏆 Bạn đã vượt lên hạng <b>#${row.rank}</b> trên ${row.total} người chơi!`);
        beep(SOUND.level);
      }
      return row;
    })
    .catch((err) => { console.warn('Không nộp được điểm:', err); return null; })
    .finally(() => { syncing = null; });
  return syncing;
}

let rankTimer = null;
const MEDAL = ['🥇', '🥈', '🥉'];
async function loadRanking() {
  const status = $('#rank-status');
  status.textContent = 'Đang tải bảng xếp hạng…';
  try {
    if (state.online.nickname) await syncOnline({ force: true });
    const [rows, me] = await Promise.all([topPlayers(50), state.online.nickname ? myRank(state) : null]);
    if (me) { Object.assign(state.online, { rank: me.rank, total: me.total }); save(); renderHud(); }
    const myNick = cleanNickname(state.online.nickname);
    $('#rank-list').innerHTML = rows.length ? rows.map((r) => {
      const mine = me && r.rank === me.rank && r.nickname === myNick;
      return `<li class="${mine ? 'me' : ''} ${r.rank <= 3 ? `top${r.rank}` : ''}">
        <span class="pos">${MEDAL[r.rank - 1] || `#${r.rank}`}</span>
        <span class="who"><b>${esc(r.nickname)}${mine ? ' (bạn)' : ''}</b>
          <span>Cấp ${r.level} · 🐟 ${r.species} loài · ✅ ${fmt(r.correct)} câu đúng${r.best_fish ? ` · <span style="color:${rarityColor(r.best_rarity)}">★ ${esc(r.best_fish)}</span>` : ''}</span></span>
        <span class="pts">${fmt(r.xp)}<small>KN</small></span>
      </li>`;
    }).join('') : '<li><span class="pos">🎣</span><span class="who"><b>Chưa có ai!</b><span>Hãy là người đầu tiên lên bảng.</span></span><span></span></li>';
    if (me) {
      $('#rank-me').hidden = false;
      $('#rank-me').innerHTML = `<span class="big">#${me.rank}</span><span><b>${esc(myNick)}</b><br><span class="small">Hạng của bạn trên ${fmt(me.total)} người chơi · ${fmt(me.xp)} KN</span></span>`;
    } else $('#rank-me').hidden = true;
    status.textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (err) {
    console.warn(err);
    status.textContent = '⚠️ Không kết nối được bảng xếp hạng. Kiểm tra mạng rồi bấm Làm mới.';
  }
}

RENDER.rank = () => {
  const joined = !!state.online.nickname;
  $('#rank-join').hidden = joined;
  $('#rank-rename').hidden = !joined;
  $('#nick-input').value = state.online.nickname || '';
  $('#nick-error').textContent = '';
  loadRanking();
  clearInterval(rankTimer);
  rankTimer = setInterval(() => { if ($('#sheet-rank').open) loadRanking(); else clearInterval(rankTimer); }, 20000);
};
$('#sheet-rank').addEventListener('close', () => clearInterval(rankTimer));
$('#nick-save').addEventListener('click', async () => {
  const nick = cleanNickname($('#nick-input').value);
  const err = validNickname(nick);
  if (err) { $('#nick-error').textContent = err; return; }
  ensurePlayerKey(state);
  state.online.nickname = nick;
  save();
  $('#nick-error').textContent = '';
  const row = await syncOnline({ force: true });
  if (!row) {
    $('#nick-error').textContent = 'Chưa gửi được lên máy chủ (mất mạng?). Điểm sẽ tự gửi ở lượt câu sau.';
  } else {
    beep(SOUND.catch);
    banner(`🏆 HẠNG #${row.rank}<small>trên ${row.total} người chơi</small>`, 'gold', 2000);
  }
  RENDER.rank();
});
$('#nick-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nick-save').click(); });
$('#rank-rename').addEventListener('click', () => { $('#rank-join').hidden = false; $('#nick-input').focus(); });
$('#rank-refresh').addEventListener('click', loadRanking);

// =====================================================================
// VÒNG CHƠI
// mode: idle → charge → cast/wait → bite → fight (⇄ question) → result → idle
// =====================================================================
const game = { mode: 'idle', holding: false, boosts: { charm: false, tea: false, net: false }, power: 0, powerDir: 1 };
const PERFECT = [0.82, 0.95];
const HOOK_WINDOW = 1400;

function setAction(mode) {
  const btn = $('#action-btn');
  btn.className = 'action';
  const map = {
    idle: ['🎣', 'GIỮ ĐỂ NÉM'], charge: ['💪', 'THẢ ĐỂ NÉM'], wait: ['⏳', 'CHỜ CÁ…'],
    bite: ['❗', 'GIẬT CẦN!'], fight: ['🌀', 'GIỮ ĐỂ KÉO'], busy: ['🎣', '…'],
  };
  const [ico, label] = map[mode] || map.busy;
  $('#action-ico').textContent = ico;
  $('#action-label').textContent = label;
  if (mode === 'bite') btn.classList.add('hook');
  if (mode === 'fight') btn.classList.add('reel');
  if (mode === 'wait' || mode === 'busy') btn.classList.add('wait');
  if (game.holding && (mode === 'charge' || mode === 'fight')) btn.classList.add('pressed');
}

function setMode(mode) {
  game.mode = mode;
  setAction(mode === 'cast' ? 'wait' : mode === 'question' || mode === 'result' ? 'busy' : mode);
  $('#power').hidden = mode !== 'charge';
  $('#fight-hud').hidden = !(mode === 'fight' || mode === 'question');
  renderGear();
}

// ---------- Nhấn / thả ----------
function press() {
  if (document.querySelector('dialog[open]')) return;
  game.holding = true;
  $('#action-btn').classList.add('pressed');
  if (game.mode === 'idle') startCharge();
  else if (game.mode === 'bite') hookFish();
}
function release() {
  if (!game.holding) return;
  game.holding = false;
  $('#action-btn').classList.remove('pressed');
  if (game.mode === 'charge') doCast();
}
$('#action-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); $('#action-btn').setPointerCapture?.(e.pointerId); press(); });
$('#scene').addEventListener('pointerdown', (e) => { if (e.button === 0) press(); });
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || document.querySelector('dialog[open]')) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  press();
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });

// ---------- Lấy lực ----------
let rafId = 0;
let lastT = 0;
function startCharge() {
  setMode('charge');
  game.power = 0;
  game.powerDir = 1;
  hint('Thả tay khi thanh lực vào <b style="color:#7dffb0">vùng xanh</b> để ném Hoàn hảo!');
  lastT = performance.now();
  const tick = (now) => {
    if (game.mode !== 'charge') return;
    let remaining = Math.min(0.5, (now - lastT) / 1000);
    lastT = now;
    while (remaining > 0) {
      const dt = Math.min(0.03, remaining);
      remaining -= dt;
      game.power += game.powerDir * dt * 1.15;
      if (game.power >= 1) { game.power = 1; game.powerDir = -1; }
      if (game.power <= 0) { game.power = 0; game.powerDir = 1; }
    }
    $('#power-fill').style.height = `calc(${game.power * 100}% - 6px)`;
    scene.charge?.(game.power);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

// ---------- Ném ----------
let attempt = null;
async function doCast() {
  cancelAnimationFrame(rafId);
  const p = game.power;
  const perfect = p >= PERFECT[0] && p <= PERFECT[1];
  const dist = Math.round(6 + p * 18);
  const bonusLuck = p * 1 + (perfect ? 1.5 : 0);
  attempt = startCast(state, Math.random, { useCharm: game.boosts.charm, useTea: game.boosts.tea, useNet: game.boosts.net, bonusLuck });
  attempt.distance = dist;
  game.boosts = { charm: false, tea: false, net: false };
  save();
  setMode('cast');
  beep(SOUND.cast);
  scene.cast(dist);
  if (perfect) banner(`HOÀN HẢO!<small>Ném xa ${dist} m · cá hiếm dễ cắn hơn</small>`, 'green', 1400);
  else banner(`${dist} m`, '', 900);
  hint(attempt.charm ? '🍀 Bùa may mắn đang phát sáng… chờ cá cắn câu' : 'Chờ phao chìm rồi bấm <b>GIẬT CẦN</b>!');
  await wait(750);
  beep(SOUND.splash, 'sine', 0.08);
  await wait(900 + Math.random() * 2600);
  if (game.mode !== 'cast') return;
  // Cá cắn câu!
  setMode('bite');
  scene.bite();
  beep(SOUND.bite, 'square', 0.06);
  banner('CÁ CẮN CÂU!', 'red', HOOK_WINDOW);
  hint('Bấm <b>GIẬT CẦN</b> ngay!');
  if (navigator.vibrate) navigator.vibrate(120);
  const myAttempt = attempt;
  await wait(HOOK_WINDOW);
  if (game.mode === 'bite' && attempt === myAttempt) {
    // Không giật kịp: cá nhả mồi.
    scene.escape();
    beep(SOUND.wrong);
    banner('Cá nhả mồi rồi…', 'red', 1400);
    hint('Lần sau hãy bấm GIẬT CẦN thật nhanh khi phao chìm nhé!');
    attempt = null;
    await wait(1200);
    setMode('idle');
    hint('');
  }
}

// ---------- Giật cần & kéo cá ----------
let fight = null;
let fightLog = [];
function hookFish() {
  if (!attempt) return;
  beep(SOUND.hook);
  scene.hook?.(attempt.rarity);
  const r = rarityOf(attempt.rarity);
  fight = createFight({
    rarity: attempt.rarity, kg: attempt.kg, distance: attempt.distance,
    rodLuck: rodById(state.rod).luck, questions: attempt.questions,
    lives: lineById(attempt.line)?.lives || 2, lineStrength: lineById(attempt.line)?.strength || 0, calm: attempt.tea,
  });
  fightLog = [];
  $('#fh-fish').style.background = r.color;
  $('#fh-fish').textContent = `Cá ${r.name}`;
  banner(rarityIndex(attempt.rarity) >= 4 ? `😱 CÁ ${r.name.toUpperCase()}!` : 'MẮC CÂU!', rarityIndex(attempt.rarity) >= 2 ? 'gold' : '', 1100);
  hint('<b>Giữ</b> để kéo · <b>thả</b> khi dây căng đỏ');
  setMode('fight');
  lastT = performance.now();
  rafId = requestAnimationFrame(fightTick);
}

function renderFight() {
  $('#fh-dist').textContent = fight.distance.toFixed(1);
  $('#fh-stamina').style.width = `${Math.max(4, fight.stamina * 100)}%`;
  $('#fh-tension').style.width = `${fight.tension * 100}%`;
  $('#fh-lives').textContent = '❤️'.repeat(fight.lives) + '🤍'.repeat(fight.maxLives - fight.lives);
  $('#fh-qleft').textContent = fight.questionsLeft ? `❓×${fight.questionsLeft}` : '💤 kiệt sức';
  $('#fight-hud').classList.toggle('danger', fight.tension > 0.85);
}

let lastSurge = false;
function fightTick(now) {
  if (game.mode !== 'fight') return;
  // Chia nhỏ bước thời gian: máy chậm (ít khung hình/giây) vẫn chạy đúng tốc độ thật.
  let remaining = Math.min(0.5, (now - lastT) / 1000);
  lastT = now;
  let ev = null;
  while (remaining > 0 && !ev) {
    const dt = Math.min(0.03, remaining);
    remaining -= dt;
    ev = stepFight(fight, dt, game.holding);
  }
  scene.fight?.(fight.distance / Math.max(1, fight.start), fight.tension, surging(fight));
  renderFight();
  if (surging(fight) && !lastSurge) { hint('🌊 Cá đang vùng vẫy – <b>thả bớt</b> dây!'); if (navigator.vibrate) navigator.vibrate(60); }
  if (!surging(fight) && lastSurge) hint('<b>Giữ</b> để kéo · <b>thả</b> khi dây căng đỏ');
  lastSurge = surging(fight);
  setAction('fight');
  if (ev === 'question') { fightQuestion(); return; }
  if (ev === 'landed') { finishCatch(); return; }
  if (ev === 'snapped' || ev === 'escaped') { finishLost(ev); return; }
  rafId = requestAnimationFrame(fightTick);
}

async function fightQuestion() {
  game.holding = false;
  $('#action-btn').classList.remove('pressed');
  setMode('question');
  const n = fight.total - fight.questionsLeft + 1;
  const question = fightLog.length === 0 ? attempt.question : nextQuestion(state, attempt);
  banner('CÁ VÙNG VẪY!', 'red', 900);
  await wait(500);
  const choice = await askQuestion(question, { step: `Câu ${n}/${fight.total}`, lives: fight.lives });
  const res = answerQuestion(state, question, choice);
  fightLog.push({ question, choice, correct: res.correct, xp: res.xp });
  const outcome = answerInFight(fight, res.correct);
  save();
  renderFight();
  if (res.correct) {
    beep(SOUND.right);
    banner(fight.questionsLeft ? `CHÍNH XÁC! +${res.xp} KN<small>Cá yếu đi – kéo tiếp!</small>` : `CHÍNH XÁC! +${res.xp} KN<small>Cá kiệt sức – kéo lên thôi!</small>`, 'green', 1300);
  } else {
    beep(SOUND.wrong);
    if (outcome === 'lost') { finishLost('lost'); return; }
    banner('SAI RỒI!<small>Cá kéo ra xa – mất 1 ❤️</small>', 'red', 1400);
  }
  hint('<b>Giữ</b> để kéo · <b>thả</b> khi dây căng đỏ');
  setMode('fight');
  lastT = performance.now();
  rafId = requestAnimationFrame(fightTick);
}

// ---------- Hộp câu hỏi ----------
function askQuestion(q, { step, lives }) {
  const dlg = $('#question-dlg');
  const r = rarityOf(attempt.rarity);
  const subject = subjectById(q.subject);
  $('#q-rarity').textContent = `Cá ${r.name}`;
  $('#q-rarity').style.background = r.color;
  $('#q-step').textContent = `${step} · ${'❤️'.repeat(lives)}`;
  $('#q-subject').textContent = `${subject ? `${subject.icon} ${subject.name}` : ''}${q.isReview ? ' · 📒 Ôn lại câu từng sai' : ''}`;
  $('#q-lead').textContent = rarityIndex(attempt.rarity) >= 4 ? '😱 Cá cực hiếm đang vùng vẫy! Trả lời đúng để giữ chặt!'
    : 'Cá đang vùng vẫy! Trả lời đúng để làm cá yếu đi.';
  $('#q-text').textContent = q.text;
  $('#q-choices').innerHTML = q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span>${esc(c)}</button>`).join('');
  $('#q-explain').hidden = true;
  $('#q-next-row').hidden = true;
  $('#q-tools').hidden = false;
  let timeLeft = attempt.timeLimit;
  let total = attempt.timeLimit;
  let usedHint = false;
  const updateTools = () => {
    $('#q-hint-count').textContent = state.items.hint || 0;
    $('#q-time-count').textContent = state.items.time || 0;
    $('#q-hint').disabled = usedHint || !state.items.hint;
    $('#q-time').disabled = !state.items.time;
  };
  const updateTimer = () => {
    $('#q-timer').textContent = Math.ceil(timeLeft);
    $('#q-timer').classList.toggle('low', timeLeft <= 5);
    $('#q-timebar').style.width = `${Math.max(0, (timeLeft / total) * 100)}%`;
  };
  updateTools();
  updateTimer();
  dlg.showModal();

  return new Promise((resolve) => {
    let finished = false;
    const timer = setInterval(() => {
      timeLeft -= 0.25;
      updateTimer();
      if (timeLeft <= 0) finish(null);
    }, 250);
    function close(choice) { dlg.close(); resolve(choice); }
    function finish(choice) {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      $('#q-choices').querySelectorAll('.choice').forEach((b) => {
        b.disabled = true;
        const i = Number(b.dataset.i);
        if (i === q.answer) b.classList.add('right');
        else if (i === choice) b.classList.add('wrong');
      });
      $('#q-tools').hidden = true;
      const right = choice === q.answer;
      const ex = $('#q-explain');
      ex.hidden = false;
      ex.innerHTML = right
        ? `✅ <b>Chính xác!</b>${q.explain ? ` ${esc(q.explain)}` : ''}`
        : `${choice === null ? '⏰ <b>Hết giờ!</b>' : '❌ <b>Chưa đúng.</b>'} Đáp án đúng: <b style="color:var(--good)">${esc(q.choices[q.answer])}</b>${q.explain ? `<br><span class="muted">${esc(q.explain)}</span>` : ''}<br><span class="muted small">📒 Đã ghi vào Sổ ôn tập.</span>`;
      if (right) setTimeout(() => close(choice), 900);
      else {
        // Câu sai: cho đọc lời giải rồi mới kéo tiếp.
        $('#q-next-row').hidden = false;
        $('#q-next').focus();
        $('#q-next').onclick = () => close(choice);
      }
    }
    function onKey(e) {
      const n = Number(e.key);
      if (n >= 1 && n <= q.choices.length) {
        const btn = $(`#q-choices [data-i="${n - 1}"]`);
        if (btn && !btn.classList.contains('hidden-choice')) finish(n - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    $('#q-choices').onclick = (e) => {
      const btn = e.target.closest('.choice');
      if (btn && !btn.disabled) finish(Number(btn.dataset.i));
    };
    $('#q-hint').onclick = () => {
      if (usedHint || !useHelper(state, 'hint')) return;
      usedHint = true;
      for (const i of fiftyFifty(q)) $(`#q-choices [data-i="${i}"]`).classList.add('hidden-choice');
      save(); updateTools();
    };
    $('#q-time').onclick = () => {
      if (!useHelper(state, 'time')) return;
      timeLeft += 15;
      total = Math.max(total, timeLeft);
      save(); updateTools(); updateTimer();
    };
  });
}
$('#question-dlg').addEventListener('cancel', (e) => e.preventDefault());

// ---------- Kết thúc lượt ----------
function unlockHint(level) {
  const z = ZONES.find((x) => x.level === level && !state.zones.includes(x.id));
  const r = RODS.find((x) => x.level === level && !state.ownedRods.includes(x.id));
  const parts = [];
  if (z) parts.push(`${z.icon} ${z.name} đã có thể mở trên Bản đồ`);
  if (r) parts.push(`${r.icon} ${r.name} đã có bán`);
  return parts.length ? `<br><span class="small">${parts.join(' · ')}</span>` : '';
}

async function finishCatch() {
  const before = levelFromXp(state.xp - fightLog.reduce((a, l) => a + l.xp, 0));
  const landed = landFish(state, attempt);
  save();
  const fish = fishById(attempt.fishId);
  const r = rarityOf(fish.rarity);
  setMode('result');
  scene.reel(fish.emoji, r.color, fish);
  beep(SOUND.catch);
  banner(rarityIndex(fish.rarity) >= 4 ? `✨ ${r.name.toUpperCase()}! ✨` : 'CÂU ĐƯỢC RỒI!', 'gold', 1500);
  hint('');
  await wait(1500);
  const level = levelFromXp(state.xp);
  const xpTotal = landed.xp + fightLog.reduce((a, l) => a + l.xp, 0);
  const rightCount = fightLog.filter((l) => l.correct).length;
  const gains = [`⭐ +${xpTotal} KN`, `✅ ${rightCount}/${fightLog.length} câu đúng`];
  if (state.stats.streak >= 3) gains.push(`🔥 Chuỗi ${state.stats.streak}`);
  if (landed.newSpecies) gains.push('🆕 Loài mới!');
  if (landed.record) gains.push('🏅 Kỷ lục cân nặng!');
  if (fightLog.some((l) => l.correct && l.question.isReview)) gains.push('📒 Đã sửa câu sai');
  $('#result-body').innerHTML = `
    <div class="catch-stage" style="--ray:${r.color}"><div class="rays"></div><div class="viewer-box" id="catch-viewer">${fishSVG(fish.id, { size: 240, uid: 'catch' })}</div></div>
    ${tag(fish.rarity)}
    <h2>${esc(fish.name)}</h2>
    <div class="stats">
      <div class="stat"><span class="muted small">Cân nặng</span><b>${attempt.kg} kg</b></div>
      <div class="stat"><span class="muted small">Giá bán</span><b>🪙 ${fmt(attempt.value)}</b></div>
      <div class="stat"><span class="muted small">Khu</span><b>${zoneById(attempt.zone).icon}</b></div>
    </div>
    <div class="gains">${gains.map((g) => `<span>${g}</span>`).join('')}</div>
    ${level > before ? `<div class="levelup">🎊 LÊN CẤP ${level}!${unlockHint(level)}</div>` : ''}`;
  $('#result-actions').innerHTML = `<button class="btn sea big" id="r-keep">🪣 Cho vào thùng</button><button class="btn gold big" id="r-sell">🪙 Bán ngay +${fmt(attempt.value)}</button>`;
  if (level > before) beep(SOUND.level);
  const uid = landed.fish.uid;
  const choice = await showResult(() => show4D($('#catch-viewer'), fish.id));
  if (choice === 'sell') {
    sellFish(state, [uid]);
    save();
    toast(`🪙 +${fmt(attempt.value)} xu`);
  }
  endTurn();
}

async function finishLost(reason) {
  loseFish(state);
  save();
  setMode('result');
  scene.escape();
  beep(reason === 'snapped' ? SOUND.snap : SOUND.wrong);
  const r = rarityOf(attempt.rarity);
  const title = { snapped: 'ĐỨT DÂY!', escaped: 'CÁ BƠI MẤT!', lost: 'CÁ THOÁT RỒI!' }[reason];
  const why = {
    snapped: 'Dây căng đỏ quá lâu. Khi thanh căng dây vào vùng đỏ hoặc cá vùng vẫy, hãy thả tay một chút.',
    escaped: 'Cá kéo ra quá xa. Hãy giữ nút để thu dây đều đặn hơn.',
    lost: 'Trả lời sai quá nhiều nên dây hết độ bền. Xem lại lời giải bên dưới nhé!',
  }[reason];
  banner(title, 'red', 1500);
  hint('');
  await wait(1300);
  const wrongs = fightLog.filter((l) => !l.correct);
  $('#result-body').innerHTML = `
    <div class="catch-stage" style="--ray:#64748b"><div class="rays"></div><div class="big-emoji">💨</div></div>
    <h2>${title}</h2>
    <p class="muted">Đó là một con cá ${tag(attempt.rarity)} … lần sau nhé!</p>
    <p>${why}</p>
    ${wrongs.map((l) => `<div class="explain"><b>${esc(l.question.text)}</b><br>Đáp án đúng: <b style="color:var(--good)">${esc(l.question.choices[l.question.answer])}</b>${l.question.explain ? `<br><span class="muted">${esc(l.question.explain)}</span>` : ''}</div>`).join('')}`;
  $('#result-actions').innerHTML = '<button class="btn gold big" id="r-ok">Câu tiếp 🎣</button>';
  await showResult();
  endTurn();
}

function showResult(onOpen) {
  const dlg = $('#result-dlg');
  dlg.showModal();
  onOpen?.();
  dlg.addEventListener('close', hide4D, { once: true });
  return new Promise((resolve) => {
    $('#result-actions').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      dlg.close();
      resolve(b.id === 'r-sell' ? 'sell' : 'keep');
    };
    dlg.oncancel = () => resolve('keep');
  });
}

function endTurn() {
  attempt = null;
  fight = null;
  setMode('idle');
  hint('');
  afterAction();
  syncOnline();
}

// ---------- Bắt đầu ----------
setMode('idle');
renderHud();
syncOnline({ force: true });
if (!state.stats.casts) {
  setTimeout(() => banner('CÂU CÁ HỌC GIỎI<small>Giữ nút 🎣 để lấy lực, thả tay để ném!</small>', 'gold', 3200), 400);
}
