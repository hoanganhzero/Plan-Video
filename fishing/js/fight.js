// Mô phỏng pha "kéo cá": giữ nút để thu dây, thả nút để dây chùng.
// - Độ căng dây (tension 0–1): căng đỏ quá lâu → đứt dây.
// - Khoảng cách (m): về 0 là kéo được cá lên; cá kéo ra quá xa → cá thoát.
// - Sức cá (stamina): chỉ giảm khi trả lời đúng câu hỏi ở các mốc khoảng cách.
// - Độ bền dây (lives): mỗi câu trả lời sai mất 1; hết là cá thoát.
// Thuần logic, không đụng DOM – rng truyền vào được để kiểm thử.
import { rarityIndex } from './data.js';

export const BREAK_AFTER = 0.6; // giây căng tối đa trước khi đứt dây
export const REEL_SPEED = 3.2; // m/s khi giữ nút

export function createFight({ rarity, kg = 1, distance = 12, rodLuck = 0, questions = 1, lives = 2 }, rng = Math.random) {
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
    strength: 1 + rodLuck * 0.12,
    surge: 0,
    surgeTimer: 1 + rng() * 1.5,
    breakTimer: 0,
    done: null,
  };
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
  if (f.surge > 0) f.surge -= dt;
  else {
    f.surgeTimer -= dt;
    if (f.surgeTimer <= 0) {
      f.surge = 0.5 + rng() * 0.8;
      f.surgeTimer = (1.3 + rng() * 2) * (1.5 - f.stamina * 0.5);
    }
  }
  const surging = f.surge > 0;
  const pull = f.pull * (0.35 + 0.65 * f.stamina) * (surging ? 2.2 : 1);

  if (holding) {
    f.distance -= dt * REEL_SPEED * (surging ? 0.3 : 1);
    f.tension += (dt * 0.85 * (0.18 + pull * 0.9)) / f.strength;
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
