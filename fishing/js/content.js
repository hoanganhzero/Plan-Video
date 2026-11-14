// Nội dung học tập do giáo viên / phụ huynh cấu hình: bộ đề (question sets).
// Thuần logic (không DOM) để kiểm thử: chuẩn hoá câu hỏi, đọc đề trắc nghiệm có sẵn trong văn bản,
// tạo câu điền khuyết tự động, đọc/ghi CSV, kiểm tra dữ liệu AI trả về.
//
// Câu hỏi trong bộ đề: { id, q, a, w: [sai...], e: giải thích, d: độ khó 1–3 }
// Câu hỏi đang duyệt (review): { q, options: [...], correct: chỉ số | null, e, d, source }

export const MAX_QUESTIONS_PER_SET = 500;

let idSeq = 0;
export const newId = (prefix = 'q') => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function newSet(name = 'Bộ đề mới', extra = {}) {
  return { id: newId('set'), name: clean(name) || 'Bộ đề mới', subject: '', grade: '', enabled: true, questions: [], ...extra };
}

// Chuẩn hoá & kiểm tra một câu hỏi bộ đề. Trả về null nếu không dùng được.
export function normalizeQuestion(raw) {
  if (!raw) return null;
  const q = clean(raw.q);
  const a = clean(raw.a);
  const wrong = [...new Set((raw.w || []).map(clean).filter((x) => x && x !== a))].slice(0, 3);
  if (!q || !a || !wrong.length) return null;
  const d = Math.min(3, Math.max(1, Math.round(Number(raw.d) || 1)));
  return { id: raw.id || newId(), q, a, w: wrong, e: clean(raw.e), d };
}

// Câu đang duyệt → câu bộ đề (cần đã chọn đáp án đúng).
export function reviewToQuestion(r) {
  if (!r || r.correct === null || r.correct === undefined) return null;
  const opts = (r.options || []).map(clean).filter(Boolean);
  const a = clean(r.options?.[r.correct]);
  return normalizeQuestion({ q: r.q, a, w: opts.filter((o) => o !== a), e: r.e, d: r.d });
}

export function questionToReview(q, source = '') {
  return { q: q.q, options: [q.a, ...q.w], correct: 0, e: q.e || '', d: q.d || 1, source };
}

// ---------------------------------------------------------------------------
// 1. Đọc đề trắc nghiệm có sẵn trong văn bản (phiếu bài tập, đề kiểm tra…)
//    Hỗ trợ: "Câu 1: … A. … B. … C. … D. …", đáp án đánh dấu "Đáp án: B", "*B." hoặc "(đúng)",
//    và bảng đáp án cuối đề "ĐÁP ÁN: 1B 2C 3-A …".
// ---------------------------------------------------------------------------
const Q_START = /^\s*(?:câu|cau|bài|question|q)\s*(\d+)\s*[.:)\-–]?\s*|^\s*(\d+)\s*[.)]\s+/i;
const OPT = /^\s*\*?\s*([A-Da-d])\s*[.)/:]\s*/;
const ANSWER_LINE = /^\s*(?:đáp\s*án|dap\s*an|đa|answer|key|chọn)\s*(?:đúng)?\s*[:：\-–]?\s*\(?([A-Da-d])\)?\s*[.;,]?\s*$/i;
const EXPLAIN_LINE = /^\s*(?:giải\s*thích|lời\s*giải|hướng\s*dẫn|explain(?:ation)?)\s*[:：\-–]\s*/i;

function splitInlineOptions(line) {
  // "A. x   B. y   C. z   D. w" → các phương án riêng
  const parts = line.split(/\s+(?=\*?\s*[B-Db-d]\s*[.)]\s)/);
  return parts.length > 1 ? parts : [line];
}

function answerKey(text) {
  const key = {};
  // Tiêu đề bảng đáp án phải đứng riêng một dòng (VD "ĐÁP ÁN", "Đáp án tham khảo:", "Answer key").
  const idx = text.search(/^[ \t]*(?:bảng[ \t]*)?(?:đáp[ \t]*án(?:[ \t]*tham[ \t]*khảo)?|answer[ \t]*key)[ \t]*[:：]?[ \t]*(?:\r?\n|$|(?=[ \t]*\d))/im);
  const tail = idx >= 0 ? text.slice(idx) : '';
  for (const m of tail.matchAll(/(?:câu\s*)?(\d{1,3})\s*[-.:)]?\s*([A-Da-d])(?![a-zà-ỹ])/gi)) key[Number(m[1])] = m[2].toUpperCase();
  return { key, cut: idx };
}

export function parseQuizText(text) {
  const { key, cut } = answerKey(String(text || ''));
  const body = cut >= 0 ? text.slice(0, cut) : String(text || '');
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ');
    if (!line.trim()) continue;
    const m = line.match(Q_START);
    if (m && !OPT.test(line)) {
      cur = { num: Number(m[1] || m[2]), stem: [line.slice(m[0].length)], opts: [], marked: null, answer: null, explain: '' };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    const ans = line.match(ANSWER_LINE);
    if (ans) { cur.answer = ans[1].toUpperCase(); continue; }
    if (EXPLAIN_LINE.test(line)) { cur.explain = clean(line.replace(EXPLAIN_LINE, '')); continue; }
    if (OPT.test(line)) {
      for (const part of splitInlineOptions(line)) {
        const om = part.match(OPT);
        if (!om) continue;
        let txt = part.slice(om[0].length);
        const letter = om[1].toUpperCase();
        if (/^\s*\*/.test(part) || /\*\s*$/.test(txt) || /\((?:đúng|correct)\)/i.test(txt)) {
          cur.marked = letter;
          txt = txt.replace(/\*\s*$/, '').replace(/\((?:đúng|correct)\)/i, '');
        }
        cur.opts.push({ letter, text: clean(txt) });
      }
      continue;
    }
    if (cur.opts.length) cur.opts[cur.opts.length - 1].text = clean(`${cur.opts[cur.opts.length - 1].text} ${line}`);
    else cur.stem.push(line);
  }
  const out = [];
  for (const b of blocks) {
    if (b.opts.length < 2) continue;
    const letter = b.answer || b.marked || key[b.num] || null;
    const correct = letter ? b.opts.findIndex((o) => o.letter === letter) : -1;
    out.push({
      q: clean(b.stem.join(' ')), options: b.opts.map((o) => o.text), correct: correct >= 0 ? correct : null,
      e: b.explain, d: 1, source: 'quiz',
    });
  }
  return out.filter((r) => r.q && r.options.filter(Boolean).length >= 2);
}

// ---------------------------------------------------------------------------
// 2. Tạo câu điền khuyết từ nội dung bài học (không cần mạng)
//    Chọn câu có năm/số liệu, tên riêng hoặc định nghĩa "X là …", che từ khoá, lấy phương án nhiễu
//    cùng loại trong chính bài.
// ---------------------------------------------------------------------------
const NUM_RE = /\b\d{1,4}(?:[.,]\d+)?(?:\s?(?:%|km|m|cm|kg|g|°C|độ|năm|triệu|nghìn|tỉ))?\b/g;
const PROPER_RE = /(?<![.!?]\s)(?<!^)\b([A-ZĐÂĂÊÔƠƯÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ][\wà-ỹ]+(?:\s+[A-ZĐÂĂÊÔƠƯÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ][\wà-ỹ]+){0,3})/gu;

export function splitSentences(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(clean)
    .filter((s) => s.length >= 30 && s.length <= 240 && /[a-zà-ỹ]/i.test(s));
}

function numberVariants(token, rng) {
  const m = token.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return [];
  const n = Number(m[1].replace(',', '.'));
  const unit = m[2];
  const isYear = /^\d{4}$/.test(m[1]);
  const steps = isYear ? [-30, -12, -5, 5, 11, 25] : [-0.5, -0.25, 0.25, 0.5, 1, 2].map((k) => Math.max(1, Math.round(Math.abs(n) * k)) * Math.sign(k || 1));
  const out = new Set();
  for (const s of steps.sort(() => rng() - 0.5)) {
    const v = isYear ? n + s : Math.max(0, n + s);
    if (v !== n) out.add(`${Number.isInteger(n) ? Math.round(v) : v.toFixed(1)}${unit}`);
    if (out.size >= 3) break;
  }
  return [...out];
}

export function makeClozeQuestions(text, { max = 10, rng = Math.random } = {}) {
  const sentences = splitSentences(text);
  const allNumbers = new Set();
  const allNames = new Set();
  const defs = [];
  for (const s of sentences) {
    for (const n of s.match(NUM_RE) || []) allNumbers.add(n.trim());
    for (const m of s.matchAll(PROPER_RE)) if (m[1].length > 2) allNames.add(m[1].trim());
    const d = s.match(/^(.{3,40}?)\s+(?:là|được gọi là|gọi là)\s+(.{8,})$/i);
    if (d) defs.push(clean(d[1]));
  }
  const pick = (list, not, n) => list.filter((x) => x !== not && !not.includes(x) && !x.includes(not)).sort(() => rng() - 0.5).slice(0, n);
  const out = [];
  const used = new Set();
  for (const s of sentences.sort(() => rng() - 0.5)) {
    if (out.length >= max) break;
    let keyTok = null;
    let wrong = [];
    const nums = (s.match(NUM_RE) || []).map((x) => x.trim()).filter((x) => /\d{2,}|%|km|kg|°C|năm/.test(x));
    const names = [...s.matchAll(PROPER_RE)].map((m) => m[1].trim()).filter((x) => x.length > 2);
    const def = s.match(/^(.{3,40}?)\s+(?:là|được gọi là|gọi là)\s+/i);
    if (def && defs.length >= 4) {
      keyTok = clean(def[1]);
      wrong = pick(defs, keyTok, 3);
    } else if (names.length && allNames.size >= 4) {
      keyTok = names[Math.floor(rng() * names.length)];
      wrong = pick([...allNames], keyTok, 3);
    } else if (nums.length) {
      keyTok = nums[Math.floor(rng() * nums.length)];
      const pool = pick([...allNumbers].filter((x) => x.replace(/[\d.,\s]/g, '') === keyTok.replace(/[\d.,\s]/g, '')), keyTok, 3);
      wrong = pool.length >= 3 ? pool : [...new Set([...pool, ...numberVariants(keyTok, rng)])].slice(0, 3);
    }
    if (!keyTok || wrong.length < 3 || used.has(keyTok)) continue;
    used.add(keyTok);
    const blanked = s.replace(keyTok, '_____');
    if (blanked === s) continue;
    out.push({ q: `Điền vào chỗ trống: "${blanked}"`, options: [keyTok, ...wrong], correct: 0, e: s, d: 2, source: 'cloze' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. CSV (mở được bằng Excel / Google Sheets)
//    Cột: Câu hỏi, Đáp án đúng, Sai 1, Sai 2, Sai 3, Giải thích, Độ khó
// ---------------------------------------------------------------------------
export const CSV_HEADER = ['Câu hỏi', 'Đáp án đúng', 'Sai 1', 'Sai 2', 'Sai 3', 'Giải thích', 'Độ khó (1-3)'];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function setToCSV(set) {
  const rows = [CSV_HEADER, ...set.questions.map((q) => [q.q, q.a, q.w[0] || '', q.w[1] || '', q.w[2] || '', q.e || '', q.d || 1])];
  return `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`;
}

export function parseCSV(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const data = rows.filter((r) => r.some((x) => x.trim()));
  if (data.length && /câu\s*hỏi|question/i.test(data[0][0] || '')) data.shift();
  const questions = [];
  const errors = [];
  data.forEach((r, i) => {
    const q = normalizeQuestion({ q: r[0], a: r[1], w: [r[2], r[3], r[4]], e: r[5], d: r[6] });
    if (q) questions.push(q); else errors.push(i + 2);
  });
  return { questions, errors };
}

// Dán nhanh: mỗi dòng "Câu hỏi | Đáp án đúng | Sai 1 | Sai 2 | Sai 3"
export function parsePipeLines(text) {
  const questions = [];
  const errors = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((x) => x.trim());
    const q = normalizeQuestion({ q: parts[0], a: parts[1], w: parts.slice(2, 5) });
    if (q) questions.push(q); else errors.push(i + 1);
  });
  return { questions, errors };
}

// ---------------------------------------------------------------------------
// 4. Kiểm tra dữ liệu câu hỏi do AI trả về
// ---------------------------------------------------------------------------
export function parseAIQuestions(data) {
  const list = Array.isArray(data) ? data : data?.questions || [];
  return list.map((x) => {
    const correct = clean(x.correct ?? x.answer);
    const wrong = (x.wrong || x.distractors || []).map(clean).filter((w) => w && w !== correct).slice(0, 3);
    if (!clean(x.question) || !correct || wrong.length < 2) return null;
    return { q: clean(x.question), options: [correct, ...wrong], correct: 0, e: clean(x.explanation), d: Math.min(3, Math.max(1, Number(x.difficulty) || 1)), source: 'ai' };
  }).filter(Boolean);
}

// Gộp câu mới vào bộ đề, bỏ câu trùng nội dung.
export function addToSet(set, questions) {
  const seen = new Set(set.questions.map((q) => q.q.toLowerCase()));
  let added = 0;
  for (const raw of questions) {
    const q = normalizeQuestion(raw);
    if (!q || seen.has(q.q.toLowerCase()) || set.questions.length >= MAX_QUESTIONS_PER_SET) continue;
    seen.add(q.q.toLowerCase());
    set.questions.push(q);
    added++;
  }
  return added;
}
