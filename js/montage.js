// Logic ghép phim thuần (không phụ thuộc trình duyệt): dòng thời gian, phụ đề,
// hiệu ứng chuyển cảnh, khung hình. Phần vẽ và ghi video nằm ở montage-ui.js.

import { formatSrtTime } from './dubbing.js';

export const OUTPUT_SIZES = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 },
};

export function outputSize(aspect) {
  return OUTPUT_SIZES[aspect] || OUTPUT_SIZES['16:9'];
}

// Tính vị trí từng clip trên dòng thời gian sau khi cắt đầu/cuối.
export function computeTimeline(clips) {
  let cursor = 0;
  const items = clips.map((clip) => {
    const duration = Math.max(0, Number(clip.duration) || 0);
    const inPoint = Math.min(Math.max(0, Number(clip.trimStart) || 0), duration);
    const outPoint = Math.max(inPoint, duration - Math.max(0, Number(clip.trimEnd) || 0));
    const length = outPoint - inPoint;
    const item = { start: cursor, end: cursor + length, inPoint, outPoint, length };
    cursor += length;
    return item;
  });
  return { items, total: cursor };
}

// Phụ đề từ kịch bản: clip thứ i hiện lời thoại/lời hát của cảnh thứ i.
export function subtitlesFromProject(project, timeline) {
  return timeline.items
    .map((item, i) => {
      const text = (project.scenes[i]?.dialogue || '').trim();
      if (!text || item.length <= 0) return null;
      return { start: item.start + Math.min(0.3, item.length / 4), end: item.end - Math.min(0.3, item.length / 4), text };
    })
    .filter(Boolean);
}

function parseTime(text) {
  const m = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(text);
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
}

export function parseSrt(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.trim().split('\n');
      const timeIndex = lines.findIndex((l) => l.includes('-->'));
      if (timeIndex < 0) return null;
      const [a, b] = lines[timeIndex].split('-->');
      const start = parseTime(a);
      const end = parseTime(b);
      const body = lines.slice(timeIndex + 1).join('\n').trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || !body) return null;
      return { start, end, text: body };
    })
    .filter(Boolean);
}

export function toSrtFromCaptions(captions) {
  return captions.map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}\n`).join('\n');
}

export function activeCaption(captions, t) {
  return captions.find((c) => t >= c.start && t < c.end) || null;
}

// Độ mờ của lớp đen chuyển cảnh: 1 ở mép clip, 0 ở giữa (fade-in đầu phim, fade-out cuối phim).
export function fadeAlpha(t, item, fade) {
  if (!fade || item.length <= 0) return 0;
  const f = Math.min(fade, item.length / 2);
  const fromStart = t - item.start;
  const toEnd = item.end - t;
  if (fromStart < f) return 1 - fromStart / f;
  if (toEnd < f) return 1 - toEnd / f;
  return 0;
}

// Tiêu đề mở đầu: hiện dần 0.5s, giữ, mờ dần 0.5s cuối.
export function titleAlpha(t, duration) {
  if (t < 0 || t >= duration) return 0;
  const edge = Math.min(0.5, duration / 3);
  return Math.min(1, t / edge, (duration - t) / edge);
}

// Cắt khung nguồn để lấp đầy khung đích mà không méo hình (giống object-fit: cover).
export function coverRect(srcW, srcH, dstW, dstH) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

// Xuống dòng phụ đề theo chiều rộng tối đa; `measure` trả về độ rộng của chuỗi.
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
