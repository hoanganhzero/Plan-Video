// Ôn tập nhận thưởng (khi không câu cá) và "Cứu cá" (khi cá thoát).
// - Ưu tiên câu trong Sổ ôn tập (câu từng sai). Đúng 3 lần liên tiếp → thuộc bài, rời sổ.
// - Mỗi câu đúng: +xu (giới hạn mỗi ngày). Chuỗi 3 câu đúng → +1 ⚡ năng lượng kỹ năng (dùng khi kéo cá).
//   Chuỗi 5 → +1 mồi tôm, chuỗi 10 → +1 mồi vàng.
// - Cá thoát: trả lời 3 câu. Đúng cả 3 → cứu được cá; đúng 2 → được trả lại mồi.
import { answerQuestion, questionOpts, levelFromXp } from './engine.js';
import { pickQuestion } from './questions.js';

export const ENERGY_MAX = 3;
export const COINS_PER_RIGHT = 4;
export const DAILY_COIN_CAP = 160;
export const RESCUE_QUESTIONS = 3;
export { MASTERY_GOAL as MASTERY } from './engine.js';

export const today = (now = new Date()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function practiceState(state, now) {
  const p = (state.practice ||= {});
  const d = today(now);
  if (p.day !== d) Object.assign(p, { day: d, coins: 0, answered: 0, correct: 0 });
  p.streak ||= 0; p.best ||= 0; p.sessions ||= 0; p.rescues ||= 0;
  state.skillEnergy = Math.max(0, Math.min(ENERGY_MAX, state.skillEnergy || 0));
  return p;
}

// Độ khó theo cấp người chơi (1–3), để câu ôn không quá dễ / quá khó.
export function practiceDifficulty(state) {
  const lv = levelFromXp(state.xp || 0);
  return lv >= 8 ? 3 : lv >= 4 ? 2 : 1;
}

// Câu hỏi tiếp theo: 70% lấy từ Sổ ôn tập (nếu có), còn lại theo môn đang bật / bộ đề của thầy cô.
export function practiceQuestion(state, rng = Math.random, avoid = []) {
  // Câu trong sổ: chỉ tránh câu vừa hỏi ngay trước (để ôn lại sớm câu vừa sai).
  const review = (state.review || []).filter((q) => q.id !== avoid[avoid.length - 1]);
  if (review.length && rng() < 0.7) {
    // Câu có độ thuộc thấp hơn được hỏi trước.
    const min = Math.min(...review.map((q) => q.mastery || 0));
    const pool = review.filter((q) => (q.mastery || 0) === min);
    const q = pool[Math.floor(rng() * pool.length)];
    const right = q.choices[q.answer];
    const choices = [...q.choices];
    if (q.qtype !== 'tf') for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    return { ...q, choices, answer: choices.indexOf(right), isReview: true };
  }
  const opts = questionOpts(state);
  let q = pickQuestion(practiceDifficulty(state), { ...opts, review: [] }, rng);
  for (let i = 0; i < 4 && avoid.includes(q.id); i++) q = pickQuestion(practiceDifficulty(state), { ...opts, review: [] }, rng);
  return q;
}

// Ghi nhận câu trả lời trong chế độ ôn tập và trao thưởng.
export function practiceAnswer(state, question, choice, now = new Date()) {
  const p = practiceState(state, now);
  const a = answerQuestion(state, question, choice);
  const out = { correct: a.correct, xp: a.xp, mastery: a.mastery || 0, mastered: !!a.reviewed, coins: 0, energy: 0, bait: null, capped: false };
  p.answered += 1;
  if (!a.correct) { p.streak = 0; return out; }
  p.correct += 1;
  p.streak += 1;
  p.best = Math.max(p.best, p.streak);
  const room = Math.max(0, DAILY_COIN_CAP - p.coins);
  out.coins = Math.min(COINS_PER_RIGHT * (question.difficulty || 1), room);
  out.capped = room <= 0;
  p.coins += out.coins;
  state.coins = (state.coins || 0) + out.coins;
  if (state.stats) state.stats.coinsEarned = (state.stats.coinsEarned || 0) + out.coins;
  if (p.streak % 3 === 0 && state.skillEnergy < ENERGY_MAX) { state.skillEnergy += 1; out.energy = 1; }
  if (p.streak % 10 === 0) { state.items.golden = (state.items.golden || 0) + 1; out.bait = 'golden'; }
  else if (p.streak % 5 === 0) { state.items.shrimp = (state.items.shrimp || 0) + 1; out.bait = 'shrimp'; }
  return out;
}

// Bắt đầu / kết thúc một phiên ôn tập (đếm phiên, đặt lại chuỗi).
export function startPractice(state, now = new Date()) {
  const p = practiceState(state, now);
  p.sessions += 1;
  p.streak = 0;
  return p;
}

// Dùng ⚡ năng lượng khi hết lượt kỹ năng lúc kéo cá. Trả về true nếu nạp được 1 lượt.
export function spendEnergy(state, fight) {
  if (!fight || fight.charges > 0 || (state.skillEnergy || 0) <= 0) return false;
  state.skillEnergy -= 1;
  fight.charges = 1;
  return true;
}

// Kết quả "Cứu cá" theo số câu đúng.
export function rescueOutcome(correct, total = RESCUE_QUESTIONS) {
  if (correct >= total) return 'catch';
  if (correct >= total - 1) return 'bait';
  return 'none';
}
// Trả lại mồi đã dùng (giun là vô hạn nên không cần).
export function refundBait(state, bait) {
  if (!bait || bait === 'worm') return false;
  state.items[bait] = (state.items[bait] || 0) + 1;
  return true;
}
