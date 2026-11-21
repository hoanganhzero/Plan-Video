// Giao diện "Câu Cá Học Giỏi" kiểu game câu cá 3D:
// giữ để lấy lực ném → chờ cá cắn → giật cần → giữ/thả để kéo cá, trả lời câu hỏi ở các mốc → thẻ kết quả.
import {
  SAVE_KEY, newGame, normalizeState, levelProgress, levelFromXp, currentBait, totalLuck, rarityChances,
  startCast, nextQuestion, currentLine, buyLine, LINES, lineById, answerQuestion, landFish, loseFish, useHelper, fiftyFifty, sellFish, bucketValue,
  activeQuests, questProgress, claimQuest, describeReward, buyShopItem, buyRod, unlockZone, zoneFish, speciesTotal,
  RARITIES, ZONES, RODS, ITEMS, SHOP, QUESTS, fishById, zoneById, rodById,
  buyBucket, bucketCap, currentBucket,
} from './engine.js';
import { BAITS, BUCKETS } from './data.js';
import { SUBJECTS, GRADES, SKILLS, rarityOf, rarityIndex, subjectById } from './data.js';
import { initMatchUI } from './match-ui.js';
import { createWorld, assignSlots, EMOTES, makePublicId, colorFor } from './world.js';
import { ONLINE } from './online.js';
import { initChatUI } from './chat-ui.js';
import { createMusic } from './music.js';
import { GRADE_LIST, levelLabel, gradeLabel, subjectsForGrade, cleanSubjects, normalizeGrade } from './curriculum.js';
import { initServerUI } from './server-ui.js';
import { serverApi, knownServers, activeWorld, setActiveWorld, applyServerIdentity, serverSnapshot, slotKey, isNewer, getAccount, accountApi, accountSnapshot, logoutAccount } from './servers.js';
import { progressSummary, chatError } from './chat.js';
import { fetchSet } from './online.js';
import { newSet, addToSet } from './content.js';
import { reviewNote } from './textbook.js';
import { practiceQuestion, practiceAnswer, startPractice, spendEnergy, rescueOutcome, refundBait, ENERGY_MAX, DAILY_COIN_CAP, RESCUE_QUESTIONS, MASTERY } from './practice.js';
import { cloudCreate, cloudPush, cloudFetch, cleanSaveCode, logSetAnswer } from './online.js';
import { setQuestions } from './engine.js';
import { createFight, stepFight, answerInFight, surging, useSkill } from './fight.js';
import { createScene } from './scene.js';
import { fishSVG } from './art.js';
import { fishArt, autoUpgradeFishArt } from './fishthumb.js';
import { itemIcon, rodIcon, lineIcon, bucketIcon } from './icons.js';
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
// Thế giới đang chơi: cá nhân (SAVE_KEY) hoặc một server lớp học (mỗi server một bản lưu riêng).
const worldCode = (() => { try { return activeWorld(localStorage); } catch { return null; } })();
const worldEntry = worldCode ? knownServers(localStorage).find((s) => s.code === worldCode) : null;
function load() {
  if (worldEntry) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(slotKey(worldCode))); } catch { /* hỏng */ }
    const s = applyServerIdentity(normalizeState(raw || newGame()), worldEntry);
    s.serverSavedAt = raw?.serverSavedAt || null;
    return s;
  }
  try { return normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return newGame(); }
}
function saveLocal() {
  try { localStorage.setItem(slotKey(state.server?.code), JSON.stringify(state)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
}
function save() {
  saveLocal();
  if (typeof scheduleCloud === 'function') scheduleCloud();
  if (typeof scheduleServer === 'function') scheduleServer();
  if (typeof scheduleAccount === 'function') scheduleAccount();
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
autoUpgradeFishArt(); // hình cá → ảnh 3D "4D" khi máy hỗ trợ WebGL

// Điện thoại: menu trái gói sau nút ☰ (hiện dạng lưới giữa màn hình); có thông báo thì nút ☰ có chấm đỏ.
{
  const menu = $('#side-menu');
  const toggle = $('#menu-toggle');
  const backdrop = $('#menu-backdrop');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => { beep(SOUND.click); setMenu(!menu.classList.contains('open')); });
  backdrop.addEventListener('click', () => setMenu(false));
  menu.addEventListener('click', (e) => { if (e.target.closest('button')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });
  const syncBadge = () => { $('#menu-badge').hidden = ![...menu.querySelectorAll('.badge:not(.blue):not(.gray)')].some((b) => !b.hidden); };
  new MutationObserver(syncBadge).observe(menu, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  syncBadge();
}
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
  $('#server-pill').innerHTML = state.server ? `🏫 ${esc(state.server.name)}` : '🏠 Cá nhân';
  $('#server-pill').classList.toggle('in-server', !!state.server);
  if (typeof world !== 'undefined') syncWorld();
  const ready = activeQuests(state).filter((q) => questProgress(state, q).done).length;
  $('#quest-badge').hidden = !ready;
  $('#quest-badge').textContent = ready;
  $('#bucket-badge').hidden = !state.bucket.length;
  $('#bucket-badge').textContent = state.bucket.length >= bucketCap(state) ? 'Đầy' : state.bucket.length;
  $('#bucket-badge').classList.toggle('full', state.bucket.length >= bucketCap(state));
  const on = state.online || {};
  $('#hud-rank-text').textContent = on.nickname && on.rank ? `#${on.rank}` : 'Đua top';
  $('#review-badge').hidden = !state.review.length;
  $('#review-badge').textContent = state.review.length;
  renderGear();
  scene.setZone(z);
}

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
  if (idle) {
    scene.setGear?.({
      rod: rod.id, rodFx: rod.fx, lineColor: line.color, bait,
      charm: game.boosts.charm, tea: game.boosts.tea, net: game.boosts.net,
    });
  }
}
// Bảng chọn mồi: mồi đang có bấm để dùng; mồi chưa có hiện mờ (mua ở Cửa hàng → Mồi câu).
function renderBaitPop() {
  const cur = currentBait(state);
  $('#bait-pop').innerHTML = `<div class="bp-title">🦐 Chọn mồi câu</div>${BAITS.map((id) => {
    const it = ITEMS[id];
    const n = id === 'worm' ? '∞' : state.items[id] || 0;
    const has = id === 'worm' || n > 0;
    const zoneBonus = it.zones?.[state.zone] ? ' · hợp khu này!' : '';
    return `<button class="bp-item ${id === cur ? 'on' : ''}" data-bait="${id}" ${has ? '' : 'disabled'} title="${esc(it.desc)}">
      ${itemIcon(id, 34)}<span><b>${esc(it.name)}</b><small>🍀 +${it.luck}${it.kg ? ` · ⚖️ +${Math.round(it.kg * 100)}%` : ''}${zoneBonus}</small></span><i>${n}</i></button>`;
  }).join('')}<button class="btn small sea bp-shop" data-open-shop="baits">🏪 Mua thêm mồi</button>`;
}
$('#bait-chip').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('#bait-pop');
  if (!pop.hidden) { pop.hidden = true; return; }
  renderBaitPop();
  pop.hidden = false;
  beep(SOUND.click);
});
$('#bait-pop').addEventListener('click', (e) => {
  e.stopPropagation();
  const b = e.target.closest('[data-bait]');
  if (b && !b.disabled) {
    state.bait = b.dataset.bait;
    save();
    renderGear();
    $('#bait-pop').hidden = true;
    toast(`${ITEMS[state.bait].icon} Dùng <b>${esc(ITEMS[state.bait].name)}</b>`);
    return;
  }
  const s = e.target.closest('[data-open-shop]');
  if (s) { $('#bait-pop').hidden = true; shopTab = s.dataset.openShop; openSheet('shop'); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#bait-pop, #bait-chip')) $('#bait-pop').hidden = true; });
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
  else action = `<button class="btn ${canBuy ? 'gold' : ''} big" data-unlock="${z.id}" ${canBuy ? '' : 'disabled'}>🔓 Mở khu · 💰 ${fmt(z.price)}</button>
    <span class="small muted">${level < z.level ? `Cần cấp ${z.level} (bạn cấp ${level})` : state.coins < z.price ? 'Chưa đủ xu' : ''}</span>`;
  $('#zone-list').innerHTML = `<div class="zone-info" style="--sky:${z.sky[0]};--water:${z.water[1]}">
    <div class="zi">${z.icon}</div>
    <div class="zbody">
      <div class="zn">${esc(z.name)} <span class="small muted">· 🐟 ${found}/${fishList.length} loài</span></div>
      <div class="zd">${esc(z.desc)}</div>
      <div class="zfish">${fishList.map((f) => `<span class="${state.collection[f.id] ? '' : 'unknown'}" title="${state.collection[f.id] ? esc(f.name) : '???'}">${fishArt(f.id, { size: 56, uid: `m${f.id}` })}</span>`).join('')}</div>
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
    <div class="art">${fishArt(fish.id, { size: 120, uid: `b${f.uid}` })}</div>
    <div class="name">${esc(fish.name)}</div>
    ${tag(fish.rarity)}
    <div class="meta">${f.kg} kg · 💰 ${fmt(f.value)}</div>
    ${extra}
  </div>`;
}
RENDER.bucket = () => {
  const bk = currentBucket(state);
  const cap = bucketCap(state);
  const pct = Math.min(100, (state.bucket.length / cap) * 100);
  const next = BUCKETS.find((b) => b.cap > cap && !state.ownedBuckets.includes(b.id));
  $('#bucket-head').innerHTML = `<div class="bk-icon">${bucketIcon(bk.id, 64)}</div>
    <div class="bk-main"><b>${esc(bk.name)}</b>${bk.bonus ? ` <span class="pill on">💰 bán +${Math.round(bk.bonus * 100)}%</span>` : ''}
      <div class="bk-bar ${pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''}"><i style="width:${pct}%"></i><span>${state.bucket.length}/${cap} con</span></div>
      <small class="muted">${pct >= 100 ? '⚠️ Thùng đầy – cá câu thêm sẽ được tự bán ngay.' : 'Thùng đầy thì cá câu thêm được tự bán ngay.'}${next ? ` Nâng cấp: ${esc(next.name)} (${next.cap} con) ở 🏪 Cửa hàng.` : ''}</small></div>
    ${next ? '<button class="btn small sea" data-open-shop="buckets">⬆️ Nâng cấp</button>' : ''}`;
  const sorted = [...state.bucket].sort((a, b) => b.value - a.value);
  $('#bucket-summary').textContent = state.bucket.length
    ? `${state.bucket.length} con cá · tổng giá trị 💰 ${fmt(bucketValue(state))}`
    : 'Thùng đang trống – đi câu thôi!';
  $('#bucket-list').innerHTML = sorted.map((f) => fishCard(f, `<button class="btn small gold" data-sell="${f.uid}">Bán</button>`)).join('');
  $('#sell-all').disabled = !state.bucket.length;
  $('#sell-common').disabled = !state.bucket.some((f) => rarityIndex(fishById(f.fishId).rarity) <= 1);
};
function doSell(uids) {
  if (!uids.length) return;
  const r = sellFish(state, uids);
  beep(SOUND.catch);
  toast(`💰 Bán ${r.count} con cá được ${fmt(r.coins)} xu!`);
  save();
  afterAction();
  RENDER.bucket();
}
$('#bucket-head').addEventListener('click', (e) => {
  if (e.target.closest('[data-open-shop]')) { $('#sheet-bucket').close(); shopTab = 'buckets'; openSheet('shop'); }
});
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
          ? `<div class="fish-card" style="border-color:${r.color}"><button class="view4d" data-view="${fish.id}" title="Xem cá 4D">4D</button><div class="art">${fishArt(fish.id, { size: 120, uid: `d${fish.id}` })}</div><div class="name">${esc(fish.name)}</div>${tag(fish.rarity)}<div class="meta">Đã câu ${c.count} lần · kỷ lục ${c.bestKg} kg<br>Giá gốc 💰 ${fmt(fish.value)}</div></div>`
          : `<div class="fish-card unknown"><div class="art">${fishArt(fish.id, { size: 120, uid: `u${fish.id}` })}</div><div class="name">???</div>${tag(fish.rarity)}<div class="meta">Chưa khám phá</div></div>`;
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
      <div class="stat"><span class="muted small">Giá gốc</span><b>💰 ${fmt(fish.value)}</b></div>
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
    return `<button class="btn ${can ? 'gold' : ''}" ${attr}="${id}" ${can ? '' : 'disabled'}>💰 ${fmt(price)}</button>${level < need ? `<span class="small muted">Cấp ${need}</span>` : ''}`;
  };
  const inUse = '<span class="rarity-tag" style="background:#1f9d55">Đang dùng</span>';
  let html = '';
  if (shopTab === 'rods') {
    html = RODS.map((r) => {
      const owned = state.ownedRods.includes(r.id);
      const using = state.rod === r.id;
      return shopCard({
        icon: rodIcon(r.id, 64), title: esc(r.name), owned, using,
        desc: `<span class="skill-tag" style="--fx:${r.fx}">${SKILLS[r.skill].icon} ${esc(SKILLS[r.skill].name)}</span> ${esc(SKILLS[r.skill].desc)}`,
        stats: bar('🍀 May mắn', r.luck, 6, '#4ade80') + bar('💪 Sức kéo', r.luck, 6, '#38bdf8'),
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
  } else if (shopTab === 'buckets') {
    html = BUCKETS.map((b) => {
      const owned = state.ownedBuckets.includes(b.id);
      const using = state.bucketId === b.id;
      return shopCard({
        icon: bucketIcon(b.id, 64), title: esc(b.name), owned, using, desc: esc(b.desc),
        stats: bar('📦 Sức chứa', b.cap, 100, '#38bdf8') + (b.bonus ? bar(`💰 Giá bán +${Math.round(b.bonus * 100)}%`, b.bonus, 0.2, '#fbbf24') : ''),
        action: using ? inUse : owned ? `<button class="btn sea" data-bucket-use="${b.id}">Dùng</button>` : buyBtn('data-bucket-buy', b.id, b.price, b.level),
      });
    }).join('');
  } else {
    const baits = shopTab === 'baits';
    html = SHOP.filter((o) => (ITEMS[o.item].kind === 'bait') === baits).map((o) => {
      const it = ITEMS[o.item];
      const extra = baits ? bar('🍀 May mắn', it.luck, 5, '#4ade80') + (it.kg ? bar(`⚖️ Cá to hơn +${Math.round(it.kg * 100)}%`, it.kg, 0.3, '#f472b6') : '')
        + (it.zones ? `<div class="small muted">🗺️ Hợp: ${Object.keys(it.zones).map((z) => `${zoneById(z).icon} ${esc(zoneById(z).name)}`).join(', ')}</div>` : '') : '';
      return shopCard({
        icon: itemIcon(o.item, 64), title: `${esc(it.name)} ×${o.qty}`, desc: esc(it.desc),
        stats: `${extra}<div class="small">Đang có: <b>${state.items[o.item] || 0}</b></div>`,
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
  else if (t.dataset.bucketBuy) r = buyBucket(state, t.dataset.bucketBuy);
  else if (t.dataset.bucketUse) {
    const b = BUCKETS.find((x) => x.id === t.dataset.bucketUse);
    if (state.bucket.length > b.cap) { toast(`⚠️ Thùng này chỉ đựng ${b.cap} con – hãy bán bớt cá trước.`); return; }
    state.bucketId = b.id; r = { ok: true };
  }
  if (!r) return;
  if (r.ok) { beep(SOUND.catch); toast('✅ Thành công!'); save(); } else toast(`⚠️ ${r.reason}`);
  RENDER.shop();
  renderHud();
});

// Câu từ sách giáo khoa: khi trả lời sai, hiện bài học + nội dung liên quan để em đọc lại.
function refHtml(q) {
  const n = reviewNote(q);
  if (!n) return '';
  return `<div class="ref-box"><b>📖 Xem lại${n.lesson ? ` · ${esc(n.lesson)}` : ''}</b>${n.ref ? `<div>${esc(n.ref)}</div>` : ''}</div>`;
}

// ---------- Ôn tập ----------
RENDER.review = () => {
  const p = state.practice || {};
  const isToday = p.day === practiceToday();
  $('#practice-stats').innerHTML = `
    <span class="chip">⚡ Năng lượng <b>${state.skillEnergy || 0}/${ENERGY_MAX}</b></span>
    <span class="chip">💰 Hôm nay <b>${isToday ? p.coins : 0}/${DAILY_COIN_CAP}</b></span>
    <span class="chip">✅ Hôm nay đúng <b>${isToday ? p.correct : 0}/${isToday ? p.answered : 0}</b></span>
    <span class="chip">🔥 Chuỗi tốt nhất <b>${p.best || 0}</b></span>
    <span class="chip">🎓 Đã thuộc <b>${state.stats.reviewedOk}</b></span>`;
  $('#review-summary').textContent = state.review.length
    ? `${state.review.length} câu cần ôn · đã sửa được ${state.stats.reviewedOk} câu`
    : `Không có câu nào cần ôn 🎉 (đã sửa được ${state.stats.reviewedOk} câu)`;
  $('#review-clear').disabled = !state.review.length;
  $('#review-list').innerHTML = state.review.map((q) => {
    const s = subjectById(q.subject);
    return `<div class="review-item">
      <div class="muted small">${s ? `${s.icon} ${esc(s.name)}` : ''}</div>
      <div><b>${esc(q.text)}</b> <span class="mastery" title="Đúng ${q.mastery || 0}/${MASTERY} lần liên tiếp">${'●'.repeat(q.mastery || 0)}${'○'.repeat(Math.max(0, MASTERY - (q.mastery || 0)))}</span></div>
      <div>Đáp án đúng: <span class="ans">${esc(q.choices[q.answer])}</span></div>
      ${q.explain ? `<div class="muted small">${esc(q.explain)}</div>` : ''}${refHtml(q)}
    </div>`;
  }).join('');
};
$('#practice-start').addEventListener('click', () => openPractice());

// ---------- Ôn tập nhận thưởng & Cứu cá ----------
let pr = null; // { mode: 'practice' | 'rescue', q, asked, right, n, total, coins, energy, resolve }
const practiceToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function openPractice() {
  if (game.mode !== 'idle') { toast('Đang câu – xong lượt này rồi ôn tập nhé!'); return; }
  $('#sheet-review').close();
  startPractice(state);
  save();
  pr = { mode: 'practice', asked: [], right: 0, n: 0, coins: 0, energy: 0 };
  $('#pr-title').textContent = '🧠 Ôn tập nhận thưởng';
  $('#practice-dlg').classList.remove('rescue');
  $('#practice-dlg').showModal();
  nextPractice();
}
function runRescue(wrongQuestions) {
  return new Promise((resolve) => {
    const queue = [];
    for (const q of wrongQuestions) if (queue.length < RESCUE_QUESTIONS && !queue.some((x) => x.id === q.id)) {
      const right = q.choices[q.answer];
      const choices = [...q.choices].sort(() => Math.random() - 0.5);
      queue.push({ ...q, choices, answer: choices.indexOf(right) });
    }
    while (queue.length < RESCUE_QUESTIONS) queue.push(practiceQuestion(state, Math.random, queue.map((x) => x.id)));
    pr = { mode: 'rescue', queue, asked: [], right: 0, n: 0, total: RESCUE_QUESTIONS, resolve };
    $('#pr-title').textContent = '⛑️ Cứu cá';
    $('#practice-dlg').classList.add('rescue');
    $('#practice-dlg').showModal();
    nextPractice();
  });
}
function renderPracticeBar() {
  if (pr.mode === 'rescue') {
    $('#pr-bar').innerHTML = Array.from({ length: pr.total }, (_, i) => `<span class="dot ${i < pr.n ? (pr.marks?.[i] ? 'ok' : 'no') : ''}"></span>`).join('')
      + `<span class="muted small">Đúng cả ${pr.total} câu để kéo cá lên · đúng ${pr.total - 1} câu được trả lại mồi</span>`;
    return;
  }
  const p = state.practice;
  $('#pr-bar').innerHTML = `<span class="chip">⚡ ${'<i class="on"></i>'.repeat(state.skillEnergy || 0)}${'<i></i>'.repeat(ENERGY_MAX - (state.skillEnergy || 0))}</span>
    <span class="chip">🔥 Chuỗi <b>${p.streak}</b></span><span class="chip">💰 Hôm nay <b>${p.coins}/${DAILY_COIN_CAP}</b></span>
    <span class="chip">📒 Sổ ôn <b>${state.review.length}</b></span>`;
}
function nextPractice() {
  const q = pr.mode === 'rescue' ? pr.queue[pr.n] : practiceQuestion(state, Math.random, pr.asked.slice(-8));
  pr.q = q;
  pr.asked.push(q.id);
  pr.locked = false;
  const s = subjectById(q.subject);
  $('#pr-subject').textContent = s ? `${s.icon} ${s.name}` : '';
  const inBook = state.review.find((x) => x.id === q.id);
  $('#pr-lead').innerHTML = pr.mode === 'rescue'
    ? `Câu ${pr.n + 1}/${pr.total}${inBook ? ' · câu em vừa trả lời sai' : ''}`
    : inBook ? `📒 Câu trong sổ ôn · đã đúng ${inBook.mastery || 0}/${MASTERY} lần liên tiếp` : 'Trả lời đúng để nhận thưởng';
  $('#pr-text').textContent = q.text;
  $('#pr-choices').innerHTML = q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span>${esc(c)}</button>`).join('');
  $('#pr-explain').hidden = true;
  $('#pr-reward').hidden = true;
  $('#pr-next-row').hidden = true;
  renderPracticeBar();
}
function answerPractice(i) {
  if (!pr || pr.locked) return;
  pr.locked = true;
  const q = pr.q;
  const btns = $('#pr-choices').querySelectorAll('.choice');
  btns.forEach((b) => { b.disabled = true; });
  btns[q.answer].classList.add('right');
  const ok = i === q.answer;
  if (!ok) btns[i]?.classList.add('wrong');
  const bits = [];
  if (pr.mode === 'rescue') {
    const a = answerQuestion(state, q, i);
    (pr.marks ||= [])[pr.n] = ok;
    if (ok) { pr.right += 1; bits.push(`✅ Đúng!${a.xp ? ` ⭐ +${a.xp} KN` : ''}`); } else bits.push('❌ Chưa đúng');
  } else {
    const r = practiceAnswer(state, q, i);
    if (ok) {
      pr.right += 1; pr.coins += r.coins; pr.energy += r.energy;
      bits.push('✅ Đúng!');
      if (r.xp) bits.push(`⭐ +${r.xp} KN`);
      if (r.coins) bits.push(`💰 +${r.coins}`); else if (r.capped) bits.push('💰 đã đủ xu hôm nay');
      if (r.energy) bits.push('⚡ +1 năng lượng kỹ năng!');
      if (r.bait === 'shrimp') bits.push('🦐 +1 mồi tôm!');
      if (r.bait === 'golden') bits.push('✨ +1 mồi vàng!');
      if (r.mastered) bits.push('🎓 Thuộc bài – rời sổ ôn!');
      else if (r.mastery) bits.push(`📒 Thuộc ${r.mastery}/${MASTERY}`);
    } else bits.push('❌ Chưa đúng – câu này đã vào sổ ôn tập');
  }
  pr.n += 1;
  beep(ok ? SOUND.right : SOUND.wrong);
  if (ok && bits.some((b) => b.includes('⚡') || b.includes('🎓'))) beep(SOUND.level);
  $('#pr-reward').innerHTML = bits.map((b) => `<span>${b}</span>`).join('');
  $('#pr-reward').className = `pr-reward ${ok ? 'ok' : 'no'}`;
  $('#pr-reward').hidden = false;
  if (!ok || q.explain) {
    $('#pr-explain').innerHTML = `${ok ? '' : `Đáp án đúng: <b style="color:var(--good)">${esc(q.choices[q.answer])}</b>`}${q.explain ? `${ok ? '' : '<br>'}<span class="muted">${esc(q.explain)}</span>` : ''}${ok ? '' : refHtml(q)}`;
    $('#pr-explain').hidden = false;
  }
  const done = pr.mode === 'rescue' && pr.n >= pr.total;
  $('#pr-next').textContent = done ? 'Xem kết quả ⛑️' : 'Câu tiếp ➜';
  $('#pr-next-row').hidden = false;
  renderPracticeBar();
  save();
  renderHud();
  $('#pr-next').focus({ preventScroll: true });
}
function closePractice() {
  const dlg = $('#practice-dlg');
  if (dlg.open) dlg.close();
  if (!pr) return;
  const done = pr;
  pr = null;
  if (done.mode === 'rescue') { done.resolve(done.right); return; }
  const answered = done.n;
  if (answered) toast(`🧠 Ôn tập: đúng <b>${done.right}/${answered}</b>${done.coins ? ` · 💰 +${done.coins}` : ''}${done.energy ? ` · ⚡ +${done.energy}` : ''}`);
  afterAction();
}
$('#pr-choices').addEventListener('click', (e) => { const b = e.target.closest('.choice'); if (b) answerPractice(Number(b.dataset.i)); });
$('#pr-next').addEventListener('click', () => {
  if (!pr) return;
  if (pr.mode === 'rescue' && pr.n >= pr.total) { closePractice(); return; }
  nextPractice();
});
$('#pr-close').addEventListener('click', () => {
  if (pr?.mode === 'rescue' && pr.n < pr.total && !confirm('Dừng cứu cá? Các câu còn lại tính là chưa đúng.')) return;
  closePractice();
});
$('#practice-dlg').addEventListener('cancel', (e) => { e.preventDefault(); $('#pr-close').click(); });
$('#practice-dlg').addEventListener('keydown', (e) => {
  if (!pr) return;
  const n = Number(e.key);
  if (n >= 1 && n <= (pr.q?.choices.length || 0) && !pr.locked) answerPractice(n - 1);
  else if (e.key === 'Enter' && pr.locked) { e.preventDefault(); $('#pr-next').click(); }
});

$('#review-clear').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ sổ ôn tập?')) return;
  state.review = [];
  save();
  RENDER.review();
  renderHud();
});

// ---------- Cài đặt ----------
// Cài đặt của học sinh: tài khoản, khối lớp (chơi cá nhân), âm thanh… Môn học do khối lớp hoặc thầy cô (trong lớp) quyết định.
const subjectChips = (ids) => ids.map((id) => { const s = subjectById(id); return s ? `<span class="pill on">${s.icon} ${esc(s.name)}</span>` : ''; }).join('');
RENDER.settings = () => {
  const acc = getAccount(localStorage);
  $('#me-card').innerHTML = `<div class="row">
      <span class="grow">${acc ? `👤 <b>${esc(acc.nickname)}</b> <span class="muted">@${esc(acc.username)}</span>` : '<span class="muted">Chưa đăng nhập – tạo tài khoản để lưu tiến trình và vào lớp của thầy cô.</span>'}</span>
      <button class="btn small ${acc ? '' : 'gold'}" id="open-account">${acc ? '👤 Tài khoản & lớp học' : '👤 Đăng nhập / Tạo tài khoản'}</button></div>`;
  const g = state.settings.grade;
  const ids = state.settings.subjects.filter((x) => x !== 'custom');
  const hasSets = setQuestions(state).length > 0;
  $('#grade-card').innerHTML = state.server
    ? `<p class="small" style="margin:0 0 6px">🏫 Em đang ở lớp <b>${esc(state.server.name)}</b> – thầy cô đã chọn <b>${gradeLabel(g)}</b>:</p>
       <div class="subject-list">${subjectChips(ids)}${hasSets ? '<span class="pill on">📝 Bộ đề của thầy cô</span>' : ''}</div>`
    : `<label class="small">Em học lớp mấy? <select id="grade-select">${GRADE_LIST.map((n) => `<option value="${n}" ${n === g ? 'selected' : ''}>Lớp ${n} (${levelLabel(n)})</option>`).join('')}</select></label>
       <div class="subject-list" style="margin-top:8px">${subjectChips(ids)}</div>
       <p class="muted small">Câu hỏi lấy theo đúng các môn của khối lớp. Khi vào lớp của thầy cô, thầy cô sẽ chọn môn cho cả lớp.</p>`;
  $('#sound-toggle').checked = state.settings.sound;
  $('#music-toggle').checked = state.settings.music !== false;
  $('#music-volume').value = Math.round((state.settings.musicVolume ?? 0.5) * 100);
  $('#music-volume').disabled = state.settings.music === false;
  $('#world-toggle').checked = state.settings.showWorld !== false;
  renderCloud();
};
$('#sheet-settings').addEventListener('change', (e) => {
  if (e.target.id !== 'grade-select' || state.server) return;
  const g = Number(e.target.value);
  state.settings.grade = g;
  state.settings.subjects = [...subjectsForGrade(g), ...(state.settings.subjects.includes('custom') ? ['custom'] : [])];
  save();
  RENDER.settings();
  toast(`📚 Đã chọn <b>Lớp ${g}</b> – câu hỏi sẽ theo chương trình lớp ${g}.`);
});
$('#sheet-settings').addEventListener('click', (e) => {
  if (e.target.id === 'open-account') { $('#sheet-settings').close(); openSheet('server'); }
});
$('#sound-toggle').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });

// ---------- Nhạc nền ----------
var music = createMusic(); // var: setMode (khai báo phía trên) có thể gọi trước dòng này
music.setVolume(state.settings.musicVolume ?? 0.5);
// Trình duyệt chỉ cho phát nhạc sau lần chạm/bấm đầu tiên của người chơi.
const unlockMusic = () => { if (state.settings.music !== false) music.unlock(); };
document.addEventListener('pointerdown', unlockMusic, true);
document.addEventListener('keydown', unlockMusic, true);
$('#music-toggle').addEventListener('change', (e) => {
  state.settings.music = e.target.checked;
  music.setEnabled(e.target.checked);
  $('#music-volume').disabled = !e.target.checked;
  save();
});
$('#music-volume').addEventListener('input', (e) => {
  state.settings.musicVolume = Number(e.target.value) / 100;
  music.setVolume(state.settings.musicVolume);
});
$('#music-volume').addEventListener('change', () => save());
// ---------- Thế giới chung: thấy các bạn cùng câu ----------
// Khoá "anon" công khai (dành cho trình duyệt) – Realtime dùng khoá dạng JWT này.
const REALTIME_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrYmRiY3Byc2dzaXVubGlxaGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NzUyNTMsImV4cCI6MjEwMTA1MTI1M30.jokp_ihSS_-EsOVmn6Vd830XO8F5t2c7_mb6JHjqdq0';
const qs = new URLSearchParams(location.search);
// ?mp=local&pk=...&name=... : thử nhiều người trên một máy (các tab cùng trình duyệt), không cần mạng.
const worldMode = qs.get('mp') === 'local' ? 'local' : 'supabase';
const testId = /^[a-z0-9]{6,24}$/.test(qs.get('pk') || '') ? qs.get('pk') : null;
state.online ||= {};
if (!state.online.publicId) { state.online.publicId = makePublicId(); saveLocal(); }
const worldNames = new Map();
let seats = new Map();
let worldStatus = 'idle';
function identity() {
  const id = testId || state.online.publicId;
  const name = (testId && qs.get('name')) || cleanNickname(state.online.nickname) || `Ngư dân ${id.slice(0, 3).toUpperCase()}`;
  return { id, name, level: levelFromXp(state.xp), rod: state.rod, color: colorFor(id), title: state.titles.at(-1) || '' };
}
function feed(html) {
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.innerHTML = html;
  const box = $('#world-feed');
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 6000);
  setTimeout(() => el.remove(), 6800);
}
const world = createWorld({
  identity, mode: worldMode, url: ONLINE.url, key: REALTIME_KEY,
  onPlayers(players, total) {
    seats = assignSlots(players, seats);
    const shown = players.filter((p) => seats.has(p.id)).map((p) => ({ ...p, seat: seats.get(p.id) }));
    for (const p of players) {
      if (!worldNames.has(p.id) && worldStatus === 'SUBSCRIBED' && worldNames.size) feed(`👋 <b>${esc(p.name)}</b> vừa đến câu cùng bạn`);
      worldNames.set(p.id, p.name);
    }
    scene.setRemotePlayers?.(shown);
    $('#world-count').textContent = world.zone ? Math.max(1, total || players.length + 1) : '–';
    $('#world-pill').title = players.length ? `Đang câu cùng: ${players.map((p) => p.name).join(', ')}` : 'Chưa có bạn nào cùng khu – rủ bạn vào chơi nhé!';
  },
  onEvent(type, ev) {
    const name = worldNames.get(ev.id) || 'Một bạn';
    if (type === 'act') scene.remoteAct?.(ev.id, ev);
    else if (type === 'catch') {
      const fish = fishById(ev.fishId);
      const r = rarityOf(fish.rarity);
      scene.remoteCatch?.(ev.id, fish.id, r.color, `🎉 ${fish.name}!`);
      feed(`🎣 <b>${esc(name)}</b> câu được ${tag(fish.rarity, esc(fish.name))}${ev.kg ? ` <span class="muted">${ev.kg} kg</span>` : ''}`);
      if (rarityIndex(fish.rarity) >= 4) banner(`✨ ${esc(name)} câu được ${esc(fish.name)}!`, 'gold', 2200);
    } else if (type === 'emote') {
      const [e, text] = EMOTES[ev.e];
      scene.remoteEmote?.(ev.id, `${e} ${text}`);
    }
  },
  onStatus(s) {
    worldStatus = s;
    if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'ERROR') {
      $('#world-count').textContent = '–';
      $('#world-pill').title = 'Chưa kết nối được thế giới chung (cần mạng).';
    }
  },
});
let chatZone = null;
function syncWorld() {
  if (typeof chatUI !== 'undefined' && chatZone !== state.zone) { chatZone = state.zone; chatUI.zoneChanged(); }
  if (state.settings.showWorld === false) { if (world.zone) world.leave(); return; }
  // Trong server lớp học: chỉ thấy các bạn cùng server (kênh riêng của server).
  const room = state.server ? `${state.server.code.toLowerCase()}-${state.zone}` : state.zone;
  if (world.zone !== room) { seats = new Map(); world.join(room); }
}
// Biểu cảm có sẵn (không có chat gõ tự do)
$('#emote-pop').innerHTML = EMOTES.map(([e, text], i) => `<button data-emote="${i}" title="${esc(text)}"><span>${e}</span><small>${esc(text)}</small></button>`).join('');
$('#emote-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#emote-pop').hidden = !$('#emote-pop').hidden; });
$('#emote-pop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-emote]');
  if (!b) return;
  const [emo, text] = EMOTES[Number(b.dataset.emote)];
  const sent = world.emote(Number(b.dataset.emote));
  if (!sent && world.zone) { toast('Chậm lại chút nhé 🙂'); return; }
  scene.selfEmote?.(`${emo} ${text}`);
  beep(SOUND.click);
  $('#emote-pop').hidden = true;
});
document.addEventListener('click', (e) => { if (!e.target.closest('#emote-pop, #emote-btn')) $('#emote-pop').hidden = true; });
$('#world-pill').addEventListener('click', () => {
  const names = [...worldNames.values()];
  toast(names.length ? `👥 Đang câu cùng bạn: <b>${names.map(esc).join(', ')}</b>` : '👥 Chưa có bạn nào ở khu này – rủ bạn vào cùng câu nhé!');
});
$('#world-toggle').addEventListener('change', (e) => { state.settings.showWorld = e.target.checked; save(); syncWorld(); });
// Chỉ ở chế độ thử nhiều người trên một máy: cho script kiểm thử điều khiển.
if (worldMode === 'local') window.__fishTest = { world, scene, music, get pr() { return pr; }, rescue: (qs) => runRescue(qs), get state() { return state; } };

// ---------- Thi đấu ----------
const matchUI = initMatchUI({
  getState: () => state, save, toast, esc, banner,
  beep: (notes) => beep(notes),
  isIdle: () => game.mode === 'idle',
  onChange: () => renderHud(),
});
RENDER.match = () => matchUI.open();

// ---------- Trò chuyện / lớp học ----------
const chatUI = initChatUI({
  getState: () => state, save, toast, esc, scene, levelFromXp,
  beep: (notes) => beep(notes),
  getZone: () => state.zone,
  getZoneName: () => zoneById(state.zone).name,
  getMatchCode: () => matchUI.code,
  openSheet,
});

// ---------- Server lớp học: đồng bộ tiến trình ----------
let serverTimer = null;
let serverBusy = false;
let serverDirty = false;
function scheduleServer(delay = 6000) {
  if (!state.server) return;
  serverDirty = true;
  clearTimeout(serverTimer);
  serverTimer = setTimeout(pushServer, delay);
}
async function pushServer({ keepalive = false } = {}) {
  if (!state.server || serverBusy || !serverDirty) return;
  serverBusy = true;
  serverDirty = false;
  const f = keepalive ? (u, o) => fetch(u, { ...o, keepalive: true }) : undefined;
  try {
    state.serverSavedAt = await serverApi.save(state.online.key, state.server.code, serverSnapshot(state), progressSummary(state, levelFromXp), f);
    saveLocal();
    $('#server-pill')?.classList.remove('unsynced');
  } catch (err) {
    serverDirty = true;
    $('#server-pill')?.classList.add('unsynced');
    console.warn('Chưa lưu được lên server:', err);
    if (/join the class first|class not found/.test(String(err.message))) leaveRemovedServer();
  }
  serverBusy = false;
}
function leaveRemovedServer() {
  toast('🏫 Tài khoản của em không còn trong server này (thầy cô đã xoá). Về thế giới của em.');
  setActiveWorld(localStorage, null);
  setTimeout(() => location.reload(), 2500);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushServer({ keepalive: true }); });
window.addEventListener('pagehide', () => pushServer({ keepalive: true }));
// Khối lớp + môn học do thầy cô chọn cho lớp (server). Bộ đề giao cho lớp được thêm ở dưới.
function applyServerCurriculum(sv) {
  if (!state.server || !sv) return;
  const grade = sv.grade ? normalizeGrade(sv.grade) : state.settings.grade;
  const custom = sv.set_code || state.sets.some((s) => s.fromServer) ? ['custom'] : [];
  const subjects = [...cleanSubjects(sv.subjects?.length ? sv.subjects : subjectsForGrade(grade), grade).filter((x) => x !== 'custom'), ...custom];
  if (grade === state.settings.grade && subjects.join() === state.settings.subjects.join()) return;
  state.settings.grade = grade;
  state.settings.subjects = subjects;
  saveLocal();
  if ($('#sheet-settings').open) RENDER.settings();
}
// Mở trò chơi trong server: lấy bản lưu mới hơn trên mạng (chơi ở máy khác), nạp bộ đề thầy cô giao.
async function startServerWorld() {
  if (!state.server) return;
  let r = null;
  try { r = await serverApi.load(state.online.key, state.server.code); } catch (err) {
    if (/join the class first|class not found/.test(String(err.message))) leaveRemovedServer();
    else console.warn('Không tải được server:', err);
    return;
  }
  if (r.save && isNewer(r.save_at, state.serverSavedAt) && !sessionStorage.getItem(`cauca-adopt-${r.save_at}`)) {
    sessionStorage.setItem(`cauca-adopt-${r.save_at}`, '1');
    const fresh = applyServerIdentity(normalizeState(r.save), worldEntry);
    fresh.serverSavedAt = r.save_at;
    localStorage.setItem(slotKey(state.server.code), JSON.stringify(fresh));
    sessionStorage.setItem('cauca-flash', '☁️ Đã tải tiến trình mới nhất của em từ server.');
    location.reload();
    return;
  }
  if (r.server?.name && r.server.name !== state.server.name) { state.server.name = r.server.name; saveLocal(); renderHud(); }
  applyServerCurriculum(r.server);
  // Bộ đề thầy cô giao cho server
  const code = r.server?.set_code;
  if (code) {
    // Tải lại khi thầy cô chia sẻ lại (vd đổi "bài đang học" trong bộ đề sách giáo khoa).
    try {
      const set = await fetchSet(code);
      let s = state.sets.find((x) => x.fromCode === code);
      const fresh = !s;
      if (fresh || s.updatedAt !== set.updated_at) {
        if (fresh) { s = newSet(set.name, { fromCode: set.code, fromServer: true }); state.sets.push(s); }
        s.name = set.name;
        s.questions = [];
        s.updatedAt = set.updated_at;
        addToSet(s, set.payload);
        if (!state.settings.subjects.includes('custom')) state.settings.subjects.push('custom');
        save();
        toast(fresh ? `📝 Thầy cô đã giao bộ đề “<b>${esc(set.name)}</b>” – câu hỏi sẽ xuất hiện khi câu cá và ôn tập.`
          : `📝 Bộ đề “<b>${esc(set.name)}</b>” vừa được thầy cô cập nhật.`);
      }
    } catch (err) { console.warn('Không tải được bộ đề của server:', err); }
  }
  if (!state.serverSavedAt) scheduleServer(1500); // tài khoản mới: lưu lần đầu
}
// ---------- Tài khoản chung: thế giới cá nhân lưu theo tài khoản ----------
const account = (() => { try { return getAccount(localStorage); } catch { return null; } })();
const accountWorld = () => !state.server && account && state.account === account.username;
let accountTimer = null;
let accountBusy = false;
let accountDirty = false;
function scheduleAccount(delay = 6000) {
  if (!accountWorld()) return;
  accountDirty = true;
  clearTimeout(accountTimer);
  accountTimer = setTimeout(pushAccount, delay);
}
async function pushAccount({ keepalive = false } = {}) {
  if (!accountWorld() || accountBusy || !accountDirty) return;
  accountBusy = true;
  accountDirty = false;
  const f = keepalive ? (u, o) => fetch(u, { ...o, keepalive: true }) : undefined;
  try {
    state.accountSavedAt = await accountApi.save(account.key, accountSnapshot(state), f);
    saveLocal();
    $('#server-pill')?.classList.remove('unsynced');
  } catch (err) {
    accountDirty = true;
    $('#server-pill')?.classList.add('unsynced');
    console.warn('Chưa lưu được vào tài khoản:', err);
  }
  accountBusy = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushAccount({ keepalive: true }); });
window.addEventListener('pagehide', () => pushAccount({ keepalive: true }));
// Mở thế giới cá nhân khi đã đăng nhập: lấy bản mới hơn trên mạng (chơi ở máy khác) hoặc gửi bản đầu tiên.
async function startAccountWorld() {
  if (!account || state.server) return;
  let r;
  try { r = await accountApi.me(account.key); } catch (err) {
    if (/account not found/.test(String(err.message))) { logoutAccount(localStorage); toast('Tài khoản không còn tồn tại – đã đăng xuất.'); }
    return;
  }
  if (state.account !== account.username) return;
  if (r.save && isNewer(r.save_at, state.accountSavedAt) && !sessionStorage.getItem(`cauca-adopt-a-${r.save_at}`)) {
    sessionStorage.setItem(`cauca-adopt-a-${r.save_at}`, '1');
    const fresh = normalizeState(r.save);
    fresh.account = account.username;
    fresh.accountSavedAt = r.save_at;
    localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
    sessionStorage.setItem('cauca-flash', '☁️ Đã tải thế giới của em từ tài khoản.');
    location.reload();
    return;
  }
  if (!state.accountSavedAt) scheduleAccount(1500);
}
// Vừa đăng nhập / tạo tài khoản: thế giới cá nhân trên máy ↔ tài khoản.
function onAccountLogin(r, isNew) {
  saveLocal();
  pushServer({ keepalive: true });
  let personal = null;
  try { personal = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* */ }
  const hasProgress = (s) => s && ((s.xp || 0) > 0 || (s.stats?.casts || 0) > 0);
  let world;
  if (r.save) {
    if (hasProgress(personal) && personal.account !== r.username) {
      try { localStorage.setItem(`${SAVE_KEY}-backup-${Date.now()}`, JSON.stringify(personal)); } catch { /* */ }
    }
    world = normalizeState(r.save);
    world.accountSavedAt = r.save_at;
  } else if (personal && (!personal.account || personal.account === r.username)) {
    world = normalizeState(personal); // thế giới trên máy này trở thành thế giới của tài khoản
    world.accountSavedAt = null;
  } else world = newGame();
  world.account = r.username;
  world.online = { ...(world.online || {}), nickname: world.online?.nickname || r.nickname };
  localStorage.setItem(SAVE_KEY, JSON.stringify(world));
  setActiveWorld(localStorage, null);
  sessionStorage.setItem('cauca-flash', isNew
    ? `🎉 Đã tạo tài khoản <b>@${esc(r.username)}</b>! Giờ em có thể vào bất kỳ server nào của thầy cô.`
    : `👋 Xin chào <b>${esc(r.nickname)}</b>! ${r.save ? 'Đã tải thế giới của em.' : 'Thế giới trên máy này đã được lưu vào tài khoản.'}`);
  location.reload();
}

const serverUI = initServerUI({
  getState: () => state, toast, esc, normalizeState, newGame,
  saveNow: () => { saveLocal(); pushServer({ keepalive: true }); pushAccount({ keepalive: true }); },
  onLogin: onAccountLogin,
});
startAccountWorld();
RENDER.server = () => serverUI.open();
startServerWorld();
{
  const flash = sessionStorage.getItem('cauca-flash');
  if (flash) { sessionStorage.removeItem('cauca-flash'); setTimeout(() => toast(flash), 600); }
}

// ---------- Lưu tiến trình trên mạng ----------
let cloudTimer = null;
let cloudBusy = false;
function scheduleCloud(delay = 15000) {
  if (!state.cloud?.code) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, delay);
}
async function pushCloud() {
  if (!state.cloud?.code || cloudBusy) return;
  cloudBusy = true;
  try { await cloudPush(state); saveLocal(); } catch (err) { console.warn('Chưa đồng bộ được:', err); }
  cloudBusy = false;
  if ($('#sheet-settings').open) renderCloud();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushCloud(); });
function renderCloud() {
  const c = state.cloud;
  $('#cloud-body').innerHTML = c?.code ? `
    <p class="muted small">Tiến trình của bạn tự lưu lên mạng sau mỗi lượt câu. Sang máy khác, nhập mã này để chơi tiếp.</p>
    <div class="save-code">${esc(c.code)}</div>
    <p class="small">Lần đồng bộ gần nhất: ${c.syncedAt ? new Date(c.syncedAt).toLocaleString('vi-VN') : 'chưa'}</p>
    <div class="row"><button class="btn sea" id="cloud-sync">🔄 Đồng bộ ngay</button><button class="btn" id="cloud-copy">📋 Chép mã</button></div>
    <p class="muted small">⚠️ Giữ kín mã này như mật khẩu – ai có mã sẽ mở được tiến trình của bạn.</p>`
    : `<p class="muted small">Chưa bật. Tạo mã lưu để không mất cá, cấp và vật phẩm khi đổi máy hay xoá dữ liệu trình duyệt.</p>
    <div class="row"><button class="btn gold" id="cloud-create">☁️ Tạo mã lưu</button></div>`;
  $('#cloud-body').innerHTML += `
    <details><summary class="small"><b>Khôi phục tiến trình bằng mã lưu</b></summary>
      <div class="row"><input id="cloud-code-in" class="nick-input code-input" maxlength="16" placeholder="XXXX-XXXX-XXXX" autocomplete="off">
        <button class="btn" id="cloud-restore">⬇️ Khôi phục</button></div></details>`;
}
$('#cloud-body').addEventListener('click', async (e) => {
  const id = e.target.id;
  if (id === 'cloud-create') {
    try {
      const code = await cloudCreate(state);
      saveLocal();
      renderCloud();
      toast(`☁️ Mã lưu của bạn: <b style="font-size:1.3em;letter-spacing:2px">${esc(code)}</b> – hãy ghi lại!`);
    } catch (err) { toast(`⚠️ Chưa tạo được mã (cần mạng): ${esc(err.message)}`); }
  } else if (id === 'cloud-sync') { await pushCloud(); toast('☁️ Đã đồng bộ.'); }
  else if (id === 'cloud-copy') { try { await navigator.clipboard.writeText(state.cloud.code); toast('📋 Đã chép mã lưu.'); } catch { /* bỏ qua */ } }
  else if (id === 'cloud-restore') {
    const code = cleanSaveCode($('#cloud-code-in').value);
    try {
      const r = await cloudFetch(code);
      const s = r.save;
      if (!confirm(`Khôi phục tiến trình (cấp ${levelFromXp(s.xp || 0)}, ${Object.keys(s.collection || {}).length} loài cá, lưu lúc ${new Date(r.updatedAt).toLocaleString('vi-VN')})?\nTiến trình hiện tại trên máy này sẽ được thay thế.`)) return;
      state = normalizeState(s);
      state.cloud = { code: r.code, syncedAt: Date.now() };
      saveLocal();
      $('#sheet-settings').close();
      renderHud();
      toast('✅ Đã khôi phục tiến trình!');
    } catch (err) { toast(`⚠️ ${esc(err.message)}`); }
  }
});

// ---------- Bộ đề (giáo viên / phụ huynh) ----------
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
  world.refreshMeta();
  chatUI.afterAction();
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
  if (!state.online?.nickname || state.server) return null; // trong server: dùng bảng xếp hạng của server
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
  chatUI.nicknameChanged();
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
  if (typeof music !== 'undefined') music.setMood(mode === 'fight' || mode === 'question' ? 'fight' : 'calm');
  if (typeof world !== 'undefined') world.act(mode === 'question' ? 'fight' : mode, { dist: attempt?.distance || 12, tension: fight?.tension || 0 });
  setAction(mode === 'cast' ? 'wait' : mode === 'question' || mode === 'result' ? 'busy' : mode);
  $('#power').hidden = mode !== 'charge';
  $('#fight-hud').hidden = !(mode === 'fight' || mode === 'question');
  if (typeof renderSkill === 'function') renderSkill();
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
  const rodNow = rodById(state.rod);
  scene.setGear?.({
    rod: rodNow.id, rodFx: rodNow.fx, lineColor: lineById(attempt.line)?.color, bait: attempt.bait,
    charm: attempt.charm, tea: attempt.tea, net: attempt.net,
  });
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
  hint('<b>Giữ</b> để kéo · <b>thả</b> khi dây căng đỏ · <b>E</b> = kỹ năng');
  setMode('fight');
  renderSkill();
  lastT = performance.now();
  rafId = requestAnimationFrame(fightTick);
}

// ---------- Kỹ năng câu cá ----------
function renderSkill() {
  const btn = $('#skill-btn');
  const show = !!fight && (game.mode === 'fight' || game.mode === 'question');
  btn.hidden = !show;
  if (!show) return;
  const rod = rodById(state.rod);
  const sk = SKILLS[rod.skill];
  $('#skill-ico').textContent = sk.icon;
  $('#skill-name').textContent = sk.name;
  $('#skill-charges').innerHTML = Array.from({ length: fight.maxCharges }, (_, i) => `<i class="${i < fight.charges ? 'on' : ''}"></i>`).join('');
  btn.title = `${sk.name}: ${sk.desc}`;
  btn.style.setProperty('--fx', rod.fx);
  btn.classList.toggle('empty', fight.charges <= 0 && !(state.skillEnergy > 0));
  $('#skill-energy').hidden = !(state.skillEnergy > 0);
  $('#skill-energy').textContent = `⚡${state.skillEnergy || 0}`;
  btn.disabled = game.mode !== 'fight';
}
function screenFlash(color) {
  const el = $('#screen-flash');
  el.style.setProperty('--fx', color);
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}
function castSkill() {
  if (game.mode !== 'fight' || !fight) return;
  const rod = rodById(state.rod);
  const sk = SKILLS[rod.skill];
  if (fight.charges <= 0 && spendEnergy(state, fight)) {
    save();
    toast(`⚡ Dùng 1 năng lượng ôn tập (còn ${state.skillEnergy})`);
  }
  if (!useSkill(fight, rod.skill)) {
    toast('⚡ Hết lượt kỹ năng – trả lời đúng câu hỏi để nạp thêm, hoặc 🧠 Ôn tập để tích năng lượng!');
    return;
  }
  scene.skill?.(rod.skill);
  screenFlash(rod.fx);
  beep([[392, 0.08], [523, 0.08], [784, 0.12], [1047, 0.2]], 'sawtooth', 0.06);
  banner(`${sk.icon} ${sk.name.toUpperCase()}!<small>${esc(sk.desc)}</small>`, 'gold', 1300);
  if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  renderSkill();
}
$('#skill-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); castSkill(); });
document.addEventListener('keydown', (e) => {
  if ((e.key === 'e' || e.key === 'E') && !e.repeat && !document.querySelector('dialog[open]')) castSkill();
});

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
  scene.fight?.(fight.distance / Math.max(1, fight.start), fight.tension, surging(fight), fight.stun);
  world.act('fight', { tension: fight.tension });
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
  // Đang thi đấu: câu hỏi lấy từ trận (máy chủ chấm); không thì câu thường.
  const question = matchUI.nextQuestion() || (fightLog.length === 0 ? attempt.question : nextQuestion(state, attempt));
  banner('CÁ VÙNG VẪY!', 'red', 900);
  await wait(500);
  const choice = await askQuestion(question, { step: `Câu ${n}/${fight.total}`, lives: fight.lives });
  const res = answerQuestion(state, question, choice);
  fightLog.push({ question, choice, correct: res.correct, xp: res.xp });
  // Học sinh làm bộ đề của thầy cô (tải bằng mã) → ghi kết quả cho báo cáo giáo viên.
  if (question.setCode) logSetAnswer(state, question.setCode, question.text, res.correct).catch(() => {});
  const outcome = answerInFight(fight, res.correct);
  save();
  renderFight();
  if (res.correct) {
    beep(SOUND.right);
    banner(`CHÍNH XÁC! +${res.xp} KN<small>${fight.questionsLeft ? 'Cá yếu đi' : 'Cá kiệt sức'} · ⚡ kỹ năng ${fight.charges}/${fight.maxCharges}</small>`, 'green', 1300);
  } else {
    beep(SOUND.wrong);
    if (outcome === 'lost') { finishLost('lost'); return; }
    banner('SAI RỒI!<small>Cá kéo ra xa – mất 1 ❤️</small>', 'red', 1400);
  }
  hint('<b>Giữ</b> để kéo · <b>thả</b> khi dây căng đỏ · <b>E</b> = kỹ năng');
  setMode('fight');
  renderSkill();
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
  $('#q-subject').textContent = q.matchLabel || `${subject ? `${subject.icon} ${subject.name}` : ''}${q.isReview ? ' · 📒 Ôn lại câu từng sai' : ''}`;
  const askedAt = performance.now();
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
    $('#q-hint').disabled = usedHint || !state.items.hint || q.choices.length < 3;
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
    async function finish(choice) {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      $('#q-choices').querySelectorAll('.choice').forEach((b) => { b.disabled = true; });
      $('#q-tools').hidden = true;
      // Câu thi đấu: gửi đáp án cho máy chủ chấm rồi mới hiện đúng/sai.
      if (q.grade) {
        $('#q-explain').hidden = false;
        $('#q-explain').innerHTML = '⏳ Đang chấm…';
        await q.grade(choice, performance.now() - askedAt);
      }
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
        : `${choice === null ? '⏰ <b>Hết giờ!</b>' : '❌ <b>Chưa đúng.</b>'} Đáp án đúng: <b style="color:var(--good)">${esc(q.choices[q.answer])}</b>${q.explain ? `<br><span class="muted">${esc(q.explain)}</span>` : ''}${refHtml(q)}<span class="muted small">📒 Đã ghi vào Sổ ôn tập.</span>`;
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
      if (q.grade) { toast('Phao gợi ý không dùng được trong trận đấu.'); return; }
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
  matchUI.onFish(rarityIndex(attempt.rarity));
  world.caught(attempt.fishId, attempt.kg);
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
      <div class="stat"><span class="muted small">Giá bán</span><b>💰 ${fmt(attempt.value)}</b></div>
      <div class="stat"><span class="muted small">Khu</span><b>${zoneById(attempt.zone).icon}</b></div>
    </div>
    <div class="gains">${gains.map((g) => `<span>${g}</span>`).join('')}</div>
    ${level > before ? `<div class="levelup">🎊 LÊN CẤP ${level}!${unlockHint(level)}</div>` : ''}`;
  const sellPrice = Math.round(attempt.value * (attempt.net ? 2 : 1) * (1 + currentBucket(state).bonus));
  $('#result-actions').innerHTML = landed.autoSold
    ? `<div class="small" style="width:100%">📦 Thùng đầy – đã tự bán con cá này được <b>💰 ${fmt(landed.autoSold)}</b>. Nâng cấp thùng ở 🏪 Cửa hàng!</div><button class="btn gold big" id="r-keep">Câu tiếp 🎣</button>`
    : `<button class="btn sea big" id="r-keep">📦 Cho vào thùng (${state.bucket.length}/${bucketCap(state)})</button><button class="btn gold big" id="r-sell">💰 Bán ngay +${fmt(sellPrice)}</button>`;
  if (level > before) beep(SOUND.level);
  const uid = landed.fish.uid;
  const choice = await showResult(() => show4D($('#catch-viewer'), fish.id));
  if (choice === 'sell' && !landed.autoSold) {
    const r = sellFish(state, [uid]);
    save();
    toast(`💰 +${fmt(r.coins)} xu`);
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
    ${wrongs.map((l) => `<div class="explain"><b>${esc(l.question.text)}</b><br>Đáp án đúng: <b style="color:var(--good)">${esc(l.question.choices[l.question.answer])}</b>${l.question.explain ? `<br><span class="muted">${esc(l.question.explain)}</span>` : ''}${refHtml(l.question)}</div>`).join('')}`;
  // Không cứu cá khi đang thi đấu (giữ công bằng cho trận).
  const canRescue = !attempt.rescued && !matchUI.code;
  $('#result-actions').innerHTML = (canRescue ? `<button class="btn sea big" id="r-rescue" title="Trả lời đúng ${RESCUE_QUESTIONS} câu để kéo cá lên">⛑️ Cứu cá (${RESCUE_QUESTIONS} câu)</button>` : '')
    + '<button class="btn gold big" id="r-ok">Câu tiếp 🎣</button>';
  const pick = await showResult();
  if (pick === 'rescue') {
    attempt.rescued = true;
    const right = await runRescue(wrongs.map((l) => l.question).filter((q) => q.answer >= 0 && q.subject !== 'match'));
    const outcome = rescueOutcome(right);
    state.practice.rescues = (state.practice.rescues || 0) + (outcome === 'catch' ? 1 : 0);
    if (outcome === 'catch') {
      state.stats.escaped = Math.max(0, state.stats.escaped - 1);
      banner('⛑️ CỨU ĐƯỢC CÁ!', 'gold', 1400);
      await finishCatch();
      return;
    }
    if (outcome === 'bait' && refundBait(state, attempt.bait)) toast(`⛑️ Đúng ${right}/${RESCUE_QUESTIONS} câu – được trả lại mồi ${esc(ITEMS[attempt.bait]?.name || '')}!`);
    else if (outcome === 'bait') toast(`⛑️ Đúng ${right}/${RESCUE_QUESTIONS} câu – suýt nữa thì cứu được!`);
    else toast(`⛑️ Đúng ${right}/${RESCUE_QUESTIONS} câu – ôn lại trong 📒 Ôn tập rồi thử lại nhé!`);
    save();
  }
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
      resolve(b.id === 'r-sell' ? 'sell' : b.id === 'r-rescue' ? 'rescue' : 'keep');
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
matchUI.resume();
if (!state.stats.casts) {
  setTimeout(() => banner('CÂU CÁ HỌC GIỎI<small>Giữ nút 🎣 để lấy lực, thả tay để ném!</small>', 'gold', 3200), 400);
}
