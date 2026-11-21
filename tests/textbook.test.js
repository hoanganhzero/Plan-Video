import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitLessons, guessHeadingKind, keyPoints, offlineQuestions, tagWithLesson, activeQuestions, reviewNote, singleLesson,
} from '../fishing/js/textbook.js';
import { newSet, addToSet, reviewToQuestion, normalizeQuestion } from '../fishing/js/content.js';
import { parseLessonAI, buildLessonPrompt, findLessonsAI, generateLessonAI } from '../fishing/js/ai.js';
import { pickQuestion } from '../fishing/js/questions.js';
import { publishSet } from '../fishing/js/online.js';

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const BODY1 = `Nước là chất lỏng không màu, không mùi, không vị.
Nước sôi ở 100 °C và đông đặc ở 0 °C.
Hãy quan sát hình 1 và trả lời câu hỏi.
Ghi nhớ: Nước tồn tại ở ba thể là rắn, lỏng và khí.`;
const BODY2 = `Không khí là hỗn hợp nhiều chất khí, trong đó khí ni-tơ chiếm khoảng 78%.
Khí ô-xi chiếm khoảng 21% và cần cho sự cháy.
Gió là không khí chuyển động.`;
const BODY3 = `Ánh sáng truyền theo đường thẳng.
Mặt Trời là nguồn sáng tự nhiên lớn nhất.
Bóng tối là phần phía sau vật cản sáng.`;
const PAGES = [
  'MỤC LỤC\nBài 1. Nước ......... 5\nBài 2. Không khí ...... 9\nBài 3. Ánh sáng ....... 13\nBài 4. Âm thanh ....... 17',
  `Bài 1. Nước và tính chất của nước\n${BODY1}`,
  `Bài 1. Nước và tính chất của nước\nNước hoà tan được nhiều chất như muối, đường.`,
  `BÀI 2\nKhông khí quanh ta\n${BODY2}`,
  `Bài 3: Ánh sáng\n${BODY3}`,
];

test('chia sách thành bài: bỏ mục lục, gộp tiêu đề lặp đầu trang, lấy tên bài ở dòng sau', () => {
  assert.equal(guessHeadingKind(PAGES), 'bai');
  const ls = splitLessons(PAGES);
  assert.deepEqual(ls.map((l) => l.title), ['Bài 1. Nước và tính chất của nước', 'Bài 2. Không khí quanh ta', 'Bài 3. Ánh sáng']);
  assert.deepEqual(ls.map((l) => [l.from, l.to]), [[2, 3], [4, 4], [5, 5]]);
  assert.match(ls[0].text, /hoà tan/);
  assert.doesNotMatch(ls[0].text, /Bài 1/);
  assert.ok(ls.every((l) => l.on && l.id));
});

test('chia bài theo Unit (Tiếng Anh) và theo chủ đề khi không có "Bài"', () => {
  const en = splitLessons(['Unit 1: My friends\nHello. This is my friend Mai. She is nine years old and lives in Ha Noi.', 'Unit 2 – Time\nWhat time is it? It is seven o\'clock in the morning, time to go to school.']);
  assert.deepEqual(en.map((l) => l.title), ['Unit 1. My friends', 'Unit 2. Time']);
  const cd = splitLessons('Chủ đề 1. Gia đình\nGia đình là nơi em được yêu thương và chăm sóc mỗi ngày.\nChủ đề 2. Trường học\nTrường học là nơi em học tập và vui chơi cùng bạn bè.');
  assert.equal(cd.length, 2);
  assert.equal(splitLessons('Không có tiêu đề nào ở đây cả.').length, 0);
});

test('nội dung trọng tâm: ưu tiên định nghĩa, ghi nhớ; bỏ câu bài tập / câu hỏi', () => {
  const k = keyPoints(BODY1 + '\nEm hãy kể tên ba thể của nước?');
  assert.ok(k.some((s) => /ba thể là rắn, lỏng và khí/.test(s)));
  assert.ok(k.some((s) => /Nước là chất lỏng/.test(s)));
  assert.ok(!k.some((s) => /quan sát|kể tên/.test(s)));
});

test('tạo câu hỏi không cần AI theo các dạng: đúng/sai, điền khuyết, phát biểu đúng / không đúng', () => {
  const text = [BODY1, BODY2, BODY3, 'Muối là chất tan trong nước.', 'Đường là chất có vị ngọt.', 'Sắt là kim loại bị nam châm hút.'].join('\n');
  const lesson = { ...singleLesson(text, 'Bài 1. Thử'), key: keyPoints(text) };
  const qs = offlineQuestions(lesson, { types: ['tf', 'cloze', 'mcq', 'neg', 'apply'], count: 8, rng: seeded(3) });
  assert.ok(qs.length >= 4);
  const types = new Set(qs.map((q) => q.t));
  assert.ok(types.has('tf') && types.has('cloze'));
  assert.ok(!types.has('apply'), 'dạng vận dụng chỉ AI làm');
  for (const q of qs) {
    assert.ok(q.r && q.r.length > 10, 'mỗi câu có nội dung liên quan');
    assert.ok(q.correct !== null && q.options[q.correct]);
    if (q.t === 'tf') assert.deepEqual(q.options, ['Đúng', 'Sai']);
  }
  const mcq = qs.find((q) => q.t === 'mcq' || q.t === 'neg');
  if (mcq) assert.equal(new Set(mcq.options).size, mcq.options.length);
});

test('câu SGK lưu vào bộ đề giữ dạng câu, bài, nội dung liên quan; câu "phát biểu nào đúng" không bị coi là trùng', () => {
  const set = newSet('SGK', { book: { lessons: [{ id: 'L1', title: 'Bài 1', on: true }, { id: 'L2', title: 'Bài 2', on: false }] } });
  const r1 = tagWithLesson([{ q: 'Phát biểu nào sau đây ĐÚNG?', options: ['A đúng', 'B', 'C', 'D'], correct: 0, t: 'mcq', r: 'A đúng vì…' }], set.book.lessons[0]);
  const r2 = tagWithLesson([{ q: 'Phát biểu nào sau đây ĐÚNG?', options: ['X đúng', 'Y', 'Z', 'W'], correct: 0, t: 'mcq' },
    { q: 'Đúng hay sai: "Nước sôi ở 100 °C"', options: ['Đúng', 'Sai'], correct: 0, t: 'tf', e: 'Nước sôi ở 100 °C.' }], set.book.lessons[1]);
  const added = addToSet(set, [...r1, ...r2].map(reviewToQuestion));
  assert.equal(added, 3);
  const q = set.questions[0];
  assert.equal(q.t, 'mcq'); assert.equal(q.lid, 'L1'); assert.equal(q.l, 'Bài 1'); assert.equal(q.r, 'A đúng vì…');
  assert.equal(set.questions[2].r, 'Nước sôi ở 100 °C.', 'không có ref thì dùng lời giải thích');
  // Chỉ câu của bài đang bật mới đến với học sinh
  assert.deepEqual(activeQuestions(set).map((x) => x.lid), ['L1']);
  assert.equal(normalizeQuestion({ q: 'a', a: 'Đúng', w: ['Sai'], t: 'tf' }).w.length, 1);
});

test('trò chơi: câu Đúng/Sai giữ thứ tự, câu SGK mang theo bài + nội dung xem lại', () => {
  const custom = [{ id: 'x', q: 'Đúng hay sai: "Gió là không khí chuyển động"', a: 'Sai', w: ['Đúng'], d: 1, t: 'tf', l: 'Bài 2. Không khí', r: 'Gió là không khí chuyển động.' }];
  for (let i = 0; i < 5; i++) {
    const q = pickQuestion(1, { subjects: ['custom'], custom }, seeded(i + 1));
    assert.deepEqual(q.choices, ['Đúng', 'Sai']);
    assert.equal(q.answer, 1);
    assert.deepEqual(reviewNote(q), { lesson: 'Bài 2. Không khí', ref: 'Gió là không khí chuyển động.' });
  }
  assert.equal(reviewNote({ explain: 'x' }), null);
});

test('chia sẻ bộ đề sách: chỉ gửi bài đang bật, kèm t / l / r', async () => {
  const set = newSet('SGK', { book: { lessons: [{ id: 'L1', title: 'Bài 1', on: true }, { id: 'L2', title: 'Bài 2', on: false }] } });
  addToSet(set, [{ q: 'Câu 1', a: 'A', w: ['B'], t: 'tf', lid: 'L1', l: 'Bài 1', r: 'Nội dung 1' }, { q: 'Câu 2', a: 'A', w: ['B'], lid: 'L2', l: 'Bài 2' }]);
  let sent;
  const fetchImpl = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, text: async () => '"ABCDEF"', json: async () => 'ABCDEF' }; };
  const code = await publishSet({ online: { ownerKey: '00000000-0000-4000-8000-000000000001' } }, set, fetchImpl);
  assert.equal(code, 'ABCDEF');
  assert.equal(sent.p_payload.length, 1);
  assert.deepEqual(sent.p_payload[0], { q: 'Câu 1', a: 'A', w: ['B'], e: '', d: 1, t: 'tf', l: 'Bài 1', r: 'Nội dung 1' });
  set.book.lessons[0].on = false;
  await assert.rejects(() => publishSet({ online: { ownerKey: 'k' } }, set, fetchImpl), /bài đang bật/);
});

test('AI: kiểm tra dữ liệu trả về theo dạng câu; Đúng/Sai chuẩn hoá', () => {
  const out = parseLessonAI({
    key_points: ['Nước có ba thể.', 'x'],
    questions: [
      { type: 'tf', question: 'Nước sôi ở 50 °C', correct: 'sai', wrong: [], ref: 'Nước sôi ở 100 °C.' },
      { type: 'apply', question: 'Phơi quần áo nhanh khô khi nào?', correct: 'Trời nắng có gió', wrong: ['Trời mưa', 'Ban đêm ẩm', 'Trong tủ kín'], difficulty: 3 },
      { type: 'mcq', question: 'Thiếu đáp án sai', correct: 'A', wrong: ['A'] },
      { type: 'tf', question: 'Mơ hồ', correct: 'có thể' },
    ],
  }, ['tf', 'apply']);
  assert.deepEqual(out.key, ['Nước có ba thể.']);
  assert.equal(out.questions.length, 2);
  assert.deepEqual(out.questions[0].options, ['Đúng', 'Sai']);
  assert.equal(out.questions[0].correct, 1);
  assert.match(out.questions[0].q, /^Đúng hay sai: "Nước sôi ở 50 °C"$/);
  assert.equal(out.questions[1].t, 'apply');
  assert.equal(out.questions[1].d, 3);
  const p = buildLessonPrompt({ title: 'Bài 1', count: 10, types: ['mcq', 'tf', 'apply'], grade: 'lớp 5', subject: 'Khoa học' });
  assert.match(p, /mcq: 4 câu, tf: 3 câu, apply: 3 câu/);
  assert.match(p, /"ref"/);
});

test('AI: tạo câu theo bài (gửi nội dung bài) và tìm bài trong sách scan (gửi tệp)', async () => {
  const calls = [];
  const reply = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (body.generationConfig.responseSchema.properties.lessons) return reply({ lessons: [{ title: 'Bài 1. A', from_page: 3, to_page: 9 }, { title: 'Bài 2. B', from_page: 6, to_page: 12 }] });
    return reply({ key_points: ['Ý chính.'], questions: [{ type: 'mcq', question: 'Q?', correct: 'a', wrong: ['b', 'c', 'd'], ref: 'đoạn' }] });
  };
  const r = await generateLessonAI({ apiKey: 'k', lesson: { title: 'Bài 1', text: 'Nội dung bài' }, options: { types: ['mcq'], count: 1 }, fetchImpl });
  assert.equal(r.questions[0].r, 'đoạn');
  assert.match(calls[0].contents[0].parts[1].text, /Nội dung bài/);
  const ls = await findLessonsAI({ apiKey: 'k', file: { uri: 'files/abc', mimeType: 'application/pdf' }, fetchImpl });
  assert.deepEqual(ls.map((l) => [l.from, l.to]), [[3, 5], [6, 12]]);
  assert.equal(calls[1].contents[0].parts[1].fileData.fileUri, 'files/abc');
});
