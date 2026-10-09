// Logic lồng tiếng thuần (không phụ thuộc trình duyệt) để dễ kiểm thử:
// chuẩn hoá đoạn thoại, tạo phụ đề SRT, xếp lịch giọng đọc, mã hoá WAV.

import { VOICE_LANGUAGES, findById } from './templates.js';
import { SECONDS_PER_CLIP } from './prompt-builder.js';

// Giọng đọc có sẵn của Gemini TTS (đều đọc được tiếng Việt).
export const VOICES = [
  { id: 'Kore', name: 'Kore – nữ, rõ ràng', gender: 'female' },
  { id: 'Aoede', name: 'Aoede – nữ, nhẹ nhàng', gender: 'female' },
  { id: 'Leda', name: 'Leda – nữ, trẻ trung', gender: 'female' },
  { id: 'Despina', name: 'Despina – nữ, ấm áp', gender: 'female' },
  { id: 'Charon', name: 'Charon – nam, trầm', gender: 'male' },
  { id: 'Puck', name: 'Puck – nam, vui vẻ', gender: 'male' },
  { id: 'Orus', name: 'Orus – nam, chắc chắn', gender: 'male' },
  { id: 'Fenrir', name: 'Fenrir – nam, sôi nổi', gender: 'male' },
];

const DEFAULT_VOICE = { female: ['Kore', 'Aoede', 'Despina'], male: ['Charon', 'Puck', 'Orus'], child: ['Leda', 'Puck'] };

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Chuẩn hoá danh sách đoạn thoại (từ AI hoặc người dùng nhập), sắp xếp theo thời gian.
export function normalizeSegments(raw) {
  return (raw || [])
    .map((s) => {
      const start = num(s.start);
      return {
        start,
        end: Math.max(start + 0.5, num(s.end, start + 2)),
        speaker: String(s.speaker || 'Người nói 1').trim(),
        gender: ['male', 'female', 'child'].includes(s.gender) ? s.gender : 'female',
        original: String(s.original || ''),
        vietnamese: String(s.vietnamese || '').trim(),
      };
    })
    .filter((s) => s.vietnamese || s.original)
    .sort((a, b) => a.start - b.start);
}

// Gán giọng mặc định cho mỗi người nói, khác nhau theo giới tính.
export function assignVoices(segments, existing = {}) {
  const map = { ...existing };
  const used = { female: 0, male: 0, child: 0 };
  for (const seg of segments) {
    if (map[seg.speaker]) continue;
    const pool = DEFAULT_VOICE[seg.gender] || DEFAULT_VOICE.female;
    map[seg.speaker] = pool[used[seg.gender]++ % pool.length];
  }
  return map;
}

// Tạo đoạn thoại từ kịch bản Flow: mỗi cảnh có lời (không phải lời hát) bắt đầu ở giây i*8.
export function segmentsFromProject(project) {
  return project.scenes
    .map((scene, i) => ({ scene, i }))
    .filter(({ scene }) => scene.dialogue && scene.dialogue.trim() && scene.voiceType !== 'sing')
    .map(({ scene, i }) => ({
      start: i * SECONDS_PER_CLIP + 0.5,
      end: (i + 1) * SECONDS_PER_CLIP - 0.5,
      speaker: scene.voiceType === 'narration' ? 'Người dẫn chuyện' : 'Nhân vật',
      gender: 'female',
      original: '',
      vietnamese: scene.dialogue.trim(),
    }));
}

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

export function formatSrtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

export function toSrt(segments) {
  return segments
    .filter((s) => s.vietnamese)
    .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.vietnamese}\n`)
    .join('\n');
}

// Đặt từng clip giọng đọc vào đúng thời điểm. Nếu câu trước đọc chưa xong thì câu sau
// lùi lại (không chồng tiếng) và báo độ trễ để người dùng rút gọn câu dịch nếu cần.
export function layoutClips(items) {
  let cursor = 0;
  return items.map(({ start, duration }) => {
    const at = Math.max(start, cursor);
    cursor = at + duration;
    return { at, duration, delay: at - start };
  });
}

// Hướng dẫn cho Gemini TTS để đọc đúng giọng tiếng Việt.
export function ttsInstruction(voiceLanguageId, text, speaker = '') {
  const lang = findById(VOICE_LANGUAGES, voiceLanguageId);
  const who = speaker ? ` as ${speaker}` : '';
  return `Read the following line aloud${who} in ${lang.tts}, with correct tones, natural and expressive, at a natural conversational pace. Only say the line itself:\n${text}`;
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// PCM 16-bit little-endian (định dạng Gemini TTS trả về) → Float32 [-1, 1].
export function pcm16ToFloat32(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

export function parseSampleRate(mimeType, fallback = 24000) {
  const m = /rate=(\d+)/.exec(mimeType || '');
  return m ? Number(m[1]) : fallback;
}

// Mã hoá các kênh Float32 thành file WAV 16-bit.
export function encodeWav(channels, sampleRate) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

// Lệnh ffmpeg ghép giọng lồng tiếng vào video gốc thành MP4 (cho ai muốn chất lượng cao nhất).
export function ffmpegCommand(videoName, wavName = 'long-tieng.wav', srtName = '') {
  const out = `${videoName.replace(/\.[^.]+$/, '')}-long-tieng-viet.mp4`;
  const inputs = `-i "${videoName}" -i "${wavName}"${srtName ? ` -i "${srtName}"` : ''}`;
  const maps = `-map 0:v -map 1:a${srtName ? ' -map 2:s -c:s mov_text -metadata:s:s:0 language=vie' : ''}`;
  return `ffmpeg ${inputs} ${maps} -c:v copy -c:a aac -shortest "${out}"`;
}
