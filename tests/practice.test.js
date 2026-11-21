import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../fishing/js/engine.js';
import {
  practiceQuestion, practiceAnswer, startPractice, spendEnergy, rescueOutcome, refundBait,
  ENERGY_MAX, DAILY_COIN_CAP, today,
} from '../fishing/js/practice.js';

function seeded(seed = 7) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const q = (id, answer = 0, extra = {}) => ({ id, text: `Q${id}`, choices: ['a', 'b', 'c', 'd'], answer, subject: 'math', difficulty: 1, ...extra });

test('practice prefers the review notebook, weakest card first', () => {
  const s = newGame();
  s.review = [q('r1', 0, { mastery: 2 }), q('r2', 1, { mastery: 0 })];
  const rng = seeded(3);
  let fromReview = 0;
  for (let i = 0; i < 40; i++) {
    const x = practiceQuestion(s, rng);
    if (x.isReview) { fromReview += 1; assert.equal(x.id, 'r2'); assert.equal(x.choices[x.answer], 'b'); }
  }
  assert.ok(fromReview > 20);
  s.review = [];
  const y = practiceQuestion(s, rng);
  assert.ok(y.text && y.choices.length >= 2 && !y.isReview);
});

test('streaks of right answers give coins, skill energy and bait', () => {
  const s = newGame();
  s.coins = 0; s.items.shrimp = 0; s.items.golden = 0;
  startPractice(s);
  let energy = 0;
  for (let i = 1; i <= 10; i++) {
    const r = practiceAnswer(s, q(`p${i}`), 0);
    assert.ok(r.correct && r.coins > 0);
    energy += r.energy;
  }
  assert.equal(energy, ENERGY_MAX);           // chuỗi 3, 6, 9 → 3 năng lượng (tối đa 3)
  assert.equal(s.skillEnergy, ENERGY_MAX);
  assert.equal(s.items.shrimp, 1);            // chuỗi 5
  assert.equal(s.items.golden, 1);            // chuỗi 10
  assert.equal(s.practice.best, 10);
  const wrong = practiceAnswer(s, q('w1'), 2);
  assert.equal(wrong.correct, false);
  assert.equal(s.practice.streak, 0);
  assert.equal(s.review[0].id, 'w1');         // câu sai vào sổ ôn
});

test('coins from practice are capped per day and reset the next day', () => {
  const s = newGame();
  const day1 = new Date(2026, 4, 1, 9);
  startPractice(s, day1);
  let total = 0;
  for (let i = 0; i < 100; i++) total += practiceAnswer(s, q(`c${i}`, 0, { difficulty: 3 }), 0, day1).coins;
  assert.equal(total, DAILY_COIN_CAP);
  const last = practiceAnswer(s, q('cx', 0), 0, day1);
  assert.equal(last.coins, 0);
  assert.ok(last.capped);
  const next = practiceAnswer(s, q('cy', 0), 0, new Date(2026, 4, 2, 9));
  assert.ok(next.coins > 0);
  assert.equal(s.practice.day, today(new Date(2026, 4, 2, 9)));
});

test('three right answers in a row master a review card', () => {
  const s = newGame();
  s.review = [q('m1', 2, { mastery: 0 })];
  for (let i = 0; i < 2; i++) assert.equal(practiceAnswer(s, { ...s.review[0], isReview: true }, 2).mastered, false);
  const r = practiceAnswer(s, { ...s.review[0], isReview: true }, 2);
  assert.equal(r.mastered, true);
  assert.equal(s.review.length, 0);
});

test('skill energy refills an empty skill only', () => {
  const s = newGame();
  s.skillEnergy = 1;
  const fight = { charges: 1 };
  assert.equal(spendEnergy(s, fight), false);
  fight.charges = 0;
  assert.equal(spendEnergy(s, fight), true);
  assert.equal(fight.charges, 1);
  assert.equal(s.skillEnergy, 0);
  fight.charges = 0;
  assert.equal(spendEnergy(s, fight), false);
});

test('rescue outcomes and bait refund', () => {
  assert.equal(rescueOutcome(3), 'catch');
  assert.equal(rescueOutcome(2), 'bait');
  assert.equal(rescueOutcome(1), 'none');
  const s = newGame();
  const before = s.items.shrimp;
  assert.equal(refundBait(s, 'shrimp'), true);
  assert.equal(s.items.shrimp, before + 1);
  assert.equal(refundBait(s, 'worm'), false);
});

import { subjectsForGrade, normalizeGrade, cleanSubjects, mathLevel, GRADE_LIST } from '../fishing/js/curriculum.js';
import { pickQuestion, bankQuestions, mathQuestion } from '../fishing/js/questions.js';
import { normalizeState } from '../fishing/js/engine.js';

test('curriculum covers grades 1–12 with enough questions for every subject', () => {
  assert.deepEqual(GRADE_LIST, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(subjectsForGrade(1).includes('nature') && !subjectsForGrade(1).includes('phy'));
  assert.ok(subjectsForGrade(11).includes('chem') && subjectsForGrade(11).includes('ktpl'));
  for (const g of GRADE_LIST) {
    for (const s of subjectsForGrade(g)) {
      if (s !== 'math') assert.ok(bankQuestions(s, g).length >= 5, `lớp ${g} môn ${s}`);
    }
  }
});

test('questions follow the grade', () => {
  const rng = seeded(4);
  for (let i = 0; i < 60; i++) {
    const q = pickQuestion(1 + (i % 3), { subjects: ['phy'], grade: 11 }, rng);
    assert.equal(q.subject, 'phy');
    assert.equal(q.choices.length, 4);
    assert.equal(typeof q.choices[q.answer], 'string');
  }
  // Lớp 1 không gặp câu Vật lí lớp 10–12 dù môn được chọn sai
  assert.equal(bankQuestions('phy', 1).length, 0);
  const q1 = pickQuestion(2, { subjects: ['nature'], grade: 2 }, rng);
  assert.equal(q1.subject, 'nature');
});

test('math difficulty grows with the grade, and generated answers are right', () => {
  assert.ok(mathLevel(1, 3) < mathLevel(6, 1) && mathLevel(6, 3) < mathLevel(12, 2));
  const rng = seeded(11);
  for (let L = 1; L <= 8; L++) {
    for (let i = 0; i < 30; i++) {
      const q = mathQuestion(L, rng);
      assert.equal(new Set(q.choices).size, 4, `${L}: ${q.text}`);
      assert.ok(q.answer >= 0);
    }
  }
});

test('old grade groups and subject lists are migrated', () => {
  assert.equal(normalizeGrade('g3'), 4);
  assert.equal(normalizeGrade(15), 12);
  assert.deepEqual(cleanSubjects(['math', 'phy', 'custom'], 3), ['math', 'custom']);
  assert.deepEqual(cleanSubjects(['phy'], 3), subjectsForGrade(3));
  const s = normalizeState({ settings: { grade: 'g1', subjects: ['math', 'custom'] } });
  assert.equal(s.settings.grade, 2);
  assert.ok(s.settings.subjects.includes('nature') && s.settings.subjects.includes('custom'));
});

import { totalLuck, startCast, landFish, sellFish, buyBucket, bucketCap, buyShopItem } from '../fishing/js/engine.js';
import { ITEMS, BAITS, BUCKETS, RODS, SKILLS } from '../fishing/js/data.js';
import { SKILL_EFFECTS, useSkill } from '../fishing/js/fight.js';

test('every bait, rod and skill is complete', () => {
  assert.ok(BAITS.length >= 9 && BAITS[0] === 'worm');
  assert.ok(RODS.length >= 10);
  for (const r of RODS) { assert.ok(SKILLS[r.skill], r.id); assert.ok(SKILL_EFFECTS[r.skill], r.skill); }
  assert.equal(BUCKETS[0].cap, 15);
});

test('baits add luck, more in their favourite zone, and bigger fish', () => {
  const s = newGame();
  s.items.squid = 5; s.bait = 'squid';
  s.zone = 'pond';
  const pond = totalLuck(s);
  s.zone = 'sea';
  assert.equal(totalLuck(s), pond + ITEMS.squid.zones.sea);
  const m = newGame();
  m.items.minnow = 50; m.bait = 'minnow';
  const plain = newGame();
  let a = 0; let b = 0;
  for (let i = 0; i < 40; i++) {
    a += startCast(m, seeded(i + 1)).kg;
    b += startCast(plain, seeded(i + 1)).kg;
  }
  assert.ok(a > b * 1.2, `${a} vs ${b}`);
  assert.equal(m.items.minnow, 10);
});

test('a full bucket sells new fish automatically; better buckets pay more', () => {
  const s = newGame();
  const att = (v) => ({ fishId: 'ro', rarity: 'common', kg: 0.3, value: v, zone: 'pond' });
  for (let i = 0; i < bucketCap(s); i++) landFish(s, att(10));
  assert.equal(s.bucket.length, 15);
  const coins = s.coins;
  const r = landFish(s, att(10));
  assert.equal(r.autoSold, 10);
  assert.equal(s.bucket.length, 15);
  assert.equal(s.coins, coins + 10);
  // Thùng giữ lạnh: +10% giá bán
  s.xp = 999999; s.coins = 100000;
  assert.ok(buyBucket(s, 'cooler').ok);
  assert.equal(bucketCap(s), 60);
  const sold = sellFish(s, [s.bucket[0].uid]);
  assert.equal(sold.coins, 11);
  assert.equal(buyBucket(s, 'cooler').ok, false);
  assert.ok(buyShopItem(s, 'rainbow3').ok);
  assert.equal(s.items.rainbow, 3);
});

test('new rod skills heal the line', () => {
  const f = { charges: 1, tension: 0.9, distance: 10, start: 10, stun: 0, surge: 1, lives: 1, maxLives: 3, done: false };
  assert.ok(useSkill(f, 'jade'));
  assert.equal(f.lives, 2);
  assert.ok(f.tension < 0.5);
});
