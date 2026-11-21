// Sách giáo khoa → bài học → nội dung trọng tâm → câu hỏi theo dạng.
// Thuần logic (không DOM) để kiểm thử. Dùng cho trang thầy cô: "📖 Sách giáo khoa".
//
// Bài học: { id, title, from, to, text, key: [câu trọng tâm], on: true }
// Câu hỏi bộ đề có thêm: t (dạng câu), lid (mã bài), l (tên bài), r (nội dung liên quan – hiện khi học sinh trả lời sai).
import { newId, makeClozeQuestions, splitSentences } from './content.js';

export const QTYPES = {
  mcq: { name: 'Trắc nghiệm 4 đáp án', icon: '🔤', ai: false },
  tf: { name: 'Đúng / Sai', icon: '⚖️', ai: false },
  cloze: { name: 'Điền vào chỗ trống', icon: '✂️', ai: false },
  neg: { name: 'Chọn ý KHÔNG đúng', icon: '🚫', ai: false },
  apply: { name: 'Vận dụng – tình huống', icon: '💡', ai: true },
};
export const TF = ['Đúng', 'Sai'];
export const MAX_BOOK_QUESTIONS = 3000;
export const MAX_REF = 400;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// 1. Chia sách thành bài
// ---------------------------------------------------------------------------
export const HEADING_KINDS = {
  bai: { label: 'Bài', re: 'B[àaÀA]i|BÀI' },
  tiet: { label: 'Tiết', re: 'Ti[ếe]t|TIẾT' },
  unit: { label: 'Unit / Lesson', re: 'Unit|UNIT|Lesson|LESSON' },
  chude: { label: 'Chủ đề', re: 'Ch[ủu]\\s*đề|CHỦ\\s*ĐỀ' },
  chuong: { label: 'Chương', re: 'Ch[ươ]+ng|CHƯƠNG' },
  tuan: { label: 'Tuần', re: 'Tu[ầa]n|TUẦN' },
};
const LESSON_LEVEL = ['bai', 'unit', 'tiet', 'tuan', 'chude', 'chuong']; // ưu tiên cấp "bài" trước cấp "chương"

const headingRe = (kind) => new RegExp(`^\\s*(?:${HEADING_KINDS[kind].re})\\s+(\\d{1,3}|[IVXLC]{1,6})(?![\\d/,])\\s*[.:–\\-)]?\\s*(.*)$`, 'u');
const TOC_LINE = /(\.{3,}|…{2,}|_{3,})|\s{2,}\d{1,3}\s*$/;

function matchHeading(line, kind) {
  if (line.length > 140 || TOC_LINE.test(line)) return null;
  const m = line.match(headingRe(kind));
  if (!m) return null;
  return { num: m[1].toUpperCase(), rest: clean(m[2]) };
}

// Trang có từ 4 tiêu đề trở lên gần như chắc chắn là Mục lục → bỏ qua.
function isTocPage(lines, kind) {
  return lines.filter((l) => matchHeading(l, kind)).length >= 4;
}

// Đoán kiểu tiêu đề dùng để chia bài (nhiều tiêu đề nhất, ưu tiên cấp "bài").
export function guessHeadingKind(pages) {
  const counts = {};
  for (const kind of Object.keys(HEADING_KINDS)) {
    const nums = new Set();
    for (const page of pages) {
      const lines = page.split('\n');
      if (isTocPage(lines, kind)) continue;
      for (const l of lines) { const h = matchHeading(l, kind); if (h) nums.add(h.num); }
    }
    counts[kind] = nums.size;
  }
  return LESSON_LEVEL.find((k) => counts[k] >= 2) || LESSON_LEVEL.find((k) => counts[k] >= 1) || null;
}

// pages: mảng chữ từng trang (hoặc một chuỗi – coi như 1 trang). Trả về các bài theo thứ tự trong sách.
export function splitLessons(input, { kind = null } = {}) {
  const pages = Array.isArray(input) ? input.map(String) : [String(input || '')];
  const k = kind || guessHeadingKind(pages);
  if (!k) return [];
  const label = HEADING_KINDS[k].label.split(' ')[0];
  const lessons = [];
  let cur = null;
  pages.forEach((page, pi) => {
    const lines = page.split('\n').map((l) => l.trim());
    if (isTocPage(lines, k)) return;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const h = matchHeading(line, k);
      if (h) {
        // Tiêu đề lặp lại ở đầu mỗi trang của cùng một bài → không phải bài mới.
        if (cur && cur.num === h.num) { continue; }
        let rest = h.rest;
        if (!rest) { const next = lines.slice(i + 1).find((x) => x && !matchHeading(x, k)); if (next && next.length <= 90) { rest = clean(next); i = lines.indexOf(next, i + 1); } }
        cur = { id: newId('ls'), num: h.num, title: clean(`${label} ${h.num}${rest ? `. ${rest}` : ''}`).slice(0, 120), from: pi + 1, to: pi + 1, lines: [], on: true };
        lessons.push(cur);
        continue;
      }
      if (cur) { cur.lines.push(line); cur.to = pi + 1; }
    }
  });
  return lessons
    .map(({ lines, num, ...l }) => ({ ...l, text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((l) => l.text.replace(/\s/g, '').length >= 40);
}

// Bài thủ công: toàn bộ nội dung là một bài (dán chữ, không có tiêu đề).
export function singleLesson(text, title = 'Bài học') {
  return { id: newId('ls'), title: clean(title) || 'Bài học', from: 1, to: 1, text: String(text || '').trim(), on: true };
}

// ---------------------------------------------------------------------------
// 2. Nội dung trọng tâm (không cần mạng)
// ---------------------------------------------------------------------------
const MEMO_HEAD = /^(ghi nhớ|em cần nhớ|cần nhớ|kết luận|lưu ý|tóm tắt|kiến thức (?:cần nhớ|trọng tâm)|điều (?:em )?cần (?:nhớ|biết)|remember|note)(?![\p{L}\p{N}])/iu;
const DEF = /\s(?:là|được gọi là|gọi là|có nghĩa là|nghĩa là|bao gồm|gồm có|có vai trò|có tác dụng)\s/i;
const EXERCISE = /^(?:\d+[.)]\s*)?(?:em hãy|hãy|tính|quan sát|đọc|viết|trả lời|thảo luận|vẽ|kể|làm|giải|chọn|nối|điền|tìm|so sánh|nêu|cho biết|em có|luyện tập|vận dụng|hoạt động|khám phá|thực hành|câu hỏi|bài tập|ví dụ|listen|read|write|look|work|talk|answer|match|complete)(?![\p{L}\p{N}])/iu;

export function keyPoints(text, max = 6) {
  const lines = String(text || '').split('\n').map((l) => l.trim());
  const memo = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!MEMO_HEAD.test(lines[i])) continue;
    const after = lines[i].replace(MEMO_HEAD, '').replace(/^[\s:：\-–]+/, '');
    if (after.length > 20) memo.add(clean(after));
    for (let j = i + 1; j < lines.length && j <= i + 8 && lines[j]; j++) memo.add(clean(lines[j]));
  }
  const sentences = splitSentences(text);
  const scored = sentences.map((s, i) => {
    let score = 0;
    if ([...memo].some((m) => m.includes(s) || s.includes(m))) score += 4;
    if (DEF.test(` ${s} `)) score += 3;
    if (/\d/.test(s)) score += 1;
    if (s.length >= 40 && s.length <= 200) score += 1;
    if (/\?\s*$/.test(s) || EXERCISE.test(s)) score -= 6;
    return { s, i, score };
  }).filter((x) => x.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i)
    .map((x) => x.s.replace(MEMO_HEAD, '').replace(/^\s*[:：\-–]\s*/, ''));
}

// ---------------------------------------------------------------------------
// 3. Sinh câu hỏi không cần AI (từ câu trọng tâm và nội dung bài)
//    Trả về câu dạng "đang duyệt": { q, options, correct, e, d, source, t, r }
// ---------------------------------------------------------------------------
export function offlineQuestions(lesson, { types = ['mcq', 'tf', 'cloze'], count = 10, rng = Math.random } = {}) {
  const usable = types.filter((t) => !QTYPES[t]?.ai);
  if (!usable.length) return [];
  // Bỏ nhãn "Ghi nhớ:", "Kết luận:"… ở đầu dòng để câu hỏi chỉ chứa kiến thức.
  const text = [lesson.key?.join('\n') || '', lesson.text || ''].join('\n').split('\n')
    .map((l) => l.replace(MEMO_HEAD, '').replace(/^\s*[:：\-–]\s*/, '')).join('\n');
  // Mỗi câu điền khuyết cho ta: 1 câu đúng (e), 1 từ khoá và 3 từ thay thế → dựng được câu sai.
  const cloze = makeClozeQuestions(text, { max: Math.max(12, count * 2), rng });
  // Câu sai = thay từ khoá bằng từ khác; bỏ nếu vô tình trùng một câu đúng có trong bài.
  const plain = clean(text).toLowerCase();
  const facts = cloze.map((c) => {
    const truth = c.e;
    const fake = c.options.slice(1).map((alt) => truth.replace(c.options[0], alt))
      .find((f) => f !== truth && !plain.includes(clean(f).toLowerCase().replace(/[.!;]+$/, '')));
    return { truth, key: c.options[0], fake, cloze: c };
  }).filter((f) => f.truth.includes(f.key) && f.fake);
  const falsify = (f) => f.fake;
  const short = (s) => s.length <= 160;
  const out = [];
  const used = new Set();
  const take = (pred) => { const f = facts.find((x) => !used.has(x) && pred(x)); if (f) used.add(f); return f; };
  let guard = 0;
  while (out.length < count && guard++ < count * 6) {
    const t = usable[out.length % usable.length];
    if (t === 'cloze') {
      const f = take(() => true);
      if (!f) break;
      out.push({ ...f.cloze, t, r: f.truth });
    } else if (t === 'tf') {
      const f = take(() => true);
      if (!f) break;
      const isTrue = rng() < 0.5;
      out.push({ q: `Đúng hay sai: "${isTrue ? f.truth : falsify(f)}"`, options: [...TF], correct: isTrue ? 0 : 1, e: isTrue ? 'Phát biểu này đúng.' : `Đúng ra là: ${f.truth}`, d: 1, source: 'auto', t, r: f.truth });
    } else if (t === 'mcq' || t === 'neg') {
      const main = take((x) => short(x.truth));
      if (!main) { usable.splice(usable.indexOf(t), 1); if (!usable.length) break; continue; }
      const others = facts.filter((x) => x !== main && short(x.truth)).sort(() => rng() - 0.5).slice(0, 3);
      if (others.length < 3) { used.delete(main); usable.splice(usable.indexOf(t), 1); if (!usable.length) break; continue; }
      if (t === 'mcq') {
        out.push({ q: 'Phát biểu nào sau đây ĐÚNG?', options: [main.truth, ...others.map(falsify)], correct: 0, e: main.truth, d: 2, source: 'auto', t, r: main.truth });
      } else {
        out.push({ q: 'Phát biểu nào sau đây KHÔNG đúng?', options: [falsify(main), ...others.map((x) => x.truth)], correct: 0, e: `Đúng ra là: ${main.truth}`, d: 2, source: 'auto', t, r: main.truth });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Gắn bài học vào câu hỏi; lọc câu theo bài đang học khi chia sẻ
// ---------------------------------------------------------------------------
export function tagWithLesson(list, lesson) {
  return list.map((r) => ({ ...r, lid: lesson.id, l: lesson.title, r: clean(r.r || r.e || lesson.key?.[0] || '').slice(0, MAX_REF) }));
}

export function activeQuestions(set) {
  if (!set?.book?.lessons?.length) return set?.questions || [];
  const on = new Set(set.book.lessons.filter((l) => l.on !== false).map((l) => l.id));
  return set.questions.filter((q) => !q.lid || on.has(q.lid));
}

export function lessonStats(set) {
  const stats = {};
  for (const q of set?.questions || []) if (q.lid) stats[q.lid] = (stats[q.lid] || 0) + 1;
  return stats;
}

// Nội dung "xem lại" khi trả lời sai.
export function reviewNote(q) {
  const ref = clean(q?.ref || q?.r);
  const lesson = clean(q?.lesson || q?.l);
  if (!ref && !lesson) return null;
  return { lesson, ref };
}
