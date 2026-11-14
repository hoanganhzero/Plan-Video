// Mô phỏng pha "kéo cá": giữ nút để thu dây, thả nút để dây chùng.
// - Độ căng dây (tension 0–1): căng đỏ quá lâu → đứt dây.
// - Khoảng cách (m): về 0 là kéo được cá lên; cá kéo ra quá xa → cá thoát.
// - Sức cá (stamina): chỉ giảm khi trả lời đúng câu hỏi ở các mốc khoảng cách.
// - Độ bền dây (lives): mỗi câu trả lời sai mất 1; hết là cá thoát.
// Thuần logic, không đụng DOM – rng truyền vào được để kiểm thử.
import { rarityIndex } from './data.js';

export const BREAK_AFTER = 0.6; // giây căng tối đa trước khi đứt dây
export const REEL_SPEED = 3.2; // m/s khi giữ nút

// lineStrength: dây tốt chịu căng hơn; calm (trà gừng): dây căng chậm hơn 35%.
export function createFight({ rarity, kg = 1, distance = 12, rodLuck = 0, lineStrength = 0, calm = false, questions = 1, lives = 2 }, rng = Math.random) {
  const tier = Math.max(0, rarityIndex(rarity));
  return {
    tier,
    start: distance,
    distance,
    tension: 0,
    stamina: 1,
    total: questions,
    questionsLeft: questions,
    lives,
    maxLives: lives,
    pull: 0.3 + tier * 0.09 + Math.min(0.2, Math.log10(kg + 1) * 0.08),
    strength: (1 + rodLuck * 0.12 + lineStrength) * (calm ? 1 / 0.65 : 1),
    surge: 0,
    surgeTimer: 1 + rng() * 1.5,
    breakTimer: 0,
    stun: 0,
    charges: 1,
    maxCharges: 2,
    done: null,
  };
}

// Hiệu ứng kỹ năng: tension = nhân độ căng, pull = kéo gần (phần quãng đường), stun = giây choáng.
export const SKILL_EFFECTS = {
  calm: { tension: 0.5 },
  wave: { tension: 0.3, calmFish: true },
  gust: { pull: 0.25 },
  gold: { tension: 0.6, stun: 3, calmFish: true },
  dragon: { tension: 0, pull: 0.35, stun: 2, calmFish: true },
};

// Dùng kỹ năng. Không bỏ qua được câu hỏi: kéo vượt mốc thì bước kế tiếp vẫn dừng ở mốc để hỏi.
export function useSkill(f, skillId) {
  const fx = SKILL_EFFECTS[skillId];
  if (!fx || f.done || f.charges <= 0) return false;
  f.charges -= 1;
  if (fx.tension !== undefined) f.tension *= fx.tension;
  if (fx.pull) f.distance = Math.max(0, f.distance - f.start * fx.pull);
  if (fx.stun) f.stun = Math.max(f.stun, fx.stun);
  if (fx.calmFish) f.surge = 0;
  f.breakTimer = 0;
  return true;
}

// Mốc khoảng cách của câu hỏi kế tiếp (chia đều quãng đường).
export function nextMilestone(f) {
  if (f.questionsLeft <= 0) return -Infinity;
  const k = f.total - f.questionsLeft + 1;
  return f.start * (1 - k / (f.total + 1));
}

// Tiến một bước thời gian. Trả về sự kiện: null | 'question' | 'landed' | 'snapped' | 'escaped'.
export function stepFight(f, dt, holding, rng = Math.random) {
  if (f.done) return null;
  // Cá thỉnh thoảng vùng vẫy mạnh (cá yếu thì ít vùng vẫy hơn).
  if (f.stun > 0) { f.stun -= dt; f.surge = 0; }
  if (f.surge > 0) f.surge -= dt;
  else if (f.stun <= 0) {
    f.surgeTimer -= dt;
    if (f.surgeTimer <= 0) {
      f.surge = 0.5 + rng() * 0.8;
      f.surgeTimer = (1.3 + rng() * 2) * (1.5 - f.stamina * 0.5);
    }
  }
  const surging = f.surge > 0;
  const stunned = f.stun > 0;
  const pull = f.pull * (0.35 + 0.65 * f.stamina) * (surging ? 2.2 : 1) * (stunned ? 0.15 : 1);

  if (holding) {
    f.distance -= dt * REEL_SPEED * (surging ? 0.3 : 1);
    f.tension += ((dt * 0.85 * (0.18 + pull * 0.9)) / f.strength) * (stunned ? 0.25 : 1);
  } else {
    f.tension -= dt * 0.7;
    f.distance += dt * pull * (surging ? 1.6 : 0.4);
  }
  f.tension = Math.min(1, Math.max(0, f.tension));

  if (f.tension >= 0.97) {
    f.breakTimer += dt;
    if (f.breakTimer >= BREAK_AFTER) { f.done = 'snapped'; return 'snapped'; }
  } else f.breakTimer = Math.max(0, f.breakTimer - dt * 2);

  if (f.distance > f.start + 8) { f.done = 'escaped'; return 'escaped'; }
  if (f.questionsLeft > 0 && f.distance <= nextMilestone(f)) {
    f.distance = nextMilestone(f);
    return 'question';
  }
  if (f.distance <= 0) {
    f.distance = 0;
    f.done = 'landed';
    return 'landed';
  }
  return null;
}

// Kết quả câu hỏi giữa trận: đúng → cá yếu đi; sai → cá vùng ra xa, mất 1 độ bền dây.
export function answerInFight(f, correct) {
  if (correct) {
    f.questionsLeft -= 1;
    f.charges = Math.min(f.maxCharges, f.charges + 1); // trả lời đúng nạp lại kỹ năng
    f.stamina = f.questionsLeft / f.total;
    f.tension *= 0.4;
    f.surge = 0;
    return 'weakened';
  }
  f.lives -= 1;
  f.distance = Math.min(f.start + 3, f.distance + f.start * 0.25);
  f.tension = Math.min(0.85, f.tension + 0.3);
  f.surge = 1;
  if (f.lives <= 0) { f.done = 'lost'; return 'lost'; }
  return 'pulled';
}

export const surging = (f) => f.surge > 0;
