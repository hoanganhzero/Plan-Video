import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dmRoom, parseRoom, zoneRoom, classRoom, matchRoom, mergeMessages, chatError, cleanClassCode, CLASS_CODE_RE,
  progressSummary, toCSV, agoLabel, chatApi, teacherApi, adminApi,
} from '../fishing/js/chat.js';
import { newGame, levelFromXp } from '../fishing/js/engine.js';

test('dm room is the same whoever opens it', () => {
  assert.equal(dmRoom('ABCDEF', 'zz1111', 'aa2222'), 'dm:ABCDEF:aa2222:zz1111');
  assert.equal(dmRoom('ABCDEF', 'aa2222', 'zz1111'), dmRoom('ABCDEF', 'zz1111', 'aa2222'));
  assert.deepEqual(parseRoom('dm:ABCDEF:aa2222:zz1111'), { kind: 'dm', code: 'ABCDEF', a: 'aa2222', b: 'zz1111' });
  assert.deepEqual(parseRoom(classRoom('K7PQ2M')), { kind: 'class', id: 'K7PQ2M' });
  assert.equal(zoneRoom('pond'), 'zone:pond');
  assert.equal(matchRoom('XYZ234'), 'match:XYZ234');
});

test('class codes are cleaned and validated', () => {
  assert.equal(cleanClassCode(' k7-pq 2m '), 'K7PQ2M');
  assert.ok(CLASS_CODE_RE.test('K7PQ2M'));
  assert.ok(!CLASS_CODE_RE.test('K7PQ0M')); // không có số 0, O, I, 1
});

test('mergeMessages dedupes, sorts, drops hidden and caps length', () => {
  const a = [{ id: 1, body: 'a' }, { id: 3, body: 'c' }];
  const merged = mergeMessages(a, [{ id: 2, body: 'b' }, { id: 3, body: 'c2' }], [1]);
  assert.deepEqual(merged.map((m) => m.id), [2, 3]);
  assert.equal(merged[1].body, 'c2');
  const many = mergeMessages([], Array.from({ length: 200 }, (_, i) => ({ id: i + 1 })), [], 150);
  assert.equal(many.length, 150);
  assert.equal(many[0].id, 51);
});

test('server errors become friendly Vietnamese messages', () => {
  assert.match(chatError(new Error('slow down')), /chậm lại/);
  assert.match(chatError(new Error('you are muted')), /khoá chat/);
  assert.match(chatError(new Error('not admin')), /quản trị/);
  assert.equal(chatError(new Error('something else')), 'something else');
});

test('progress summary only carries study numbers', () => {
  const s = newGame();
  s.xp = 260; s.coins = 55; s.stats.answered = 10; s.stats.correct = 7; s.stats.catches = 4; s.stats.bestStreak = 3;
  s.stats.catchesByRarity = { legendary: 1, mythic: 1 };
  s.online.nickname = 'An'; s.online.key = 'secret';
  const p = progressSummary(s, levelFromXp);
  assert.equal(p.correct, 7);
  assert.equal(p.wrong, 3);
  assert.equal(p.fish, 4);
  assert.equal(p.legendary, 2);
  assert.equal(p.level, levelFromXp(260));
  assert.ok(!JSON.stringify(p).includes('secret'));
});

test('CSV uses semicolons, quotes and a BOM', () => {
  const csv = toCSV([['Tên', 'Điểm'], ['An; Bình', 'a"b']]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'Tên;Điểm\n"An; Bình";"a""b"');
});

test('agoLabel', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  assert.equal(agoLabel('2026-01-01T09:59:30Z', now), 'vừa xong');
  assert.equal(agoLabel('2026-01-01T09:30:00Z', now), '30 phút trước');
  assert.equal(agoLabel('2025-12-30T10:00:00Z', now), '2 ngày trước');
});

test('API wrappers call the right server functions', async () => {
  const calls = [];
  const f = async (url, opt) => { calls.push([url.split('/').pop(), JSON.parse(opt.body)]); return { ok: true, text: async () => '{"ok":1}' }; };
  await chatApi.send('k', 'zone:pond', 'hi', f);
  await teacherApi.member('t', 'ABCDEF', 'pid123', 'mute', 15, f);
  await adminApi.ban('admin-code-123', 'pid123', 24, 'x', true, f);
  assert.deepEqual(calls.map((c) => c[0]), ['fishing_chat_send', 'fishing_class_member', 'fishing_admin_ban']);
  assert.deepEqual(calls[0][1], { p_player: 'k', p_room: 'zone:pond', p_body: 'hi' });
  assert.equal(calls[1][1].p_minutes, 15);
  assert.equal(calls[2][1].p_purge, true);
});
