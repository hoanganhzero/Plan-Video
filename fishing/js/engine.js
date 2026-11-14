// Bộ máy trò chơi: trạng thái, thả câu, trả lời, nhiệm vụ, cửa hàng, lên cấp.
// Thuần logic (không đụng tới DOM) để dễ kiểm thử; rng truyền vào được.
import {
  RARITIES, ZONES, FISH, RODS, ITEMS, SHOP, QUESTS, GRADES,
  rarityIndex, zoneById, fishById, rodById, LINES, lineById,
} from './data.js';
import { pickQuestion } from './questions.js';

export const SAVE_KEY = 'cauca-hocgioi-v1';
export const ACTIVE_QUESTS = 3;
export const REVIEW_LIMIT = 50;
export const TIME_LIMIT = { 1: 20, 2: 25, 3: 30 }; // giây cho mỗi độ khó

export function newGame() {
  return {
    version: 1,
    coins: 0,
    xp: 0,
    rod: 'bamboo',
    ownedRods: ['bamboo'],
    line: 'nylon',
    ownedLines: ['nylon'],
    bait: 'worm',
    items: { shrimp: 3, golden: 0, hint: 1, time: 1, charm: 0, tea: 1, net: 0 },
    zones: ['pond'],
    zone: 'pond',
    bucket: [],
    collection: {},
    claimed: [],
    titles: [],
    review: [],
    recent: [],
    custom: [],
    stats: {
      casts: 0, answered: 0, correct: 0, correctBySubject: {},
      streak: 0, bestStreak: 0, catches: 0, catchesByRarity: {},
      escaped: 0, fishSold: 0, coinsEarned: 0, reviewedOk: 0,
    },
    settings: { subjects: ['math', 'vi', 'en', 'sci', 'his'], grade: 'g1', sound: true },
    nextUid: 1,
    online: { key: null, nickname: '', rank: null, total: null },
  };
}

// Ghép dữ liệu đã lưu với mặc định (an toàn khi thêm tính năng mới).
export function normalizeState(raw) {
  const base = newGame();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    items: { ...base.items, ...(raw.items || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    online: { ...base.online, ...(raw.online || {}) },
  };
}

// ---------- Cấp độ ----------
export const xpForLevel = (level) => 50 * (level - 1) * level;
export function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}
export function levelProgress(xp) {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, current: xp - from, needed: to - from, ratio: (xp - from) / (to - from) };
}

// ---------- May mắn & tỉ lệ ----------
export function currentBait(state) {
  return state.bait !== 'worm' && (state.items[state.bait] || 0) > 0 ? state.bait : 'worm';
}

export function totalLuck(state) {
  return (rodById(state.rod)?.luck || 0) + (ITEMS[currentBait(state)]?.luck || 0);
}

// Mỗi điểm may mắn tăng tỉ lệ các bậc cao hơn, bậc càng cao tăng càng nhiều.
export function rarityWeights(zoneId, luck = 0, minRarity = 0) {
  const zone = zoneById(zoneId);
  return zone.weights.map((w, t) => (t < minRarity ? 0 : w * (1 + 0.35 * luck * t)));
}

export function rarityChances(zoneId, luck = 0, minRarity = 0) {
  const w = rarityWeights(zoneId, luck, minRarity);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

function weightedIndex(weights, rng) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

export function fishValue(fish, kg) {
  const [min, max] = fish.kg;
  const t = max > min ? (kg - min) / (max - min) : 0.5;
  return Math.max(1, Math.round(fish.value * (0.7 + 0.6 * t)));
}

// Chọn con cá sẽ cắn câu. charm: chắc chắn từ bậc Hiếm trở lên.
export function rollFish(zoneId, luck, rng = Math.random, { charm = false } = {}) {
  const zone = zoneById(zoneId);
  const minRarity = charm ? rarityIndex('rare') : 0;
  let weights = rarityWeights(zoneId, luck, minRarity);
  if (weights.every((w) => w === 0)) weights = rarityWeights(zoneId, luck, 0);
  let tier = weightedIndex(weights, rng);
  let pool = [];
  // Khu không có cá bậc này → hạ dần xuống bậc gần nhất có cá.
  for (; tier >= 0; tier--) {
    pool = FISH.filter((f) => f.zone === zone.id && f.rarity === RARITIES[tier].id);
    if (pool.length) break;
  }
  const fish = pool[Math.floor(rng() * pool.length)];
  const kg = Math.round((fish.kg[0] + rng() * (fish.kg[1] - fish.kg[0])) * 100) / 100;
  return { fishId: fish.id, rarity: fish.rarity, kg, value: fishValue(fish, kg) };
}

// ---------- Thả câu ----------
function questionOpts(state) {
  const grade = GRADES.find((g) => g.id === state.settings.grade) || GRADES[0];
  return {
    subjects: state.settings.subjects, mathOffset: grade.mathOffset,
    recent: state.recent, review: state.review, custom: state.custom,
  };
}

function rememberQuestion(state, question) {
  state.recent = [question.id, ...state.recent.filter((id) => id !== question.id)].slice(0, 25);
}

// Số câu hỏi phải vượt qua để kéo được cá: Thường/Khá 1, Hiếm/Quý 2, Huyền thoại/Thần thoại 3.
export function questionsFor(rarity) {
  const tier = rarityIndex(rarity);
  return tier <= 1 ? 1 : tier <= 3 ? 2 : 3;
}

// Tiêu hao mồi / bùa, chọn cá và câu hỏi đầu tiên tương ứng độ hiếm.
// bonusLuck: thưởng may mắn khi ném xa / ném "Hoàn hảo".
export const currentLine = (state) => lineById(state.line) || LINES[0];

// Tiêu hao vật phẩm hỗ trợ được bật cho lượt này (nếu còn).
function consume(state, item, wanted) {
  if (!wanted || (state.items[item] || 0) <= 0) return false;
  state.items[item] -= 1;
  return true;
}

export function startCast(state, rng = Math.random, { useCharm = false, useTea = false, useNet = false, bonusLuck = 0 } = {}) {
  const bait = currentBait(state);
  const luck = totalLuck(state) + bonusLuck;
  const charm = consume(state, 'charm', useCharm);
  const tea = consume(state, 'tea', useTea);
  const net = consume(state, 'net', useNet);
  if (bait !== 'worm') state.items[bait] -= 1;
  if (state.bait !== 'worm' && (state.items[state.bait] || 0) <= 0) state.bait = 'worm';
  state.stats.casts += 1;

  const catchInfo = rollFish(state.zone, luck, rng, { charm });
  const difficulty = RARITIES[rarityIndex(catchInfo.rarity)].difficulty;
  const question = pickQuestion(difficulty, questionOpts(state), rng);
  rememberQuestion(state, question);
  return {
    ...catchInfo, zone: state.zone, bait, charm, tea, net, question, difficulty,
    line: currentLine(state).id,
    questions: questionsFor(catchInfo.rarity), timeLimit: TIME_LIMIT[difficulty],
  };
}

// Câu hỏi tiếp theo trong lúc kéo cá (cùng độ khó).
export function nextQuestion(state, attempt, rng = Math.random) {
  const question = pickQuestion(attempt.difficulty, questionOpts(state), rng);
  rememberQuestion(state, question);
  return question;
}

export function useHelper(state, item) {
  if ((state.items[item] || 0) <= 0) return false;
  state.items[item] -= 1;
  return true;
}

// Bỏ 2 đáp án sai (giữ đáp án đúng + 1 đáp án sai ngẫu nhiên).
export function fiftyFifty(question, rng = Math.random) {
  const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.answer);
  const keep = wrong[Math.floor(rng() * wrong.length)];
  return wrong.filter((i) => i !== keep);
}

// Ghi nhận một câu trả lời: thống kê, chuỗi đúng, kinh nghiệm, sổ ôn tập.
export function answerQuestion(state, question, choice) {
  const correct = choice === question.answer;
  const s = state.stats;
  const out = { correct, xp: 0, reviewed: false };
  s.answered += 1;
  if (correct) {
    s.correct += 1;
    s.correctBySubject[question.subject] = (s.correctBySubject[question.subject] || 0) + 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (question.isReview || state.review.some((q) => q.id === question.id)) {
      state.review = state.review.filter((q) => q.id !== question.id);
      s.reviewedOk += 1;
      out.reviewed = true;
    }
    // Chuỗi đúng liên tiếp thưởng thêm kinh nghiệm (tối đa +50%).
    const streakBonus = 1 + Math.min(0.5, (s.streak - 1) * 0.05);
    out.xp = Math.round(10 * question.difficulty * streakBonus);
    state.xp += out.xp;
  } else {
    s.streak = 0;
    if (question.subject && !state.review.some((q) => q.id === question.id)) {
      const { isReview, ...plain } = question;
      state.review = [plain, ...state.review].slice(0, REVIEW_LIMIT);
    }
  }
  return out;
}

// Kéo cá lên thành công: cho vào thùng, ghi bộ sưu tập, thưởng kinh nghiệm theo độ hiếm.
export function landFish(state, attempt) {
  const s = state.stats;
  const rarity = RARITIES[rarityIndex(attempt.rarity)];
  const xp = Math.round(rarity.xp * (1 + Math.min(0.5, Math.max(0, s.streak - 1) * 0.05)));
  state.xp += xp;
  // Vợt vàng: cá bán giá gấp đôi.
  const value = attempt.net ? attempt.value * 2 : attempt.value;
  const fish = { uid: state.nextUid++, fishId: attempt.fishId, kg: attempt.kg, value, zone: attempt.zone };
  state.bucket.push(fish);
  s.catches += 1;
  s.catchesByRarity[attempt.rarity] = (s.catchesByRarity[attempt.rarity] || 0) + 1;
  const entry = state.collection[attempt.fishId];
  state.collection[attempt.fishId] = { count: (entry?.count || 0) + 1, bestKg: Math.max(entry?.bestKg || 0, attempt.kg) };
  return { fish, xp, newSpecies: !entry, record: !!entry && attempt.kg > entry.bestKg };
}

export function loseFish(state) { state.stats.escaped += 1; }

// Chế độ một câu hỏi (dùng cho kiểm thử và bản đơn giản): đúng thì kéo được cá, sai thì mất cá.
export function resolveCast(state, attempt, choice) {
  const beforeLevel = levelFromXp(state.xp);
  const a = answerQuestion(state, attempt.question, choice);
  const result = { correct: a.correct, caught: false, xp: a.xp, reviewed: a.reviewed, newSpecies: false };
  if (a.correct) {
    const landed = landFish(state, attempt);
    Object.assign(result, landed, { caught: true, xp: a.xp + landed.xp });
  } else loseFish(state);
  result.level = levelFromXp(state.xp);
  result.leveledUp = result.level > beforeLevel;
  return result;
}

// ---------- Thùng cá & bán cá ----------
export function sellFish(state, uids) {
  const set = new Set(uids);
  let coins = 0;
  let count = 0;
  state.bucket = state.bucket.filter((f) => {
    if (!set.has(f.uid)) return true;
    coins += f.value;
    count += 1;
    return false;
  });
  state.coins += coins;
  state.stats.coinsEarned += coins;
  state.stats.fishSold += count;
  return { coins, count };
}

export const bucketValue = (state) => state.bucket.reduce((a, f) => a + f.value, 0);

// ---------- Nhiệm vụ ----------
export function questProgress(state, quest) {
  const s = state.stats;
  const g = quest.goal;
  let current = 0;
  switch (g.type) {
    case 'catch': {
      const min = g.minRarity ? rarityIndex(g.minRarity) : 0;
      current = RARITIES.slice(min).reduce((a, r) => a + (s.catchesByRarity[r.id] || 0), 0);
      break;
    }
    case 'correct': current = g.subject ? (s.correctBySubject[g.subject] || 0) : s.correct; break;
    case 'streak': current = s.bestStreak; break;
    case 'sell': current = s.fishSold; break;
    case 'level': current = levelFromXp(state.xp); break;
    case 'coinsEarned': current = s.coinsEarned; break;
    case 'species': current = Object.keys(state.collection).length; break;
    default: current = 0;
  }
  return { current: Math.min(current, g.n), target: g.n, done: current >= g.n };
}

export function activeQuests(state) {
  return QUESTS.filter((q) => !state.claimed.includes(q.id)).slice(0, ACTIVE_QUESTS);
}

export function claimQuest(state, questId) {
  const quest = activeQuests(state).find((q) => q.id === questId);
  if (!quest || !questProgress(state, quest).done) return null;
  const r = quest.reward;
  if (r.coins) state.coins += r.coins;
  if (r.xp) state.xp += r.xp;
  for (const [id, qty] of Object.entries(r.items || {})) state.items[id] = (state.items[id] || 0) + qty;
  if (r.rod && !state.ownedRods.includes(r.rod)) {
    state.ownedRods.push(r.rod);
    state.rod = bestRod(state);
  }
  if (r.zone && !state.zones.includes(r.zone)) state.zones.push(r.zone);
  if (r.line && !state.ownedLines.includes(r.line)) { state.ownedLines.push(r.line); state.line = bestLine(state); }
  if (r.title && !state.titles.includes(r.title)) state.titles.push(r.title);
  state.claimed.push(quest.id);
  return quest;
}

export function describeReward(reward) {
  const parts = [];
  if (reward.coins) parts.push(`🪙 ${reward.coins.toLocaleString('vi-VN')} xu`);
  if (reward.xp) parts.push(`⭐ ${reward.xp} KN`);
  for (const [id, qty] of Object.entries(reward.items || {})) parts.push(`${ITEMS[id].icon} ${ITEMS[id].name} ×${qty}`);
  if (reward.rod) { const rod = rodById(reward.rod); parts.push(`${rod.icon} ${rod.name}`); }
  if (reward.zone) { const z = zoneById(reward.zone); parts.push(`${z.icon} Mở khu ${z.name}`); }
  if (reward.line) { const l = lineById(reward.line); parts.push(`${l.icon} ${l.name}`); }
  if (reward.title) parts.push(`🏆 Danh hiệu "${reward.title}"`);
  return parts.join(' · ');
}

// ---------- Cửa hàng ----------
const bestRod = (state) => RODS.filter((r) => state.ownedRods.includes(r.id)).sort((a, b) => b.luck - a.luck)[0].id;

export function buyShopItem(state, shopId) {
  const offer = SHOP.find((o) => o.id === shopId);
  if (!offer) return { ok: false, reason: 'Không có món này.' };
  if (levelFromXp(state.xp) < offer.level) return { ok: false, reason: `Cần đạt cấp ${offer.level}.` };
  if (state.coins < offer.price) return { ok: false, reason: 'Chưa đủ xu.' };
  state.coins -= offer.price;
  state.items[offer.item] = (state.items[offer.item] || 0) + offer.qty;
  return { ok: true };
}

export function buyRod(state, rodId) {
  const rod = rodById(rodId);
  if (!rod) return { ok: false, reason: 'Không có cần này.' };
  if (state.ownedRods.includes(rodId)) return { ok: false, reason: 'Bạn đã có cần này.' };
  if (levelFromXp(state.xp) < rod.level) return { ok: false, reason: `Cần đạt cấp ${rod.level}.` };
  if (state.coins < rod.price) return { ok: false, reason: 'Chưa đủ xu.' };
  state.coins -= rod.price;
  state.ownedRods.push(rodId);
  state.rod = rodId;
  return { ok: true };
}

const bestLine = (state) => LINES.filter((l) => state.ownedLines.includes(l.id)).sort((a, b) => b.lives + b.strength - a.lives - a.strength)[0].id;

export function buyLine(state, lineId) {
  const line = lineById(lineId);
  if (!line) return { ok: false, reason: 'Không có dây này.' };
  if (state.ownedLines.includes(lineId)) return { ok: false, reason: 'Bạn đã có dây này.' };
  if (levelFromXp(state.xp) < line.level) return { ok: false, reason: `Cần đạt cấp ${line.level}.` };
  if (state.coins < line.price) return { ok: false, reason: 'Chưa đủ xu.' };
  state.coins -= line.price;
  state.ownedLines.push(lineId);
  state.line = lineId;
  return { ok: true };
}

export function unlockZone(state, zoneId) {
  const zone = zoneById(zoneId);
  if (!zone) return { ok: false, reason: 'Không có khu này.' };
  if (state.zones.includes(zoneId)) return { ok: false, reason: 'Khu này đã mở.' };
  if (levelFromXp(state.xp) < zone.level) return { ok: false, reason: `Cần đạt cấp ${zone.level}.` };
  if (state.coins < zone.price) return { ok: false, reason: 'Chưa đủ xu.' };
  state.coins -= zone.price;
  state.zones.push(zoneId);
  return { ok: true };
}

export function speciesTotal() { return FISH.length; }
export function zoneFish(zoneId) { return FISH.filter((f) => f.zone === zoneId); }
export { RARITIES, ZONES, FISH, RODS, LINES, ITEMS, SHOP, QUESTS, fishById, zoneById, rodById, lineById };
