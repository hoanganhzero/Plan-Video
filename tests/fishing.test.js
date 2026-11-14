import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, normalizeState, levelFromXp, xpForLevel, rarityChances, rollFish, startCast, resolveCast,
  sellFish, activeQuests, claimQuest, questProgress, buyShopItem, buyRod, unlockZone, fiftyFifty,
  ZONES, FISH, QUESTS, RARITIES,
} from '../fishing/js/engine.js';
import { mathQuestion, parseCustomQuestions, pickQuestion, bankQuestions } from '../fishing/js/questions.js';
import { rarityIndex } from '../fishing/js/data.js';

// RNG cố định để test lặp lại được.
function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function evalMath(text) {
  const expr = text.replace('= ?', '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  return Function(`return (${expr})`)();
}

test('every zone has fish and fish values rise zone by zone', () => {
  let prevMax = 0;
  for (const z of ZONES) {
    const fish = FISH.filter((f) => f.zone === z.id);
    assert.ok(fish.length >= 5, `${z.id} needs fish`);
    const max = Math.max(...fish.map((f) => f.value));
    assert.ok(max > prevMax, `${z.id} top fish should be worth more than previous zone`);
    prevMax = max;
    z.weights.forEach((w, t) => {
      if (w > 0) assert.ok(fish.some((f) => rarityIndex(f.rarity) <= t), `${z.id} tier ${t} has fallback fish`);
    });
  }
});

test('luck shifts chances toward rarer fish', () => {
  const plain = rarityChances('river', 0);
  const lucky = rarityChances('river', 5);
  assert.ok(lucky[0] < plain[0]);
  assert.ok(lucky[4] > plain[4]);
  assert.ok(Math.abs(lucky.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('rollFish stays in zone, charm guarantees rare or better', () => {
  const rng = seeded(7);
  for (let i = 0; i < 200; i++) {
    const c = rollFish('pond', 0, rng, { charm: true });
    const fish = FISH.find((f) => f.id === c.fishId);
    assert.equal(fish.zone, 'pond');
    assert.ok(rarityIndex(c.rarity) >= rarityIndex('rare'));
    assert.ok(c.kg >= fish.kg[0] && c.kg <= fish.kg[1]);
    assert.ok(c.value > 0);
  }
});

test('levels grow with xp', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(xpForLevel(2) - 1), 1);
  assert.equal(levelFromXp(xpForLevel(2)), 2);
  assert.equal(levelFromXp(xpForLevel(10)), 10);
});

test('math questions are correct at every level', () => {
  const rng = seeded(3);
  for (let level = 1; level <= 5; level++) {
    for (let i = 0; i < 80; i++) {
      const q = mathQuestion(level, rng);
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4, 'choices must be distinct');
      const ans = Number(q.choices[q.answer]);
      if (/^[-\d(][\d\s()+−×÷-]*= \?$/.test(q.text)) assert.equal(ans, evalMath(q.text), q.text);
      const m = q.text.match(/^Tìm x: (\d+)x \+ (\d+) = (\d+)$/);
      if (m) assert.equal(Number(m[1]) * ans + Number(m[2]), Number(m[3]));
      if (level < 5) q.choices.forEach((c) => assert.ok(Number(c) >= 0, `no negatives at level ${level}`));
    }
  }
});

test('bank questions are well formed for each subject and difficulty', () => {
  for (const s of ['vi', 'en', 'sci', 'his']) {
    const list = bankQuestions(s);
    for (const d of [1, 2, 3]) assert.ok(list.some(({ item }) => item.d === d), `${s} has difficulty ${d}`);
    for (const { item } of list) {
      assert.equal(item.w.length, 3);
      assert.ok(!item.w.includes(item.a), `${item.q} wrong answers must differ from correct`);
    }
  }
});

test('custom questions parse and can be asked', () => {
  const { questions, errors } = parseCustomQuestions('# ghi chú\n2 + 2 bằng mấy? | 4 | 3 | 5 | 6\nThiếu đáp án sai | chỉ có đúng\n\nThủ đô Pháp? | Pa-ri | Luân Đôn');
  assert.equal(questions.length, 2);
  assert.deepEqual(errors, [3]);
  const q = pickQuestion(1, { subjects: ['custom'], custom: questions }, seeded(2));
  assert.equal(q.subject, 'custom');
  assert.ok(['4', 'Pa-ri'].includes(q.choices[q.answer]));
});

test('correct answer lands the fish, wrong answer loses it and saves it for review', () => {
  const state = newGame();
  const rng = seeded(11);
  const a1 = startCast(state, rng);
  assert.equal(state.items.shrimp, 3, 'worm is the default bait, shrimp untouched');
  const r1 = resolveCast(state, a1, a1.question.answer);
  assert.ok(r1.caught && r1.newSpecies && r1.xp > 0);
  assert.equal(state.bucket.length, 1);
  assert.equal(state.stats.streak, 1);

  const a2 = startCast(state, rng);
  const wrong = (a2.question.answer + 1) % 4;
  const r2 = resolveCast(state, a2, wrong);
  assert.equal(r2.caught, false);
  assert.equal(state.bucket.length, 1);
  assert.equal(state.stats.streak, 0);
  assert.equal(state.review[0].id, a2.question.id);

  // Trả lời đúng câu đã sai → được gỡ khỏi sổ ôn tập.
  const again = { ...a2, question: { ...state.review[0], isReview: true } };
  resolveCast(state, again, again.question.answer);
  assert.equal(state.review.length, 0);
  assert.equal(state.stats.reviewedOk, 1);
});

test('bait and charm are consumed, falling back to worms', () => {
  const state = newGame();
  state.bait = 'shrimp';
  state.items.shrimp = 1;
  state.items.charm = 1;
  const a = startCast(state, seeded(5), { useCharm: true });
  assert.equal(a.bait, 'shrimp');
  assert.ok(a.charm);
  assert.ok(rarityIndex(a.rarity) >= rarityIndex('rare'));
  assert.equal(state.items.shrimp, 0);
  assert.equal(state.items.charm, 0);
  assert.equal(state.bait, 'worm');
});

test('harder fish ask harder questions with more time', () => {
  const state = newGame();
  state.zones.push('abyss');
  state.zone = 'abyss';
  state.settings.subjects = ['sci'];
  const rng = seeded(9);
  for (let i = 0; i < 40; i++) {
    const a = startCast(state, rng);
    const d = RARITIES[rarityIndex(a.rarity)].difficulty;
    if (!a.question.isReview) assert.equal(a.question.difficulty, d);
    assert.ok(a.timeLimit >= 20);
  }
});

test('selling fish earns coins and counts for quests', () => {
  const state = newGame();
  state.bucket = [{ uid: 1, fishId: 'ro', kg: 0.2, value: 8 }, { uid: 2, fishId: 'chep', kg: 1, value: 30 }];
  const r = sellFish(state, [1, 2]);
  assert.deepEqual(r, { coins: 38, count: 2 });
  assert.equal(state.coins, 38);
  assert.equal(state.stats.fishSold, 2);
  assert.equal(state.stats.coinsEarned, 38);
});

test('quests unlock in order and grant rewards once', () => {
  const state = newGame();
  assert.deepEqual(activeQuests(state).map((q) => q.id), ['q1', 'q2', 'q3']);
  assert.equal(claimQuest(state, 'q1'), null, 'not done yet');
  state.stats.catchesByRarity.common = 1;
  assert.ok(questProgress(state, QUESTS[0]).done);
  const shrimpBefore = state.items.shrimp;
  assert.ok(claimQuest(state, 'q1'));
  assert.equal(state.coins, 50);
  assert.equal(state.items.shrimp, shrimpBefore + 2);
  assert.equal(claimQuest(state, 'q1'), null, 'cannot claim twice');
  assert.deepEqual(activeQuests(state).map((q) => q.id), ['q2', 'q3', 'q4']);
});

test('quest rewards can unlock zones and rods', () => {
  const state = newGame();
  state.claimed = QUESTS.slice(0, 6).map((q) => q.id);
  state.xp = xpForLevel(3);
  assert.ok(claimQuest(state, 'q7'));
  assert.ok(state.zones.includes('river'));
  state.claimed.push('q8');
  state.stats.catchesByRarity = { rare: 2, epic: 1 };
  assert.ok(claimQuest(state, 'q9'));
  assert.ok(state.ownedRods.includes('fiber'));
  assert.equal(state.rod, 'fiber', 'auto-equips the better rod');
});

test('shop, rods and zones check level and coins', () => {
  const state = newGame();
  assert.equal(buyShopItem(state, 'hint3').ok, false);
  state.coins = 1000;
  assert.ok(buyShopItem(state, 'hint3').ok);
  assert.equal(state.items.hint, 4);
  assert.equal(buyRod(state, 'fiber').reason, 'Cần đạt cấp 2.');
  state.xp = xpForLevel(3);
  assert.ok(buyRod(state, 'fiber').ok);
  assert.ok(unlockZone(state, 'river').ok);
  assert.equal(state.coins, 1000 - 100 - 400 - 300);
  assert.equal(unlockZone(state, 'lake').ok, false);
});

test('fifty-fifty removes exactly two wrong answers', () => {
  const q = mathQuestion(2, seeded(4));
  const removed = fiftyFifty(q, seeded(8));
  assert.equal(removed.length, 2);
  assert.ok(!removed.includes(q.answer));
});

test('old saves are upgraded with new defaults', () => {
  const s = normalizeState({ coins: 99, items: { shrimp: 9 }, settings: { grade: 'g6' } });
  assert.equal(s.coins, 99);
  assert.equal(s.items.shrimp, 9);
  assert.equal(s.items.hint, 1);
  assert.equal(s.settings.grade, 'g6');
  assert.deepEqual(s.settings.subjects, ['math', 'vi', 'en', 'sci', 'his']);
});

// ---------- Pha kéo cá ----------
import { createFight, stepFight, answerInFight, nextMilestone } from '../fishing/js/fight.js';
import { questionsFor, answerQuestion, landFish } from '../fishing/js/engine.js';

function runFight(f, policy, onQuestion, rng, maxT = 120) {
  for (let t = 0; t < maxT; t += 0.05) {
    const ev = stepFight(f, 0.05, policy(f), rng);
    if (ev === 'question') { const r = answerInFight(f, onQuestion()); if (r === 'lost') return 'lost'; }
    else if (ev) return ev;
  }
  return 'timeout';
}
const smart = (f) => f.tension < 0.7;

test('rarer fish need more questions', () => {
  assert.equal(questionsFor('common'), 1);
  assert.equal(questionsFor('rare'), 2);
  assert.equal(questionsFor('mythic'), 3);
});

test('careful reeling with correct answers lands every kind of fish', () => {
  for (const rarity of ['common', 'rare', 'legendary', 'mythic']) {
    const rng = seeded(21);
    const f = createFight({ rarity, kg: 50, distance: 20, questions: questionsFor(rarity) }, rng);
    let asked = 0;
    assert.equal(runFight(f, smart, () => { asked++; return true; }, rng), 'landed', rarity);
    assert.equal(asked, questionsFor(rarity));
    assert.equal(f.stamina, 0);
  }
});

test('holding the reel non-stop snaps the line; doing nothing lets the fish escape', () => {
  const rng = seeded(4);
  const greedy = createFight({ rarity: 'epic', kg: 10, distance: 24, questions: 2 }, rng);
  assert.equal(runFight(greedy, () => true, () => true, rng), 'snapped');
  const lazy = createFight({ rarity: 'common', distance: 10 }, rng);
  assert.equal(runFight(lazy, () => false, () => true, rng), 'escaped');
});

test('wrong answers cost line durability and push the fish away', () => {
  const f = createFight({ rarity: 'rare', distance: 12, questions: 2, lives: 2 });
  f.distance = nextMilestone(f);
  const before = f.distance;
  assert.equal(answerInFight(f, false), 'pulled');
  assert.ok(f.distance > before);
  assert.equal(f.lives, 1);
  assert.equal(answerInFight(f, false), 'lost');
  assert.equal(f.done, 'lost');
});

test('answering and landing update stats like a single-question catch', () => {
  const state = newGame();
  const a = startCast(state, seeded(13), { bonusLuck: 2 });
  assert.equal(a.questions, questionsFor(a.rarity));
  const r = answerQuestion(state, a.question, a.question.answer);
  assert.ok(r.correct && r.xp > 0);
  const landed = landFish(state, a);
  assert.ok(landed.newSpecies);
  assert.equal(state.bucket.length, 1);
  assert.equal(state.stats.correct, 1);
});

// ---------- Bảng xếp hạng online ----------
import { buildSubmission, submitScore, topPlayers, validNickname, cleanNickname, bestFish, ONLINE } from '../fishing/js/online.js';
import { fishSVG } from '../fishing/js/art.js';

test('nicknames are cleaned and validated', () => {
  assert.equal(cleanNickname('  Mèo   Câu  Cá 5A  '), 'Mèo Câu Cá 5A');
  assert.equal(cleanNickname('x'.repeat(30)).length, 16);
  assert.ok(validNickname('a'));
  assert.ok(validNickname('xem www.abc.vn'));
  assert.equal(validNickname('Bé Na'), '');
});

test('submission carries a stable secret key and the best fish', () => {
  const state = newGame();
  state.online.nickname = 'Bé Na';
  state.xp = 450;
  state.stats.correct = 12;
  state.collection = { ro: { count: 2, bestKg: 0.3 }, loc: { count: 1, bestKg: 2 }, chep: { count: 1, bestKg: 1 } };
  const a = buildSubmission(state);
  const b = buildSubmission(state);
  assert.equal(a.p_key, b.p_key);
  assert.match(a.p_key, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...a, p_key: 'k' }, { p_key: 'k', p_nickname: 'Bé Na', p_xp: 450, p_species: 3, p_correct: 12, p_best_fish: 'Cá lóc', p_best_rarity: 2 });
  assert.deepEqual(bestFish(newGame()), { name: null, rarity: 0 });
});

test('submitScore calls the Supabase RPC with the publishable key and stores the rank', async () => {
  const state = newGame();
  let call;
  const fakeFetch = async (url, opts) => { call = { url, opts }; return { ok: true, status: 200, text: async () => '[{"rank":3,"total":40,"xp":120}]' }; };
  assert.equal(await submitScore(state, fakeFetch), null, 'no nickname → nothing sent');
  state.online.nickname = 'Tí';
  state.xp = 120;
  const row = await submitScore(state, fakeFetch);
  assert.equal(row.rank, 3);
  assert.equal(state.online.rank, 3);
  assert.equal(call.url, `${ONLINE.url}/rest/v1/rpc/fishing_submit`);
  assert.equal(call.opts.headers.apikey, ONLINE.key);
  assert.equal(JSON.parse(call.opts.body).p_nickname, 'Tí');
});

test('server errors surface as exceptions; top players parse', async () => {
  const bad = async () => ({ ok: false, status: 400, text: async () => '{"message":"nickname must be 2-16 characters"}' });
  const state = newGame();
  state.online.nickname = 'OK';
  await assert.rejects(submitScore(state, bad), /nickname/);
  const good = async () => ({ ok: true, status: 200, text: async () => '[{"rank":1,"nickname":"A","xp":9}]' });
  assert.equal((await topPlayers(10, good))[0].nickname, 'A');
});

test('every fish species has vector art with unique ids', () => {
  for (const f of FISH) {
    const svg = fishSVG(f.id, { uid: `t${f.id}` });
    assert.match(svg, /^<svg/);
    assert.ok(svg.includes(`t${f.id}b`));
  }
});

// ---------- Dây câu & vật phẩm hỗ trợ ----------
import { buyLine, currentLine } from '../fishing/js/engine.js';

test('fishing lines add durability and can be bought or earned', () => {
  const state = newGame();
  assert.equal(currentLine(state).lives, 2);
  assert.equal(buyLine(state, 'braid').ok, false);
  state.coins = 1000; state.xp = xpForLevel(3);
  assert.ok(buyLine(state, 'braid').ok);
  assert.equal(currentLine(state).lives, 3);
  assert.equal(state.coins, 400);
});

test('tea and golden net are consumed and take effect', () => {
  const state = newGame();
  state.items.tea = 1; state.items.net = 1;
  const a = startCast(state, seeded(3), { useTea: true, useNet: true });
  assert.ok(a.tea && a.net);
  assert.equal(state.items.tea, 0);
  assert.equal(state.items.net, 0);
  const landed = landFish(state, a);
  assert.equal(landed.fish.value, a.value * 2);
  const b = startCast(state, seeded(4), { useTea: true });
  assert.equal(b.tea, false, 'no tea left');
  const calm = createFight({ rarity: 'rare', calm: true });
  const plain = createFight({ rarity: 'rare' });
  assert.ok(calm.strength > plain.strength * 1.5);
});

// ---------- Kỹ năng câu cá ----------
import { useSkill, SKILL_EFFECTS } from '../fishing/js/fight.js';
import { SKILLS, RODS as ALL_RODS } from '../fishing/js/data.js';

test('every rod has a skill with an effect', () => {
  for (const r of ALL_RODS) {
    assert.ok(SKILLS[r.skill], r.id);
    assert.ok(SKILL_EFFECTS[r.skill], r.id);
  }
});

test('skills spend charges, correct answers refill them', () => {
  const f = createFight({ rarity: 'rare', distance: 20, questions: 2 });
  f.tension = 0.9;
  assert.ok(useSkill(f, 'calm'));
  assert.ok(Math.abs(f.tension - 0.45) < 1e-9);
  assert.equal(useSkill(f, 'calm'), false, 'no charges left');
  f.distance = nextMilestone(f);
  answerInFight(f, true);
  assert.equal(f.charges, 1);
  answerInFight(f, false);
  assert.equal(f.charges, 1, 'wrong answers do not refill');
});

test('pulling skills cannot skip a question', () => {
  const f = createFight({ rarity: 'legendary', distance: 20, questions: 3 });
  f.charges = 2;
  useSkill(f, 'dragon');
  useSkill(f, 'dragon');
  assert.ok(f.distance < nextMilestone(f));
  assert.equal(stepFight(f, 0.01, false), 'question');
  assert.equal(f.distance, nextMilestone(f));
});

test('stun stops surges and slows tension', () => {
  const a = createFight({ rarity: 'mythic', kg: 100, distance: 20, questions: 3 });
  const b = createFight({ rarity: 'mythic', kg: 100, distance: 20, questions: 3 });
  useSkill(a, 'gold');
  for (let i = 0; i < 40; i++) { stepFight(a, 0.05, true, () => 0.5); stepFight(b, 0.05, true, () => 0.5); }
  assert.ok(a.tension < b.tension * 0.5);
  assert.equal(a.surge, 0);
});

// ---------- Bộ đề: thủ công & tự động ----------
import {
  parseQuizText, makeClozeQuestions, parseCSV, setToCSV, parsePipeLines, parseAIQuestions,
  reviewToQuestion, addToSet, newSet, normalizeQuestion,
} from '../fishing/js/content.js';

const WORKSHEET = `PHIẾU BÀI TẬP TOÁN 3
Câu 1: 7 × 8 bằng bao nhiêu?
A. 54   B. 56   C. 48   D. 64
Đáp án: B
Câu 2. Số liền sau của 99 là:
A. 98
*B. 100
C. 101
D. 90
Câu 3) Hình vuông có mấy cạnh?
A. 3
B. 4 (đúng)
C. 5
D. 6
Giải thích: Hình vuông có 4 cạnh bằng nhau.
Câu 4: Thủ đô của Việt Nam là
A. Hà Nội
B. Huế
C. Đà Nẵng
D. Cần Thơ
Câu 5: Câu chưa có đáp án
A. x
B. y

ĐÁP ÁN:
4A`;

test('worksheet multiple-choice questions are detected with their answers', () => {
  const r = parseQuizText(WORKSHEET);
  assert.equal(r.length, 5);
  assert.equal(r[0].q, '7 × 8 bằng bao nhiêu?');
  assert.deepEqual(r[0].options, ['54', '56', '48', '64']);
  assert.equal(r[0].correct, 1, 'Đáp án: B');
  assert.equal(r[1].options[r[1].correct], '100', 'star marker');
  assert.equal(r[2].options[r[2].correct], '4', '(đúng) marker');
  assert.equal(r[2].e, 'Hình vuông có 4 cạnh bằng nhau.');
  assert.equal(r[3].options[r[3].correct], 'Hà Nội', 'answer key at the end');
  assert.equal(r[4].correct, null, 'unknown answer left for the teacher');
  const q = reviewToQuestion(r[0]);
  assert.equal(q.a, '56');
  assert.deepEqual(q.w, ['54', '48', '64']);
  assert.equal(reviewToQuestion(r[4]), null);
});

const LESSON = `Chiến thắng Bạch Đằng năm 938 do Ngô Quyền lãnh đạo đã chấm dứt hơn một nghìn năm Bắc thuộc.
Năm 1010, Lý Thái Tổ dời đô từ Hoa Lư ra Thăng Long.
Năm 1288, Trần Hưng Đạo chỉ huy quân dân nhà Trần đánh tan quân Nguyên trên sông Bạch Đằng.
Năm 1789, Quang Trung đại phá quân Thanh ở Ngọc Hồi – Đống Đa.
Quang hợp là quá trình cây xanh dùng ánh sáng để tạo ra chất dinh dưỡng.
Hô hấp là quá trình sinh vật lấy ô-xi và thải ra khí các-bô-níc.
Bay hơi là quá trình nước chuyển từ thể lỏng sang thể khí.
Ngưng tụ là quá trình hơi nước chuyển thành nước ở thể lỏng.`;

test('cloze questions are generated from lesson text with same-kind distractors', () => {
  const qs = makeClozeQuestions(LESSON, { max: 8, rng: seeded(5) });
  assert.ok(qs.length >= 4, `got ${qs.length}`);
  for (const r of qs) {
    assert.ok(r.q.includes('_____'));
    assert.equal(r.options.length, 4);
    assert.equal(new Set(r.options).size, 4);
    assert.ok(r.e.includes(r.options[0]), 'explanation is the full sentence');
    assert.ok(reviewToQuestion(r));
  }
});

test('CSV round trip works with Excel-style separators and quotes', () => {
  const set = newSet('Lịch sử 5');
  addToSet(set, [{ q: 'Năm 938, ai thắng trên sông Bạch Đằng?', a: 'Ngô Quyền', w: ['Lê Lợi', 'Quang Trung', 'Lý Bí'], e: 'Trận Bạch Đằng, 938', d: 2 }]);
  const csv = setToCSV(set);
  const back = parseCSV(csv);
  assert.equal(back.questions.length, 1);
  assert.equal(back.questions[0].a, 'Ngô Quyền');
  assert.equal(back.questions[0].e, 'Trận Bạch Đằng, 938');
  const semi = parseCSV('Câu hỏi;Đáp án đúng;Sai 1;Sai 2;Sai 3\n2+2?;4;3;5;6\nthiếu;;;\n');
  assert.equal(semi.questions.length, 1);
  assert.deepEqual(semi.errors, [3]);
});

test('pipe lines, AI output and duplicates are handled', () => {
  const p = parsePipeLines('# ghi chú\n2+3? | 5 | 4 | 6\nhỏng | chỉ đúng');
  assert.equal(p.questions.length, 1);
  assert.deepEqual(p.errors, [3]);
  const ai = parseAIQuestions({ questions: [
    { question: 'Nước sôi ở bao nhiêu độ?', correct: '100°C', wrong: ['50°C', '80°C', '100°C'], explanation: 'Ở áp suất thường', difficulty: 2 },
    { question: '', correct: 'x', wrong: ['y', 'z'] },
  ] });
  assert.equal(ai.length, 1);
  assert.deepEqual(ai[0].options, ['100°C', '50°C', '80°C']);
  const set = newSet();
  assert.equal(addToSet(set, p.questions), 1);
  assert.equal(addToSet(set, p.questions), 0, 'duplicates skipped');
  assert.equal(normalizeQuestion({ q: 'a', a: 'b', w: ['b'] }), null, 'needs a different wrong answer');
});

test('old custom questions migrate into a question set', () => {
  const s = normalizeState({ custom: [{ q: '2+2?', a: '4', w: ['3', '5'] }] });
  assert.equal(s.sets.length, 1);
  assert.equal(s.sets[0].questions[0].a, '4');
  assert.deepEqual(s.custom, []);
});

test('enabled question sets feed the game at matching difficulty', () => {
  const state = newGame();
  state.settings.subjects = ['custom'];
  state.sets = [
    { id: 's1', name: 'Đề 1', enabled: true, questions: [
      { id: 'a', q: 'Dễ?', a: 'đúng', w: ['sai1', 'sai2', 'sai3'], e: 'vì vậy', d: 1 },
      { id: 'b', q: 'Khó?', a: 'đúng', w: ['sai1', 'sai2', 'sai3'], d: 3 },
    ] },
    { id: 's2', name: 'Tắt', enabled: false, questions: [{ id: 'c', q: 'Không được hỏi', a: 'x', w: ['y'], d: 3 }] },
  ];
  const rng = seeded(8);
  for (let i = 0; i < 20; i++) {
    const q = nextQuestion(state, { difficulty: 3 }, rng);
    if (q.isReview) continue;
    assert.equal(q.text, 'Khó?');
  }
  const easy = nextQuestion(state, { difficulty: 1 }, rng);
  assert.equal(easy.explain, 'vì vậy');
});

import { publishSet, fetchSet, cleanCode } from '../fishing/js/online.js';
import { nextQuestion } from '../fishing/js/engine.js';

test('question sets are shared and fetched by code', async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    const name = url.split('/rpc/')[1];
    const body = name === 'fishing_set_publish' ? '"K7M2QX"' : '[{"code":"K7M2QX","name":"Toán 3","payload":[{"q":"1+1?","a":"2","w":["3","4","5"]}],"question_count":1}]';
    return { ok: true, status: 200, text: async () => body };
  };
  const state = newGame();
  const set = { id: 's', name: 'Toán 3', questions: [{ id: 'x', q: '1+1?', a: '2', w: ['3', '4', '5'], e: '', d: 1 }] };
  assert.equal(await publishSet(state, set, fake), 'K7M2QX');
  assert.equal(set.code, 'K7M2QX');
  assert.equal(calls[0].body.p_payload[0].q, '1+1?');
  assert.ok(!('id' in calls[0].body.p_payload[0]), 'internal ids are not sent');
  await publishSet(state, set, fake);
  assert.equal(calls[1].body.p_code, 'K7M2QX', 'republish updates the same code');
  assert.equal(calls[1].body.p_owner, calls[0].body.p_owner);
  assert.equal(cleanCode(' k7m-2qx '), 'K7M2QX');
  const got = await fetchSet('k7m2qx', fake);
  assert.equal(got.name, 'Toán 3');
  await assert.rejects(fetchSet('abc', fake), /6 ký tự/);
});
