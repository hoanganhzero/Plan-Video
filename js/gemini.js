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
    if (/billing|paid (tier|plan)|FAILED_PRECONDITION|free tier/i.test(detail) && res.status !== 429) {
      throw new Error('Tính năng này cần bật thanh toán (billing) cho Gemini API key tại aistudio.google.com → Billing.');
    }
    if (res.status === 429) throw new Error('Đã hết lượt dùng Gemini trong phút này (hoặc model này cần bật thanh toán), hãy đợi một lát rồi thử lại.');
    if (res.status === 400 && /API key/i.test(detail)) throw new Error('Gemini API key không đúng, hãy kiểm tra lại.');
    if (res.status === 404) throw new Error(`Không tìm thấy model hoặc tài nguyên (lỗi 404). Model có thể đã đổi tên – bấm "Kiểm tra key" để tự chọn lại. ${detail.slice(0, 200)}`);
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
When photos are attached: the person photo shows the real presenter/main character and the
product photo shows the real product. Describe them precisely (face, hair, body, clothing;
product shape, colors, packaging, label) in "character" and "product", and build every scene
around them. Never change the person's identity or the product's look.
Return ONLY JSON matching the schema.`;

const STORYBOARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    character: { type: 'STRING', description: 'Detailed, consistent visual description of the main character in English (age, face, hair, clothing). Empty if no character.' },
    setting: { type: 'STRING', description: 'Main location and time of day in English.' },
    product: { type: 'STRING', description: 'Precise visual description of the product in English (shape, colors, packaging, label). Empty if no product.' },
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
  required: ['title', 'character', 'setting', 'product', 'scenes'],
};

// images: [{ role: 'person' | 'product', mimeType, data (base64) }] – ảnh người/sản phẩm để AI mô tả chính xác.
export async function generateStoryboard({ apiKey, model = DEFAULT_MODEL, project, sceneCount, templateName = '', images = [], fetchImpl, sleep }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');

  const userPrompt = [
    `Video idea: ${project.idea}`,
    `Video type: ${templateName || project.templateId}`,
    `Number of scenes: ${sceneCount}`,
    `Aspect ratio: ${project.aspectRatio}`,
    `Voice language: ${findById(VOICE_LANGUAGES, project.voiceLanguage).prompt}`,
    project.character ? `Main character (keep it): ${project.character}` : '',
    project.setting ? `Setting (keep it): ${project.setting}` : '',
    project.product ? `Product (keep it): ${project.product}` : '',
    images.length ? `Attached photos, in order: ${images.map((img, i) => `#${i + 1} ${img.role === 'product' ? 'product photo' : 'photo of the main character / presenter'}`).join(', ')}` : '',
  ].filter(Boolean).join('\n');
  const imageParts = images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));

  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      systemInstruction: { parts: [{ text: STORYBOARD_PROMPT }] },
      contents: [{ role: 'user', parts: [...imageParts, { text: userPrompt }] }],
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
    product: json.product || '',
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
// 1b. Nội dung đăng mạng xã hội
// ---------------------------------------------------------------------------

const SOCIAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    youtubeTitle: { type: 'STRING', description: 'Catchy Vietnamese YouTube title, max 90 characters' },
    youtubeDescription: { type: 'STRING', description: 'Vietnamese YouTube description, 3-6 short lines, ends with hashtags' },
    tiktokCaption: { type: 'STRING', description: 'Short Vietnamese TikTok caption with emoji and 3-5 hashtags, max 150 characters' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: '6-10 hashtags starting with #, Vietnamese without diacritics plus a few English' },
  },
  required: ['youtubeTitle', 'youtubeDescription', 'tiktokCaption', 'hashtags'],
};

export async function generateSocialPost({ apiKey, model = DEFAULT_MODEL, project, templateName = '', fetchImpl, sleep }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');
  const summary = [
    `Video type: ${templateName || project.templateId}`,
    `Title: ${project.title}`,
    `Idea: ${project.idea}`,
    'Scenes:',
    ...project.scenes.map((s, i) => `${i + 1}. ${s.title}: ${s.action}${s.dialogue ? ` | "${s.dialogue}"` : ''}`),
  ].join('\n');
  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      systemInstruction: { parts: [{ text: 'You write engaging, honest Vietnamese social media posts for short AI-made videos (YouTube, TikTok, Facebook). Use natural Vietnamese with correct diacritics. No clickbait lies. For kids content keep it parent-friendly. Return ONLY JSON matching the schema.' }] },
      contents: [{ role: 'user', parts: [{ text: summary }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SOCIAL_SCHEMA, temperature: 0.8 },
    },
  });
  const json = parseJson(responseText(data));
  const hashtags = (Array.isArray(json.hashtags) ? json.hashtags : [])
    .map((t) => String(t).trim().replace(/^#*/, '#').replace(/\s+/g, ''))
    .filter((t) => t.length > 1);
  return {
    youtubeTitle: json.youtubeTitle || '',
    youtubeDescription: json.youtubeDescription || '',
    tiktokCaption: json.tiktokCaption || '',
    hashtags,
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

// ---------------------------------------------------------------------------
// 4. Tạo ảnh & tạo video tự động (cần bật thanh toán cho API key)
// ---------------------------------------------------------------------------

// Hỏi Google xem key này dùng được những model nào.
export async function listModels({ apiKey, fetchImpl, sleep }) {
  if (!apiKey) throw new Error('Bạn chưa nhập Gemini API key.');
  const models = [];
  let pageToken = '';
  do {
    const data = await request(`${API_BASE}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { apiKey, fetchImpl, sleep, method: 'GET' });
    models.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return models.map((m) => ({ id: String(m.name || '').replace(/^models\//, ''), methods: m.supportedGenerationMethods || [] }));
}

function firstMatch(ids, patterns) {
  for (const re of patterns) {
    const hit = ids.find((id) => re.test(id));
    if (hit) return hit;
  }
  return '';
}

// Tự chọn model tạo video (Veo) và model tạo ảnh phù hợp nhất trong danh sách.
export function pickModels(models) {
  const video = models.filter((m) => m.methods.includes('predictLongRunning') && /veo/i.test(m.id)).map((m) => m.id);
  const image = models.filter((m) => m.methods.includes('generateContent') && /image/i.test(m.id) && !/imagen/i.test(m.id)).map((m) => m.id);
  return {
    video: firstMatch(video, [/veo-3\.1-fast/, /veo-3\.1-lite/, /veo-3\.1/, /veo-\d.*fast/, /veo/]),
    image: firstMatch(image, [/flash-lite-image/, /flash-image/, /nano-banana/, /image/]),
    omni: models.some((m) => /omni/i.test(m.id)),
  };
}

// Tạo ảnh (khung hình đầu) từ prompt + ảnh tham chiếu người/sản phẩm.
export async function generateImage({ apiKey, model, prompt, images = [], aspectRatio, fetchImpl, sleep }) {
  if (!model) throw new Error('Chưa chọn được model tạo ảnh. Bấm "Kiểm tra key" trước.');
  const data = await request(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    apiKey,
    fetchImpl,
    sleep,
    body: {
      contents: [{ role: 'user', parts: [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), { text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
      },
    },
  });
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || '';
    throw new Error(`AI không tạo được ảnh${reason ? ` (${reason})` : ''}. Thử ảnh khác hoặc viết lại mô tả.`);
  }
  return { mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data };
}

// Bắt đầu tạo video (Veo, chạy nền trên máy chủ Google). Trả về tên "operation" để theo dõi.
export async function startVideo({ apiKey, model, prompt, image, aspectRatio = '16:9', fetchImpl, sleep }) {
  if (!model) throw new Error('Chưa chọn được model tạo video. Bấm "Kiểm tra key" trước.');
  const instance = { prompt };
  if (image) instance.image = { bytesBase64Encoded: image.data, mimeType: image.mimeType };
  const parameters = { aspectRatio };
  if (image) parameters.personGeneration = 'allow_adult';
  const op = await request(`${API_BASE}/${encodeURIComponent(model)}:predictLongRunning`, {
    apiKey,
    fetchImpl,
    sleep,
    body: { instances: [instance], parameters },
  });
  if (!op.name) throw new Error('Google không nhận yêu cầu tạo video.');
  return op.name;
}

// Đợi video tạo xong (thường 1–4 phút), trả về đường dẫn tải video.
export async function waitForVideo({ apiKey, operation, fetchImpl, sleep = wait, interval = 10000, timeout = 10 * 60 * 1000, onTick }) {
  const started = Date.now();
  for (;;) {
    const op = await request(`${API_ROOT}/v1beta/${operation}`, { apiKey, fetchImpl, sleep, method: 'GET' });
    if (op.done) {
      if (op.error) throw new Error(`Tạo video thất bại: ${op.error.message || op.error.code}`);
      const res = op.response?.generateVideoResponse || op.response || {};
      const uri = res.generatedSamples?.[0]?.video?.uri || res.videos?.[0]?.uri || res.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        const reasons = res.raiMediaFilteredReasons?.join(' ') || '';
        throw new Error(`Google chặn video này theo chính sách an toàn${reasons ? `: ${reasons}` : ''}. Hãy đổi ảnh hoặc mô tả cảnh.`);
      }
      return uri;
    }
    const elapsed = Date.now() - started;
    if (elapsed > timeout) throw new Error('Tạo video quá lâu, hãy thử lại cảnh này.');
    onTick?.(elapsed);
    await sleep(interval);
  }
}

// Tải video về trình duyệt. Nếu Google không cho tải trực tiếp, trả về link để người dùng tự mở.
export async function downloadVideo({ apiKey, uri, fetchImpl = fetch }) {
  const withKey = `${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`;
  for (const attempt of [() => fetchImpl(withKey), () => fetchImpl(uri, { headers: { 'x-goog-api-key': apiKey } })]) {
    try {
      const res = await attempt();
      if (res.ok) return { blob: await res.blob(), url: withKey };
    } catch { /* thử cách khác */ }
  }
  return { blob: null, url: withKey };
}
