// Giao diện "Câu Cá Học Giỏi": nối bộ máy trò chơi với màn hình.
import {
  SAVE_KEY, newGame, normalizeState, levelProgress, levelFromXp, currentBait, totalLuck, rarityChances,
  startCast, resolveCast, useHelper, fiftyFifty, sellFish, bucketValue, activeQuests, questProgress,
  claimQuest, describeReward, buyShopItem, buyRod, unlockZone, zoneFish, speciesTotal,
  RARITIES, ZONES, RODS, ITEMS, SHOP, QUESTS, fishById, zoneById, rodById,
} from './engine.js';
import { SUBJECTS, GRADES, rarityOf, rarityIndex, subjectById } from './data.js';
import { parseCustomQuestions } from './questions.js';
import { createScene } from './scene.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const tag = (rarityId) => { const r = rarityOf(rarityId); return `<span class="rarity-tag" style="background:${r.color}">${r.name}</span>`; };

// ---------- Lưu / tải ----------
function load() {
  try { return normalizeState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return newGame(); }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
}

let state = load();
const scene = createScene($('#scene'));
let busy = false;
let doneQuestIds = new Set(activeQuests(state).filter((q) => questProgress(state, q).done).map((q) => q.id));

// ---------- Âm thanh ----------
let audioCtx = null;
function beep(notes) {
  if (!state.settings.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const [freq, dur] of notes) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = freq;
      o.type = 'triangle';
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch { /* không hỗ trợ âm thanh */ }
}
const SOUND = {
  cast: [[300, 0.08], [200, 0.12]],
  bite: [[880, 0.08], [880, 0.08]],
  right: [[523, 0.1], [659, 0.1], [784, 0.18]],
  wrong: [[300, 0.15], [220, 0.25]],
  level: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]],
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

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
  renderAll();
}));

// ---------- Hiển thị ----------
function renderHud() {
  const lp = levelProgress(state.xp);
  $('#hud-coins').textContent = fmt(state.coins);
  $('#hud-level').textContent = lp.level;
  $('#hud-xp').style.width = `${Math.round(lp.ratio * 100)}%`;
  $('#hud-xp').parentElement.title = `${lp.current}/${lp.needed} KN tới cấp ${lp.level + 1}`;
  $('#hud-streak').textContent = state.stats.streak;
  $('#hud-species').textContent = `${Object.keys(state.collection).length}/${speciesTotal()}`;
  const ready = activeQuests(state).filter((q) => questProgress(state, q).done).length;
  $('#quest-badge').hidden = !ready;
  $('#quest-badge').textContent = ready;
  $('#review-badge').hidden = !state.review.length;
  $('#review-badge').textContent = state.review.length;
}

function renderZones() {
  $('#zone-list').innerHTML = ZONES.map((z) => {
    const open = state.zones.includes(z.id);
    return `<button class="zone-btn ${z.id === state.zone ? 'active' : ''} ${open ? '' : 'locked'}" data-zone="${z.id}" role="radio" aria-checked="${z.id === state.zone}">
      <span>${z.icon} ${esc(z.name)}</span>
      <small>${open ? `${zoneFish(z.id).filter((f) => state.collection[f.id]).length}/${zoneFish(z.id).length} loài` : `🔒 Cấp ${z.level}`}</small>
    </button>`;
  }).join('');
  scene.setZone(zoneById(state.zone));
}

$('#zone-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-zone]');
  if (!btn || busy) return;
  const z = zoneById(btn.dataset.zone);
  if (!state.zones.includes(z.id)) {
    toast(`🔒 ${z.name}: đạt cấp ${z.level} rồi mở ở Cửa hàng (${fmt(z.price)} xu), hoặc nhận từ nhiệm vụ.`);
    return;
  }
  state.zone = z.id;
  save();
  renderAll();
  $('#scene-msg').innerHTML = `${z.icon} <b>${esc(z.name)}</b> – ${esc(z.desc)}`;
});

function renderControls() {
  const baits = ['worm', 'shrimp', 'golden'];
  const bait = currentBait(state);
  $('#bait-select').innerHTML = baits.map((id) => {
    const it = ITEMS[id];
    const count = id === 'worm' ? '∞' : state.items[id] || 0;
    const disabled = id !== 'worm' && !state.items[id];
    return `<option value="${id}" ${id === bait ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${it.icon} ${it.name} (${count})</option>`;
  }).join('');
  $('#charm-count').textContent = state.items.charm || 0;
  $('#use-charm').disabled = !state.items.charm;
  if (!state.items.charm) $('#use-charm').checked = false;
  $('#cast-btn').disabled = busy;

  const chances = rarityChances(state.zone, totalLuck(state), $('#use-charm').checked ? rarityIndex('rare') : 0);
  const rod = rodById(state.rod);
  $('#odds').innerHTML = `<span style="border-color:var(--border)">${rod.icon} ${esc(rod.name)} · may mắn ${totalLuck(state)}</span>`
    + RARITIES.map((r, i) => (chances[i] > 0 ? `<span style="border-color:${r.color};color:${r.color}">${r.name} ${(chances[i] * 100).toFixed(chances[i] < 0.01 ? 1 : 0)}%</span>` : '')).join('');
}

$('#bait-select').addEventListener('change', (e) => { state.bait = e.target.value; save(); renderControls(); });
$('#use-charm').addEventListener('change', renderControls);

function renderQuests() {
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
      <div class="actions"><button class="btn ${p.done ? 'primary' : ''}" data-claim="${q.id}" ${p.done ? '' : 'disabled'}>Nhận thưởng</button></div>
    </div>`;
  }).join('') : '<div class="card">🏆 Bạn đã hoàn thành mọi nhiệm vụ. Thật xuất sắc!</div>';
  $('#quest-total').textContent = `Đã hoàn thành ${state.claimed.length}/${QUESTS.length} nhiệm vụ.${state.titles.length ? ` Danh hiệu: ${state.titles.join(', ')}.` : ''}`;
}

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

$('#quest-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-claim]');
  if (!btn) return;
  const before = levelFromXp(state.xp);
  const q = claimQuest(state, btn.dataset.claim);
  if (!q) return;
  beep(SOUND.right);
  toast(`🎁 Nhận thưởng "${esc(q.title)}": ${describeReward(q.reward)}`);
  if (levelFromXp(state.xp) > before) beep(SOUND.level);
  save();
  doneQuestIds = new Set(activeQuests(state).filter((x) => questProgress(state, x).done).map((x) => x.id));
  renderAll();
});

function fishCard(f, extra = '') {
  const fish = fishById(f.fishId);
  const r = rarityOf(fish.rarity);
  return `<div class="fish-card" style="border-color:${r.color}">
    <div class="emoji">${fish.emoji}</div>
    <div class="name">${esc(fish.name)}</div>
    ${tag(fish.rarity)}
    <div class="meta">${f.kg} kg · 🪙 ${fmt(f.value)}</div>
    ${extra}
  </div>`;
}

function renderBucket() {
  const sorted = [...state.bucket].sort((a, b) => b.value - a.value);
  $('#bucket-summary').textContent = state.bucket.length
    ? `${state.bucket.length} con cá · tổng giá trị 🪙 ${fmt(bucketValue(state))}`
    : 'Thùng đang trống – đi câu thôi!';
  $('#bucket-list').innerHTML = sorted.map((f) => fishCard(f, `<button class="btn small" data-sell="${f.uid}">Bán</button>`)).join('');
  $('#sell-all').disabled = !state.bucket.length;
  $('#sell-common').disabled = !state.bucket.some((f) => rarityIndex(fishById(f.fishId).rarity) <= 1);
}

function doSell(uids) {
  if (!uids.length) return;
  const r = sellFish(state, uids);
  beep(SOUND.right);
  toast(`🪙 Bán ${r.count} con cá được ${fmt(r.coins)} xu!`);
  save();
  afterAction();
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

function renderDex() {
  const have = Object.keys(state.collection).length;
  $('#dex-summary').textContent = `Đã tìm thấy ${have}/${speciesTotal()} loài. Cá đã bán vẫn được ghi trong bộ sưu tập.`;
  $('#dex-list').innerHTML = ZONES.map((z) => `
    <div class="dex-zone">
      <h3>${z.icon} ${esc(z.name)} ${state.zones.includes(z.id) ? '' : '<span class="muted small">🔒</span>'}</h3>
      <div class="fish-grid">${zoneFish(z.id).map((fish) => {
        const c = state.collection[fish.id];
        const r = rarityOf(fish.rarity);
        return c
          ? `<div class="fish-card" style="border-color:${r.color}"><div class="emoji">${fish.emoji}</div><div class="name">${esc(fish.name)}</div>${tag(fish.rarity)}<div class="meta">Đã câu ${c.count} lần · kỷ lục ${c.bestKg} kg<br>Giá gốc 🪙 ${fmt(fish.value)}</div></div>`
          : `<div class="fish-card unknown"><div class="emoji">${fish.emoji}</div><div class="name">???</div>${tag(fish.rarity)}<div class="meta">Chưa khám phá</div></div>`;
      }).join('')}</div>
    </div>`).join('');
}

function renderShop() {
  const level = levelFromXp(state.xp);
  $('#shop-coins').textContent = fmt(state.coins);
  $('#shop-zones').innerHTML = ZONES.filter((z) => z.price > 0).map((z) => {
    const open = state.zones.includes(z.id);
    const can = !open && level >= z.level && state.coins >= z.price;
    return `<div class="card ${open ? 'owned' : ''}">
      <div class="title">${z.icon} ${esc(z.name)}</div>
      <div class="muted small">${esc(z.desc)}</div>
      <div class="small">Cần cấp ${z.level} · 🪙 ${fmt(z.price)}</div>
      <div class="actions">${open ? '✅ Đã mở' : `<button class="btn ${can ? 'primary' : ''}" data-zone-buy="${z.id}" ${can ? '' : 'disabled'}>Mở khu</button>`}</div>
    </div>`;
  }).join('');
  $('#shop-rods').innerHTML = RODS.map((r) => {
    const owned = state.ownedRods.includes(r.id);
    const using = state.rod === r.id;
    const can = !owned && level >= r.level && state.coins >= r.price;
    let action;
    if (using) action = '🎣 Đang dùng';
    else if (owned) action = `<button class="btn" data-rod-use="${r.id}">Dùng cần này</button>`;
    else action = `<button class="btn ${can ? 'primary' : ''}" data-rod-buy="${r.id}" ${can ? '' : 'disabled'}>Mua</button>`;
    return `<div class="card ${owned ? 'owned' : ''}">
      <div class="title">${r.icon} ${esc(r.name)}</div>
      <div class="small">May mắn +${r.luck}${r.price ? ` · Cần cấp ${r.level} · 🪙 ${fmt(r.price)}` : ''}</div>
      <div class="actions">${action}</div>
    </div>`;
  }).join('');
  $('#shop-items').innerHTML = SHOP.map((o) => {
    const it = ITEMS[o.item];
    const can = level >= o.level && state.coins >= o.price;
    return `<div class="card">
      <div class="title">${it.icon} ${esc(it.name)} ×${o.qty}</div>
      <div class="muted small">${esc(it.desc)}</div>
      <div class="small">${o.level > 1 ? `Cần cấp ${o.level} · ` : ''}🪙 ${fmt(o.price)}</div>
      <div class="actions"><button class="btn ${can ? 'primary' : ''}" data-item-buy="${o.id}" ${can ? '' : 'disabled'}>Mua</button><span class="muted small">Đang có: ${state.items[o.item] || 0}</span></div>
    </div>`;
  }).join('');
  $('#inventory').innerHTML = Object.entries(ITEMS).filter(([id]) => id !== 'worm')
    .map(([id, it]) => `<span class="chip" title="${esc(it.desc)}">${it.icon} ${esc(it.name)}: <b>${state.items[id] || 0}</b></span>`).join('');
}

$('#tab-shop').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  let r = null;
  if (t.dataset.zoneBuy) r = unlockZone(state, t.dataset.zoneBuy);
  else if (t.dataset.rodBuy) r = buyRod(state, t.dataset.rodBuy);
  else if (t.dataset.itemBuy) r = buyShopItem(state, t.dataset.itemBuy);
  else if (t.dataset.rodUse) { state.rod = t.dataset.rodUse; r = { ok: true }; }
  if (!r) return;
  if (r.ok) { beep(SOUND.right); toast('✅ Thành công!'); save(); } else toast(`⚠️ ${r.reason}`);
  renderAll();
});

function renderReview() {
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
}
$('#review-clear').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ sổ ôn tập?')) return;
  state.review = [];
  save();
  renderAll();
});

function renderSettings() {
  $('#subject-list').innerHTML = SUBJECTS.map((s) => `<label class="pill"><input type="checkbox" data-subject="${s.id}" ${state.settings.subjects.includes(s.id) ? 'checked' : ''}> ${s.icon} ${esc(s.name)}</label>`).join('');
  $('#grade-list').innerHTML = GRADES.map((g) => `<label class="pill"><input type="radio" name="grade" data-grade="${g.id}" ${state.settings.grade === g.id ? 'checked' : ''}> ${esc(g.name)}</label>`).join('');
  $('#sound-toggle').checked = state.settings.sound;
  if (document.activeElement !== $('#custom-text')) {
    $('#custom-text').value = state.custom.map((c) => [c.q, c.a, ...c.w].join(' | ')).join('\n');
  }
  $('#custom-status').textContent = state.custom.length ? `Đang có ${state.custom.length} câu hỏi riêng.` : '';
}

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
  renderSettings();
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
    renderAll();
    toast('✅ Đã nhập dữ liệu.');
  } catch { toast('⚠️ File không hợp lệ.'); }
  e.target.value = '';
});
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ tiến trình và chơi lại từ đầu?')) return;
  state = newGame();
  save();
  renderAll();
  toast('Bắt đầu lại từ Ao làng 🏡');
});

function renderAll() {
  renderHud();
  renderZones();
  renderControls();
  const active = document.querySelector('.panel.active')?.id;
  if (active === 'tab-quests') renderQuests();
  if (active === 'tab-bucket') renderBucket();
  if (active === 'tab-dex') renderDex();
  if (active === 'tab-shop') renderShop();
  if (active === 'tab-review') renderReview();
  if (active === 'tab-settings') renderSettings();
}

function afterAction() {
  const nowDone = activeQuests(state).filter((q) => questProgress(state, q).done);
  for (const q of nowDone) {
    if (!doneQuestIds.has(q.id)) toast(`📜 Hoàn thành nhiệm vụ "<b>${esc(q.title)}</b>"! Vào tab Nhiệm vụ để nhận thưởng.`);
  }
  doneQuestIds = new Set(nowDone.map((q) => q.id));
  renderAll();
}

// ---------- Câu cá ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function cast() {
  if (busy) return;
  busy = true;
  renderControls();
  const attempt = startCast(state, Math.random, { useCharm: $('#use-charm').checked });
  $('#use-charm').checked = false;
  save();
  renderControls();
  beep(SOUND.cast);
  scene.cast();
  $('#scene-msg').textContent = attempt.charm ? '🍀 Bùa may mắn đang phát sáng… chờ cá cắn câu…' : 'Đang chờ cá cắn câu…';
  await wait(700 + 1000 + Math.random() * 2200);
  scene.bite();
  beep(SOUND.bite);
  $('#scene-msg').innerHTML = `❗ <b>Cá cắn câu!</b> Trả lời đúng để kéo lên!`;
  await wait(600);
  const choice = await askQuestion(attempt);
  const before = levelFromXp(state.xp);
  const result = resolveCast(state, attempt, choice);
  save();
  const fish = fishById(attempt.fishId);
  if (result.caught) {
    scene.reel(fish.emoji, rarityOf(fish.rarity).color);
    beep(SOUND.right);
    $('#scene-msg').innerHTML = `🎉 Câu được <b>${esc(fish.name)}</b>!`;
  } else {
    scene.escape();
    beep(SOUND.wrong);
    $('#scene-msg').textContent = choice === null ? '⏰ Hết giờ – cá đã bơi mất!' : '💨 Cá đã thoát mất…';
  }
  await wait(900);
  if (result.leveledUp) beep(SOUND.level);
  await showResult(attempt, result, choice, before);
  busy = false;
  afterAction();
  $('#scene-msg').innerHTML = 'Bấm <b>Thả câu</b> để câu tiếp!';
}

function askQuestion(attempt) {
  const q = attempt.question;
  const dlg = $('#question-dlg');
  const r = rarityOf(attempt.rarity);
  const subject = subjectById(q.subject);
  $('#q-rarity').textContent = `Cá ${r.name}`;
  $('#q-rarity').style.background = r.color;
  $('#q-subject').textContent = `${subject ? `${subject.icon} ${subject.name}` : ''}${q.isReview ? ' · 📒 Ôn lại câu từng sai' : ''}`;
  const tier = rarityIndex(attempt.rarity);
  $('#q-lead').textContent = tier >= 4 ? '😱 Một con cá cực hiếm đang giật câu! Bình tĩnh nhé!'
    : tier >= 2 ? '✨ Cá lớn cắn câu! Trả lời đúng để kéo lên.' : 'Trả lời đúng để kéo cá lên.';
  $('#q-text').textContent = q.text;
  $('#q-choices').innerHTML = q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span>${esc(c)}</button>`).join('');
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
      $('#q-hint').disabled = true;
      $('#q-time').disabled = true;
      setTimeout(() => { dlg.close(); resolve(choice); }, choice === q.answer ? 600 : 1300);
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

function showResult(attempt, result, choice) {
  const q = attempt.question;
  const fish = fishById(attempt.fishId);
  const gains = [];
  let html;
  if (result.caught) {
    gains.push(`<span class="chip">⭐ +${result.xp} KN</span>`);
    gains.push(`<span class="chip">🪙 giá ${fmt(attempt.value)} xu</span>`);
    if (state.stats.streak >= 3) gains.push(`<span class="chip">🔥 Chuỗi ${state.stats.streak}</span>`);
    if (result.newSpecies) gains.push('<span class="chip">🆕 Loài mới!</span>');
    if (result.record) gains.push('<span class="chip">🏅 Kỷ lục cân nặng!</span>');
    if (result.reviewed) gains.push('<span class="chip">📒 Đã sửa câu sai</span>');
    html = `<div class="big-emoji">${fish.emoji}</div>
      <h2>${esc(fish.name)}</h2>
      ${tag(fish.rarity)} <span class="muted">${attempt.kg} kg</span>
      <div class="gains">${gains.join('')}</div>
      <div class="explain">✅ <b>${esc(q.choices[q.answer])}</b>${q.explain ? ` – ${esc(q.explain)}` : ''}</div>`;
  } else {
    html = `<div class="big-emoji">💨</div>
      <h2>${choice === null ? 'Hết giờ!' : 'Tiếc quá, cá thoát rồi!'}</h2>
      <p class="muted">Đó là một con <b>${esc(rarityOf(fish.rarity).name)}</b>… lần sau nhé!</p>
      <div class="explain"><b>${esc(q.text)}</b><br>Đáp án đúng: <b style="color:var(--good)">${esc(q.choices[q.answer])}</b>${q.explain ? `<br><span class="muted">${esc(q.explain)}</span>` : ''}</div>
      <p class="muted small">📒 Câu này đã được ghi vào Sổ ôn tập.</p>`;
  }
  if (result.leveledUp) {
    html += `<div class="explain" style="text-align:center">🎊 <b>Lên cấp ${result.level}!</b>${unlockHint(result.level)}</div>`;
  }
  $('#result-body').innerHTML = html;
  const dlg = $('#result-dlg');
  dlg.showModal();
  $('#result-ok').focus();
  return new Promise((resolve) => dlg.addEventListener('close', resolve, { once: true }));
}

function unlockHint(level) {
  const z = ZONES.find((x) => x.level === level && !state.zones.includes(x.id));
  const r = RODS.find((x) => x.level === level && !state.ownedRods.includes(x.id));
  const parts = [];
  if (z) parts.push(`${z.icon} ${z.name} đã có thể mở ở Cửa hàng`);
  if (r) parts.push(`${r.icon} ${r.name} đã có bán`);
  return parts.length ? `<br>${parts.join(' · ')}` : '';
}

$('#result-ok').addEventListener('click', () => $('#result-dlg').close());
$('#cast-btn').addEventListener('click', cast);
$('#scene').addEventListener('click', () => { if (!busy) cast(); });
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || busy || document.querySelector('dialog[open]')) return;
  if (!$('#tab-fish').classList.contains('active') || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  cast();
});

if (!state.stats.casts) {
  $('#scene-msg').innerHTML = '👋 Chào mừng! Bấm <b>Thả câu</b>, trả lời đúng câu hỏi để kéo cá lên.';
}
renderAll();
