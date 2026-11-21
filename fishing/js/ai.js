// Sinh câu hỏi trắc nghiệm bằng Gemini từ nội dung bài học (chữ, PDF hoặc ảnh chụp trang sách).
// Dùng chung Gemini API key với ứng dụng Plan Video (lưu trong trình duyệt, gửi thẳng tới Google).
import { parseAIQuestions } from './content.js';

export const GEMINI_KEY_STORAGE = 'plan-video:gemini-key';
export const GEMINI_MODEL = 'gemini-2.5-flash';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
export const MAX_TEXT_CHARS = 60000;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function loadKey() { try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ''; } catch { return ''; } }
export function saveKey(k) { try { localStorage.setItem(GEMINI_KEY_STORAGE, k.trim()); } catch { /* bỏ qua */ } }

const LEVEL = { 1: 'dễ (nhận biết)', 2: 'vừa (thông hiểu)', 3: 'khó (vận dụng)' };

export function buildPrompt({ count = 10, grade = '', subject = '', difficulty = 'mix', focus = '' }) {
  return `Bạn là giáo viên Việt Nam giỏi ra đề. Dựa CHỈ vào nội dung được cung cấp (bài học / trang sách giáo khoa / tài liệu),
hãy soạn ${count} câu hỏi trắc nghiệm bằng tiếng Việt cho học sinh${grade ? ` ${grade}` : ''}${subject ? `, môn ${subject}` : ''}.
Yêu cầu:
- Mỗi câu có đúng 1 đáp án đúng ("correct") và 3 đáp án sai hợp lý, cùng loại, không mơ hồ ("wrong").
- Đáp án ngắn gọn (tối đa khoảng 12 từ). Không dùng "Tất cả đều đúng/sai".
- Câu hỏi rõ ràng, phù hợp lứa tuổi, không hỏi điều không có trong nội dung.
- "explanation": 1 câu giải thích vì sao đáp án đúng (trích ý từ bài).
- "difficulty": 1 = ${LEVEL[1]}, 2 = ${LEVEL[2]}, 3 = ${LEVEL[3]}. ${difficulty === 'mix' ? 'Trộn đều các mức.' : `Tất cả ở mức ${difficulty}.`}
${focus ? `- Tập trung vào: ${focus}.\n` : ''}- Không lặp ý giữa các câu.`;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          correct: { type: 'STRING' },
          wrong: { type: 'ARRAY', items: { type: 'STRING' } },
          explanation: { type: 'STRING' },
          difficulty: { type: 'INTEGER' },
        },
        required: ['question', 'correct', 'wrong'],
      },
    },
  },
  required: ['questions'],
};

// source: { text } hoặc { file: { mimeType, base64 } } (PDF / ảnh)
export async function generateQuestionsAI({ apiKey, source, options = {}, model = GEMINI_MODEL, fetchImpl = globalThis.fetch, fallback }) {
  const parts = [{ text: buildPrompt(options) }];
  if (source.file) parts.push({ inlineData: { mimeType: source.file.mimeType, data: source.file.base64 } });
  if (source.text) parts.push({ text: `NỘI DUNG:\n${String(source.text).slice(0, MAX_TEXT_CHARS)}` });
  const json = await callGeminiJSON({ apiKey, parts, schema: SCHEMA, model, fetchImpl, temperature: 0.6, retries: 1, fallback });
  const out = parseAIQuestions(json);
  if (!out.length) throw new Error('AI chưa tạo được câu hỏi nào từ nội dung này.');
  return out;
}

// ===========================================================================
// Sách giáo khoa: soạn câu hỏi theo từng bài, theo các dạng thầy cô chọn,
// kèm nội dung trọng tâm của bài và đoạn "xem lại" cho từng câu.
// ===========================================================================
const TYPE_RULES = {
  mcq: '"mcq": trắc nghiệm 4 lựa chọn (1 đúng, 3 sai hợp lý).',
  tf: '"tf": một phát biểu để học sinh chọn Đúng hay Sai. "question" là phát biểu (không cần chữ "Đúng hay sai"), "correct" là "Đúng" hoặc "Sai", "wrong" là ["Sai"] hoặc ["Đúng"]. Trộn khoảng một nửa phát biểu sai (sửa một chi tiết quan trọng).',
  cloze: '"cloze": câu trích ý chính của bài, che một từ / cụm từ quan trọng bằng "_____"; 4 lựa chọn để điền.',
  neg: '"neg": hỏi "…KHÔNG đúng / KHÔNG phải…"; "correct" là phương án sai kiến thức, "wrong" là 3 phương án đúng.',
  apply: '"apply": tình huống thực tế gần gũi với học sinh, cần vận dụng kiến thức của bài để chọn 1 trong 4 phương án.',
};

export function buildLessonPrompt({ title = '', count = 10, types = ['mcq'], grade = '', subject = '', difficulty = 'mix', pages = null }) {
  const per = types.map((t, i) => `${t}: ${Math.floor(count / types.length) + (i < count % types.length ? 1 : 0)} câu`).join(', ');
  return `Bạn là giáo viên Việt Nam giỏi ra đề theo chương trình GDPT 2018. Dựa CHỈ vào nội dung ${pages ? `TRANG ${pages[0]}–${pages[1]} của tệp sách` : 'bài học'} được cung cấp${title ? ` – "${title}"` : ''},
cho học sinh${grade ? ` ${grade}` : ''}${subject ? `, môn ${subject}` : ''}:
1) "key_points": 3–6 ý trọng tâm của bài (mỗi ý 1 câu ngắn, đúng kiến thức trong bài, không chép bài tập).
2) "questions": ${count} câu hỏi tiếng Việt, phân bổ: ${per}. Các dạng:
${types.map((t) => `- ${TYPE_RULES[t]}`).join('\n')}
Yêu cầu chung:
- Hỏi vào nội dung trọng tâm; không hỏi điều không có trong bài; không lặp ý; đáp án ngắn gọn (≤ 15 từ, trừ câu "neg"/"mcq" dạng phát biểu ≤ 25 từ).
- Không dùng "Tất cả đều đúng/sai". Phương án sai phải hợp lý, cùng loại với đáp án đúng.
- "explanation": 1 câu giải thích vì sao đúng.
- "ref": trích hoặc tóm tắt 1–2 câu nội dung trong bài liên quan trực tiếp tới câu hỏi (để học sinh đọc lại khi trả lời sai).
- "difficulty": 1 = ${LEVEL[1]}, 2 = ${LEVEL[2]}, 3 = ${LEVEL[3]}. ${difficulty === 'mix' ? 'Trộn các mức (câu "apply" thường mức 3).' : `Tất cả ở mức ${difficulty}.`}`;
}

const LESSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    key_points: { type: 'ARRAY', items: { type: 'STRING' } },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' }, question: { type: 'STRING' }, correct: { type: 'STRING' },
          wrong: { type: 'ARRAY', items: { type: 'STRING' } }, explanation: { type: 'STRING' },
          ref: { type: 'STRING' }, difficulty: { type: 'INTEGER' },
        },
        required: ['type', 'question', 'correct', 'wrong'],
      },
    },
  },
  required: ['key_points', 'questions'],
};

const LESSONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lessons: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, from_page: { type: 'INTEGER' }, to_page: { type: 'INTEGER' } }, required: ['title', 'from_page'] },
    },
  },
  required: ['lessons'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// AI dự phòng: dịch vụ chuẩn OpenAI (POST …/chat/completions) – dùng khi Gemini hết lượt hoặc chưa có key.
// Địa chỉ, key, model do thầy cô nhập; chỉ lưu trong trình duyệt này (không nằm trong mã nguồn công khai).
// ---------------------------------------------------------------------------
export const FALLBACK_STORAGE = 'plan-video:ai-fallback';
export function loadFallback() {
  try { const c = JSON.parse(localStorage.getItem(FALLBACK_STORAGE) || 'null'); return c && c.url && c.key ? c : null; } catch { return null; }
}
export function loadFallbackRaw() {
  try { return JSON.parse(localStorage.getItem(FALLBACK_STORAGE) || 'null') || { url: '', key: '', model: '' }; } catch { return { url: '', key: '', model: '' }; }
}
export function saveFallback(c) {
  try { localStorage.setItem(FALLBACK_STORAGE, JSON.stringify({ url: String(c.url || '').trim(), key: String(c.key || '').trim(), model: String(c.model || '').trim() })); } catch { /* bỏ qua */ }
}
export function chatUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(u)) return u;
  return `${u}${/\/v\d+[a-z]*$/.test(u) ? '' : '/v1'}/chat/completions`;
}

// Gemini parts → nội dung tin nhắn chuẩn OpenAI (chữ + ảnh). PDF/tệp sách trên Gemini thì không gửi được.
function toChatContent(parts) {
  const content = [];
  for (const p of parts) {
    if (p.text) content.push({ type: 'text', text: p.text });
    else if (p.inlineData && /^image\//.test(p.inlineData.mimeType)) content.push({ type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } });
    else throw new Error('AI dự phòng chỉ đọc được chữ và ảnh – tệp PDF scan / sách scan cần Gemini.');
  }
  return content.every((c) => c.type === 'text') ? content.map((c) => c.text).join('\n\n') : content;
}

function parseJSONText(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch { /* thử lấy khối {...} */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* rơi xuống */ } }
  throw new Error('AI trả về dữ liệu không hợp lệ, hãy thử lại.');
}

export async function callOpenAIJSON({ cfg, parts, schema, temperature = 0.5, fetchImpl = globalThis.fetch }) {
  const sys = `Bạn trả lời bằng DUY NHẤT một đối tượng JSON hợp lệ (không giải thích, không markdown), đúng cấu trúc JSON Schema sau (OBJECT/ARRAY/STRING/INTEGER là kiểu dữ liệu):\n${JSON.stringify(schema)}`;
  const body = { messages: [{ role: 'system', content: sys }, { role: 'user', content: toChatContent(parts) }], temperature, response_format: { type: 'json_object' } };
  if (cfg.model) body.model = cfg.model;
  const send = (b) => fetchImpl(chatUrl(cfg.url), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` }, body: JSON.stringify(b) });
  let res = await send(body);
  let raw = await res.text();
  // Một số dịch vụ không nhận response_format → gửi lại không có nó.
  if (res.status === 400 && /response_format|json_object/i.test(raw)) { delete body.response_format; res = await send(body); raw = await res.text(); }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('AI dự phòng: key không đúng hoặc không có quyền.');
    if (res.status === 429) throw new Error('AI dự phòng cũng đã hết lượt, hãy thử lại sau.');
    throw new Error(`AI dự phòng báo lỗi ${res.status}. ${raw.slice(0, 160)}`);
  }
  const data = JSON.parse(raw);
  return parseJSONText(data?.choices?.[0]?.message?.content ?? data?.output_text ?? '');
}

// Gọi Gemini trả về JSON theo schema; tự đợi rồi thử lại khi hết lượt trong phút (429).
// Có AI dự phòng: chưa có Gemini key hoặc Gemini hết lượt → chuyển sang AI dự phòng ngay.
export async function callGeminiJSON({ apiKey, parts, schema, model = GEMINI_MODEL, fetchImpl = globalThis.fetch, retries = 3, wait = 20000, temperature = 0.5, fallback = loadFallback() }) {
  const canFallback = fallback && parts.every((p) => p.text || (p.inlineData && /^image\//.test(p.inlineData.mimeType)));
  if (!apiKey) {
    if (canFallback) return callOpenAIJSON({ cfg: fallback, parts, schema, temperature, fetchImpl });
    throw new Error('Cần Gemini API key (miễn phí tại aistudio.google.com/apikey) hoặc AI dự phòng.');
  }
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema } }),
      });
    } catch (err) {
      if (canFallback) return callOpenAIJSON({ cfg: fallback, parts, schema, temperature, fetchImpl });
      throw err;
    }
    const raw = await res.text();
    if (res.ok) {
      const data = JSON.parse(raw);
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      return parseJSONText(text);
    }
    const quota = res.status === 429 || res.status === 503 || /RESOURCE_EXHAUSTED|quota/i.test(raw);
    if (quota && canFallback) return callOpenAIJSON({ cfg: fallback, parts, schema, temperature, fetchImpl });
    if (quota && attempt < retries) { await sleep(wait * (attempt + 1)); continue; }
    if (res.status === 400 && /API key/i.test(raw)) throw new Error('Gemini API key không đúng, hãy kiểm tra lại.');
    if (quota) throw new Error('Đã hết lượt dùng Gemini (thử lại sau ít phút, hoặc ngày mai nếu hết lượt trong ngày). Có thể thêm "AI dự phòng".');
    if (res.status === 413) throw new Error('Nội dung quá lớn để gửi cho AI.');
    throw new Error(`Gemini báo lỗi ${res.status}. ${raw.slice(0, 200)}`);
  }
}

const cleanStr = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Kiểm tra dữ liệu AI → câu "đang duyệt" có dạng câu (t) và nội dung liên quan (r).
export function parseLessonAI(data, allowed = Object.keys(TYPE_RULES)) {
  const key = (data?.key_points || []).map(cleanStr).filter((s) => s.length > 5).slice(0, 8);
  const questions = (data?.questions || []).map((x) => {
    const t = allowed.includes(x.type) ? x.type : 'mcq';
    let q = cleanStr(x.question);
    let correct = cleanStr(x.correct);
    let wrong = (x.wrong || []).map(cleanStr).filter((w) => w && w !== correct).slice(0, 3);
    if (t === 'tf') {
      const isTrue = /^(đúng|true|d|đ)$/i.test(correct);
      const isFalse = /^(sai|false|s)$/i.test(correct);
      if (!isTrue && !isFalse) return null;
      correct = isTrue ? 'Đúng' : 'Sai';
      wrong = [isTrue ? 'Sai' : 'Đúng'];
      if (q && !/^đúng hay sai/i.test(q)) q = `Đúng hay sai: "${q.replace(/^["“]|["”]$/g, '')}"`;
      return { q, options: ['Đúng', 'Sai'], correct: isTrue ? 0 : 1, e: cleanStr(x.explanation), d: Math.min(3, Math.max(1, Number(x.difficulty) || 1)), source: 'ai', t, r: cleanStr(x.ref) };
    }
    if (!q || !correct || wrong.length < 2) return null;
    return { q, options: [correct, ...wrong], correct: 0, e: cleanStr(x.explanation), d: Math.min(3, Math.max(1, Number(x.difficulty) || 1)), source: 'ai', t, r: cleanStr(x.ref) };
  }).filter(Boolean);
  return { key, questions };
}

// lesson: { title, text } hoặc dùng tệp sách đã tải lên Gemini (file: { uri, mimeType }) + trang from–to.
export async function generateLessonAI({ apiKey, lesson, file = null, options = {}, fetchImpl }) {
  const types = options.types?.length ? options.types : ['mcq'];
  const pages = file ? [lesson.from, lesson.to] : null;
  const parts = [{ text: buildLessonPrompt({ ...options, types, title: lesson.title, pages }) }];
  if (file) parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } });
  else parts.push({ text: `NỘI DUNG BÀI:\n${String(lesson.text || '').slice(0, MAX_TEXT_CHARS)}` });
  const out = parseLessonAI(await callGeminiJSON({ apiKey, parts, schema: LESSON_SCHEMA, fetchImpl }), types);
  if (!out.questions.length) throw new Error(`AI chưa tạo được câu hỏi cho "${lesson.title}".`);
  return out;
}

// Tìm danh sách bài: từ các dòng tiêu đề ứng viên (sách có chữ) hoặc từ tệp sách (sách scan).
export async function findLessonsAI({ apiKey, candidates = '', file = null, fetchImpl }) {
  const prompt = `Đây là ${file ? 'một cuốn sách giáo khoa Việt Nam' : 'các dòng ngắn (có số trang ở đầu "pN|") trích từ một cuốn sách giáo khoa Việt Nam'}.
Hãy liệt kê lần lượt các BÀI HỌC (mức "Bài"/"Unit"/"Tiết"; nếu sách chỉ chia "Chủ đề" thì dùng chủ đề), bỏ qua mục lục, lời nói đầu, ôn tập chung, phụ lục.
Mỗi bài: "title" (vd "Bài 3. Phép cộng trong phạm vi 10"), "from_page" và "to_page" là số trang trong tệp PDF (trang đầu tiên của tệp là 1).`;
  const parts = [{ text: prompt }];
  if (file) parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } });
  else parts.push({ text: String(candidates).slice(0, 200000) });
  const data = await callGeminiJSON({ apiKey, parts, schema: LESSONS_SCHEMA, fetchImpl, temperature: 0.1 });
  const list = (data?.lessons || []).map((l) => ({ title: cleanStr(l.title).slice(0, 120), from: Math.max(1, Number(l.from_page) || 1), to: Math.max(1, Number(l.to_page) || Number(l.from_page) || 1) }))
    .filter((l) => l.title);
  list.forEach((l, i) => { if (l.to < l.from) l.to = l.from; const next = list[i + 1]; if (next && l.to >= next.from && next.from > l.from) l.to = next.from - 1; });
  return list;
}

// Tải tệp sách (PDF scan, rất nhiều trang) lên Gemini Files API: dùng lại cho mọi bài trong 48 giờ.
export async function uploadBookFile({ apiKey, file, fetchImpl = globalThis.fetch, onState }) {
  if (!apiKey) throw new Error('Cần Gemini API key.');
  const mimeType = file.type || 'application/pdf';
  const boundary = `cauca${Date.now().toString(36)}`;
  const meta = JSON.stringify({ file: { display_name: String(file.name || 'sach').slice(0, 100) } });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    file, `\r\n--${boundary}--\r\n`,
  ]);
  onState?.('upload');
  const res = await fetchImpl('https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'X-Goog-Upload-Protocol': 'multipart', 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Chưa tải được sách lên Gemini (lỗi ${res.status}). ${raw.slice(0, 160)}`);
  let f = JSON.parse(raw).file;
  for (let i = 0; f && f.state === 'PROCESSING' && i < 60; i++) {
    onState?.('processing');
    await sleep(3000);
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/${f.name}`, { headers: { 'x-goog-api-key': apiKey } });
    if (r.ok) f = await r.json();
  }
  if (!f?.uri || f.state === 'FAILED') throw new Error('Gemini chưa đọc được tệp sách này.');
  return { uri: f.uri, mimeType: f.mimeType || mimeType, name: f.name };
}

// Ô nhập "AI dự phòng" dùng chung cho các khung AI (trang thầy cô). Tự lưu khi gõ.
export function fallbackFieldsHtml(esc) {
  const c = loadFallbackRaw();
  const on = !!(c.url && c.key);
  return `<details class="ai-fallback" ${on ? '' : ''}><summary class="small">🔁 AI dự phòng khi Gemini hết lượt ${on ? '<b class="ok">· đã cài</b>' : '<span class="muted">(không bắt buộc)</span>'}</summary>
    <p class="muted small">Dịch vụ AI chuẩn OpenAI (địa chỉ có <code>/v1/chat/completions</code>). Khi Gemini hết lượt hoặc chưa có Gemini key, hệ thống tự chuyển sang AI này.
      Key chỉ lưu trong trình duyệt này. AI dự phòng đọc được chữ và ảnh; sách / PDF scan vẫn cần Gemini.</p>
    <div class="fld-row">
      <label class="fld grow">Địa chỉ API<input data-fb="url" value="${esc(c.url || '')}" placeholder="https://…/v1" autocomplete="off"></label>
      <label class="fld">Model<input data-fb="model" value="${esc(c.model || '')}" placeholder="vd: gpt-4o-mini" autocomplete="off"></label>
    </div>
    <label class="fld">API key<input data-fb="key" type="password" value="${esc(c.key || '')}" placeholder="Dán key" autocomplete="off"></label>
  </details>`;
}
export function bindFallbackFields(root) {
  root.addEventListener('input', (e) => {
    const k = e.target.dataset?.fb;
    if (!k) return;
    const c = loadFallbackRaw();
    c[k] = e.target.value;
    saveFallback(c);
  });
}
