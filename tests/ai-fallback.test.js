import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callGeminiJSON, chatUrl, generateLessonAI, generateQuestionsAI } from '../fishing/js/ai.js';

const cfg = { url: 'https://ai.example.com/v1', key: 'sk-test', model: 'm1' };
const gemOk = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const chatOk = (content) => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) });
const fail = (status, body = '{}') => ({ ok: false, status, text: async () => body });

test('chatUrl: thêm /v1/chat/completions khi cần', () => {
  assert.equal(chatUrl('https://x.io'), 'https://x.io/v1/chat/completions');
  assert.equal(chatUrl('https://x.io/v1/'), 'https://x.io/v1/chat/completions');
  assert.equal(chatUrl('https://x.io/api/v1/chat/completions'), 'https://x.io/api/v1/chat/completions');
});

test('Gemini hết lượt (429) → chuyển ngay sang AI dự phòng, gửi đúng key/model/nội dung', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('generativelanguage')) return fail(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}');
    return chatOk('```json\n{"questions":[{"question":"Q?","correct":"a","wrong":["b","c","d"]}]}\n```');
  };
  const out = await generateQuestionsAI({ apiKey: 'g', source: { text: 'Nội dung bài học' }, fetchImpl, fallback: cfg });
  assert.equal(out.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://ai.example.com/v1/chat/completions');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer sk-test');
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.model, 'm1');
  assert.match(body.messages[1].content, /Nội dung bài học/);
  assert.match(body.messages[0].content, /JSON/);
});

test('Không có Gemini key: dùng fallback truyền vào; thiếu cả hai thì báo lỗi', async () => {
  const fetchImpl = async () => chatOk('{"ok":1}');
  assert.deepEqual(await callGeminiJSON({ apiKey: '', parts: [{ text: 'x' }], schema: {}, fetchImpl, fallback: cfg }), { ok: 1 });
  await assert.rejects(() => callGeminiJSON({ apiKey: '', parts: [{ text: 'x' }], schema: {}, fetchImpl, fallback: null }), /Gemini API key/);
});

test('Sách scan (tệp trên Gemini) không chuyển được sang AI dự phòng', async () => {
  const fetchImpl = async () => fail(429);
  await assert.rejects(() => callGeminiJSON({ apiKey: 'g', parts: [{ text: 'x' }, { fileData: { fileUri: 'f', mimeType: 'application/pdf' } }], schema: {}, fetchImpl, fallback: cfg, retries: 0 }), /hết lượt/);
});

test('Dịch vụ không nhận response_format → tự gửi lại không có nó; Gemini còn lượt thì không gọi dự phòng', async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length === 1) return fail(400, 'unsupported response_format');
    return chatOk('{"a":2}');
  };
  assert.deepEqual(await callGeminiJSON({ apiKey: '', parts: [{ text: 'x' }], schema: {}, fetchImpl, fallback: cfg }), { a: 2 });
  assert.ok(bodies[0].response_format && !bodies[1].response_format);
  let n = 0;
  const g = async () => { n++; return gemOk({ b: 3 }); };
  assert.deepEqual(await callGeminiJSON({ apiKey: 'g', parts: [{ text: 'x' }], schema: {}, fetchImpl: g, fallback: cfg }), { b: 3 });
  assert.equal(n, 1);
});
