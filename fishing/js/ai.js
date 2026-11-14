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
export async function generateQuestionsAI({ apiKey, source, options = {}, model = GEMINI_MODEL, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new Error('Cần Gemini API key (miễn phí tại aistudio.google.com/apikey).');
  const parts = [{ text: buildPrompt(options) }];
  if (source.file) parts.push({ inlineData: { mimeType: source.file.mimeType, data: source.file.base64 } });
  if (source.text) parts.push({ text: `NỘI DUNG:\n${String(source.text).slice(0, MAX_TEXT_CHARS)}` });
  const res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.6, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /API key/i.test(raw)) throw new Error('Gemini API key không đúng, hãy kiểm tra lại.');
    if (res.status === 429) throw new Error('Đã hết lượt dùng Gemini trong phút này, hãy đợi một lát rồi thử lại.');
    if (res.status === 413) throw new Error('Tệp quá lớn để gửi cho AI. Hãy cắt bớt trang hoặc dán phần chữ cần dùng.');
    throw new Error(`Gemini báo lỗi ${res.status}. ${raw.slice(0, 200)}`);
  }
  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  let json;
  try { json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('AI trả về dữ liệu không hợp lệ, hãy thử lại.'); }
  const out = parseAIQuestions(json);
  if (!out.length) throw new Error('AI chưa tạo được câu hỏi nào từ nội dung này.');
  return out;
}
