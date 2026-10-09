// Kết nối Gemini API (tuỳ chọn): viết kịch bản, nhận dạng + dịch video, đọc giọng tiếng Việt.
// API key chỉ được lưu trong trình duyệt của người dùng và gửi thẳng tới Google.

import { VOICE_LANGUAGES, findById } from './templates.js';
import { base64ToBytes, pcm16ToFloat32, parseSampleRate, ttsInstruction } from './dubbing.js';

const API_ROOT = 'https://generativelanguage.googleapis.com';
const API_BASE = `${API_ROOT}/v1beta/models`;
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
// Video nhỏ hơn mức này gửi thẳng trong request; lớn hơn thì tải lên qua File API.
export const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Gọi API, tự thử lại khi bị giới hạn lượt (429) hoặc máy chủ bận (5xx).
async function request(url, { apiKey, body, fetchImpl = fetch, retries = 3, sleep = wait, method = 'POST' }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return res.json();

    const detail = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const hinted = /"retryDelay":\s*"(\d+)s"/.exec(detail);
      await sleep((hinted ? Number(hinted[1]) : 5 * 2 ** attempt) * 1000);
      continue;
    }
    if (res.status === 429) throw new Error('Đã hết lượt dùng Gemini miễn phí trong phút này, hãy đợi một lát rồi thử lại.');
    if (res.status === 400 && /API key/i.test(detail)) throw new Error('Gemini API key không đúng, hãy kiểm tra lại.');
    throw new Error(`Gemini báo lỗi ${res.status}. ${detail.slice(0, 300)}`);
  }
}

function responseText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

function parseJson(text) {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('AI trả về dữ liệu không hợp lệ, hãy thử lại.');
  }
}

// ---------------------------------------------------------------------------
// 1. Viết kịch bản
// ---------------------------------------------------------------------------

const STORYBOARD_PROMPT = `You are a storyboard writer for Google Flow (Veo video model).
Each scene is ONE continuous ~8-second shot. Write the visual fields (camera, action, sound)
in English because Veo understands English best. Keep each action vivid, concrete and
filmable in 8 seconds: one subject, one main action, no cuts inside a shot. Refer to the
protagonist as "the main character" so the app can insert a consistent character description.

Voice for each scene:
- voiceType "dialogue": a character speaks; "narration": voice-over; "sing": a character sings.
- "dialogue" holds the spoken words or lyrics in the requested voice language
  (Vietnamese must use correct diacritics). It must be short enough to say or sing
  in about 6 seconds (one sentence, or 1-2 short lyric lines). Leave it empty for silent shots.
- For music videos and kids songs, write original, rhyming, easy-to-sing lyrics that
  continue from scene to scene like one song. Kids content must be simple, gentle and safe.
Return ONLY JSON matching the schema.`;

const STORYBOARD_SCHEMA = {
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
          voiceType: { type: 'STRING', enum: ['dialogue', 'narration', 'sing'] },
          dialogue: { type: 'STRING' },
          sound: { type: 'STRING' },
        },
        required: ['title', 'goal', 'camera', 'action', 'voiceType', 'dialogue', 'sound'],
      },
    },
  },
  required: ['title', 'character', 'setting', 'scenes'],
};

export async function generateStoryboard({ apiKey, model = DEFAULT_MODEL, project, sceneCount, templateName = '', fetchImpl, sleep }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');

  const userPrompt = [
    `Video idea: ${project.idea}`,
    `Video type: ${templateName || project.templateId}`,
    `Number of scenes: ${sceneCount}`,
    `Aspect ratio: ${project.aspectRatio}`,
    `Voice language: ${findById(VOICE_LANGUAGES, project.voiceLanguage).prompt}`,
    project.character ? `Main character (keep it): ${project.character}` : '',
    project.setting ? `Setting (keep it): ${project.setting}` : '',
  ].filter(Boolean).join('\n');

  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      systemInstruction: { parts: [{ text: STORYBOARD_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: STORYBOARD_SCHEMA, temperature: 0.9 },
    },
  });
  return parseStoryboard(responseText(data));
}

export function parseStoryboard(text) {
  const json = parseJson(text);
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
      voiceType: ['dialogue', 'narration', 'sing'].includes(s.voiceType) ? s.voiceType : 'dialogue',
      dialogue: s.dialogue || '',
      sound: s.sound || '',
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. Nhận dạng lời nói trong video + dịch sang tiếng Việt
// ---------------------------------------------------------------------------

const TRANSCRIBE_PROMPT = `You are a professional Vietnamese dubbing translator.
Listen to ALL speech in this video (any language: English, Chinese, Korean, Japanese, Thai, ...).
Split it into segments of one sentence each (at most ~8 seconds). For each segment give:
- start / end: time in seconds from the start of the video (decimals allowed), as accurate as possible
- speaker: a short consistent label, e.g. "Người nói 1", or the character's name if known
- gender: "male", "female" or "child"
- original: the exact words in the original language
- vietnamese: a natural, fluent Vietnamese translation for dubbing, with correct diacritics.
  Choose proper Vietnamese pronouns (anh/em, tôi/bạn, con/mẹ...) from context. Keep it about
  the same length as the original so it fits the time slot. Keep names as they are.
If the speech is already Vietnamese, just transcribe it into "vietnamese".
Ignore background music and songs without clear words. Return ONLY JSON matching the schema.`;

const TRANSCRIBE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sourceLanguage: { type: 'STRING', description: 'Detected language name in Vietnamese, e.g. "Tiếng Anh"' },
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          speaker: { type: 'STRING' },
          gender: { type: 'STRING', enum: ['male', 'female', 'child'] },
          original: { type: 'STRING' },
          vietnamese: { type: 'STRING' },
        },
        required: ['start', 'end', 'speaker', 'gender', 'original', 'vietnamese'],
      },
    },
  },
  required: ['sourceLanguage', 'segments'],
};

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// Tải file lớn lên Gemini File API (giao thức resumable), đợi tới khi file sẵn sàng.
async function uploadFile({ apiKey, file, fetchImpl = fetch, sleep = wait, onProgress }) {
  const start = await fetchImpl(`${API_ROOT}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name || 'video' } }),
  });
  const uploadUrl = start.ok && start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error(`Không tải được video lên Gemini (lỗi ${start.status}).`);

  onProgress?.('Đang tải video lên Gemini…');
  const done = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: file,
  });
  if (!done.ok) throw new Error(`Tải video lên thất bại (lỗi ${done.status}).`);
  let info = (await done.json()).file;

  for (let i = 0; info.state === 'PROCESSING' && i < 60; i++) {
    onProgress?.('Gemini đang xử lý video…');
    await sleep(3000);
    info = await request(`${API_ROOT}/v1beta/${info.name}`, { apiKey, fetchImpl, sleep, method: 'GET' });
  }
  if (info.state !== 'ACTIVE') throw new Error('Gemini không xử lý được video này, hãy thử file MP4 khác.');
  return { fileData: { mimeType: info.mimeType || file.type, fileUri: info.uri } };
}

export async function transcribeAndTranslate({ apiKey, model = DEFAULT_MODEL, file, fetchImpl, sleep, onProgress }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');
  if (!file) throw new Error('Hãy chọn video cần lồng tiếng.');

  let mediaPart;
  if (file.size <= INLINE_LIMIT_BYTES) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    mediaPart = { inlineData: { mimeType: file.type || 'video/mp4', data: bytesToBase64(bytes) } };
  } else {
    mediaPart = await uploadFile({ apiKey, file, fetchImpl, sleep, onProgress });
  }

  onProgress?.('AI đang nghe và dịch sang tiếng Việt…');
  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      systemInstruction: { parts: [{ text: TRANSCRIBE_PROMPT }] },
      contents: [{ role: 'user', parts: [mediaPart, { text: 'Transcribe and translate this video for Vietnamese dubbing.' }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: TRANSCRIBE_SCHEMA, temperature: 0.3 },
    },
  });
  const json = parseJson(responseText(data));
  if (!Array.isArray(json.segments)) throw new Error('AI không tìm thấy lời nói trong video.');
  return { sourceLanguage: json.sourceLanguage || '', segments: json.segments };
}

// ---------------------------------------------------------------------------
// 3. Đọc giọng tiếng Việt (Text-to-Speech)
// ---------------------------------------------------------------------------

export async function synthesizeSpeech({ apiKey, model = DEFAULT_TTS_MODEL, text, voice = 'Kore', voiceLanguage = 'vi-north', speaker = '', fetchImpl, sleep }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');
  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      contents: [{ role: 'user', parts: [{ text: ttsInstruction(voiceLanguage, text, speaker) }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    },
  });
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('Gemini không trả về âm thanh, hãy thử lại.');
  return {
    samples: pcm16ToFloat32(base64ToBytes(part.inlineData.data)),
    sampleRate: parseSampleRate(part.inlineData.mimeType),
  };
}
