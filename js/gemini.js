// Chế độ AI (tuỳ chọn): dùng Gemini API để tự viết kịch bản từng cảnh.
// API key chỉ được lưu trong trình duyệt của người dùng và gửi thẳng tới Google.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are a storyboard writer for Google Flow (Veo video model).
Each scene is ONE continuous ~8-second shot. Write in English for the visual fields
(camera, action, sound) because Veo understands English best. Keep "dialogue" in the
language the user wrote in. Keep each action vivid, concrete and filmable in 8 seconds:
one subject, one main action, no scene cuts inside a shot. Refer to the protagonist as
"the main character" so the app can insert a consistent character description.
Return ONLY JSON matching the schema.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    character: { type: 'STRING', description: 'Detailed, consistent visual description of the main character in English (age, face, hair, clothing). Empty if no character.' },
    setting: { type: 'STRING', description: 'Main location and time of day in English.' },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Short scene name in Vietnamese' },
          goal: { type: 'STRING', description: 'What this scene achieves, in Vietnamese' },
          camera: { type: 'STRING' },
          action: { type: 'STRING' },
          dialogue: { type: 'STRING' },
          sound: { type: 'STRING' },
        },
        required: ['title', 'goal', 'camera', 'action', 'dialogue', 'sound'],
      },
    },
  },
  required: ['title', 'character', 'setting', 'scenes'],
};

export async function generateStoryboard({ apiKey, model = DEFAULT_MODEL, project, sceneCount, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');

  const userPrompt = [
    `Video idea: ${project.idea}`,
    `Video type: ${project.templateId}`,
    `Number of scenes: ${sceneCount}`,
    `Aspect ratio: ${project.aspectRatio}`,
    project.character ? `Main character (keep it): ${project.character}` : '',
    project.setting ? `Setting (keep it): ${project.setting}` : '',
  ].filter(Boolean).join('\n');

  const res = await fetchImpl(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini báo lỗi ${res.status}. ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return parseStoryboard(text);
}

export function parseStoryboard(text) {
  let json;
  try {
    json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('AI trả về dữ liệu không hợp lệ, hãy thử lại.');
  }
  if (!Array.isArray(json.scenes) || json.scenes.length === 0) {
    throw new Error('AI không tạo được cảnh nào, hãy viết ý tưởng chi tiết hơn.');
  }
  return {
    title: json.title || '',
    character: json.character || '',
    setting: json.setting || '',
    scenes: json.scenes.map((s, i) => ({
      title: s.title || `Cảnh ${i + 1}`,
      goal: s.goal || '',
      camera: s.camera || '',
      action: s.action || '',
      dialogue: s.dialogue || '',
      sound: s.sound || '',
    })),
  };
}
