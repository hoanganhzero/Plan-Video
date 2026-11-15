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
