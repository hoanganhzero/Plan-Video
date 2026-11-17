import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  knownServers, rememberServer, forgetServer, activeWorld, setActiveWorld, slotKey, applyServerIdentity,
  serverSnapshot, isNewer, parseNames, serverApi,
} from '../fishing/js/servers.js';
import { newGame, normalizeState, SAVE_KEY } from '../fishing/js/engine.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

test('servers are remembered, switched and forgotten', () => {
  const s = memoryStorage();
  assert.equal(activeWorld(s), null);
  rememberServer(s, { code: 'K7PQ2M', name: '5A', nick: 'An', key: 'k1', pid: 'sabc' });
  rememberServer(s, { code: 'H4XN8R', name: '5B', nick: 'An', key: 'k2', pid: 'sdef' });
  assert.deepEqual(knownServers(s).map((x) => x.code), ['H4XN8R', 'K7PQ2M']);
  setActiveWorld(s, 'K7PQ2M');
  assert.equal(activeWorld(s), 'K7PQ2M');
  s.setItem(slotKey('K7PQ2M'), '{}');
  forgetServer(s, 'K7PQ2M');
  assert.equal(activeWorld(s), null);
  assert.equal(s.getItem(slotKey('K7PQ2M')), null);
  setActiveWorld(s, 'ZZZZZZ'); // không có tài khoản → về thế giới cá nhân
  assert.equal(activeWorld(s), null);
  assert.equal(slotKey(null), SAVE_KEY);
});

test('server identity is applied on load and stripped before upload', () => {
  const st = applyServerIdentity(normalizeState({ xp: 99, online: { key: 'personal-secret', nickname: 'Cá nhân' }, cloud: { code: 'X' } }),
    { code: 'K7PQ2M', name: '5A', nick: 'An', key: 'acc-secret', pid: 'sabc' });
  assert.equal(st.online.key, 'acc-secret');
  assert.equal(st.online.nickname, 'An');
  assert.equal(st.chat.classCode, 'K7PQ2M');
  assert.equal(st.cloud, undefined);
  assert.equal(st.xp, 99);
  st.serverSavedAt = '2026-01-01T00:00:00Z';
  const snap = serverSnapshot(st);
  assert.equal(snap.online.key, null);
  assert.equal(snap.server, undefined);
  assert.equal(snap.serverSavedAt, undefined);
  assert.ok(!JSON.stringify(snap).includes('acc-secret'));
  assert.equal(snap.xp, 99);
});

test('isNewer compares save times', () => {
  assert.equal(isNewer('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'), true);
  assert.equal(isNewer('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'), false);
  assert.equal(isNewer('2026-01-01T00:00:00Z', null), true);
  assert.equal(isNewer(null, '2026-01-01T00:00:00Z'), false);
});

test('parseNames reads pasted class lists', () => {
  assert.deepEqual(parseNames('1. Nguyễn An\n2) Trần Bình\n\nan\nLê Chi; Phạm Dũng\tX'), ['Nguyễn An', 'Trần Bình', 'an', 'Lê Chi', 'Phạm Dũng']);
  assert.equal(parseNames('Một cái tên rất rất dài quá mức')[0].length, 16);
});

test('server API calls the right functions', async () => {
  const calls = [];
  const f = async (url, opt) => { calls.push([url.split('/').pop(), JSON.parse(opt.body)]); return { ok: true, text: async () => 'null' }; };
  await serverApi.enter(' k7pq-2m ', 'An', 1234, f);
  await serverApi.addStudents('t', 'K7PQ2M', ['An', 'Bình'], f);
  await serverApi.config('t', 'K7PQ2M', { allowJoin: false }, f);
  assert.deepEqual(calls.map((c) => c[0]), ['fishing_server_enter', 'fishing_server_add_students', 'fishing_server_config']);
  assert.deepEqual(calls[0][1], { p_code: 'K7PQ2M', p_name: 'An', p_pin: '1234' });
  assert.equal(calls[2][1].p_allow_join, false);
  assert.equal(calls[2][1].p_description, null);
});

import { getAccount, setAccount, logoutAccount, accountSnapshot, USERNAME_RE, cleanUsername, accountApi, ACCOUNT_KEY } from '../fishing/js/servers.js';

test('account is stored, and logout wipes the account data from a shared computer', () => {
  const s = memoryStorage();
  assert.equal(getAccount(s), null);
  setAccount(s, { key: 'acc-key', username: 'an.5a', nickname: 'An', servers: [1, 2] });
  assert.deepEqual(getAccount(s), { key: 'acc-key', username: 'an.5a', nickname: 'An' });
  rememberServer(s, { code: 'K7PQ2M', name: '5A', nick: 'An', key: 'k1', pid: 'sabc' });
  s.setItem(slotKey('K7PQ2M'), '{"xp":5}');
  setActiveWorld(s, 'K7PQ2M');
  s.setItem(SAVE_KEY, JSON.stringify({ xp: 9, account: 'an.5a' }));
  logoutAccount(s);
  assert.equal(getAccount(s), null);
  assert.equal(s.getItem(ACCOUNT_KEY), null);
  assert.deepEqual(knownServers(s), []);
  assert.equal(s.getItem(slotKey('K7PQ2M')), null);
  assert.equal(activeWorld(s), null);
  assert.equal(s.getItem(SAVE_KEY), null); // thế giới cá nhân của tài khoản (đã lưu trên mạng)
});

test('logout keeps a personal world that does not belong to the account', () => {
  const s = memoryStorage();
  setAccount(s, { key: 'k', username: 'an.5a', nickname: 'An' });
  s.setItem(SAVE_KEY, JSON.stringify({ xp: 9 }));
  logoutAccount(s);
  assert.ok(s.getItem(SAVE_KEY));
});

test('usernames and account snapshots', () => {
  assert.equal(cleanUsername('  An.5A '), 'an.5a');
  assert.ok(USERNAME_RE.test('an.5a') && USERNAME_RE.test('binh_2015'));
  assert.ok(!USERNAME_RE.test('ab') && !USERNAME_RE.test('an 5a') && !USERNAME_RE.test('ân'));
  const snap = accountSnapshot({ xp: 3, accountSavedAt: 'x', cloud: { code: 'c' }, online: { key: 'secret', ownerKey: 'o', nickname: 'An' } });
  assert.equal(snap.accountSavedAt, undefined);
  assert.equal(snap.cloud, undefined);
  assert.equal(snap.online.key, null);
  assert.equal(snap.online.ownerKey, null);
  assert.equal(snap.online.nickname, 'An');
});

test('account and join API calls', async () => {
  const calls = [];
  const f = async (url, opt) => { calls.push([url.split('/').pop(), JSON.parse(opt.body)]); return { ok: true, text: async () => 'null' }; };
  await accountApi.login(' An.5A ', 1234, f);
  await serverApi.join('acc', 'k7pq2m', null, f);
  await serverApi.join('acc', 'K7PQ2M', 2468, f);
  await serverApi.access('t', 'K7PQ2M', 'pin', '2468', f);
  assert.deepEqual(calls.map((c) => c[0]), ['fishing_account_login', 'fishing_server_join', 'fishing_server_join', 'fishing_server_access']);
  assert.deepEqual(calls[0][1], { p_username: 'an.5a', p_pin: '1234' });
  assert.equal(calls[1][1].p_server_pin, null);
  assert.equal(calls[2][1].p_server_pin, '2468');
  assert.equal(calls[3][1].p_access, 'pin');
});
