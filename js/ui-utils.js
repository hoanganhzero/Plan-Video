// Tiện ích giao diện dùng chung giữa các tab.

export const $ = (sel) => document.querySelector(sel);

export const STORAGE_KEYS = {
  apiKey: 'plan-video:gemini-key',
  model: 'plan-video:gemini-model',
  ttsModel: 'plan-video:gemini-tts-model',
  dubLanguage: 'plan-video:dub-language',
  videoModel: 'plan-video:video-model',
  imageModel: 'plan-video:image-model',
};

export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* chế độ ẩn danh hoặc đầy bộ nhớ */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* bỏ qua */ } },
};

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

export function setStatus(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle('error', isError);
}

export function fillOptions(select, list, selected) {
  select.innerHTML = list.map((o) => `<option value="${o.id}" ${o.id === selected ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
}

export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(text, fallback = 'video') {
  const slug = (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || fallback;
}

export function getApiKey() {
  return (storage.get(STORAGE_KEYS.apiKey) || '').trim();
}

// Mọi ô nhập API key (bước 1 và tab lồng tiếng) dùng chung một giá trị.
export function bindApiKeyInputs() {
  const inputs = document.querySelectorAll('.api-key');
  inputs.forEach((input) => {
    input.value = getApiKey();
    input.addEventListener('input', () => {
      storage.set(STORAGE_KEYS.apiKey, input.value.trim());
      inputs.forEach((other) => { if (other !== input) other.value = input.value; });
    });
  });
}

export async function copyText(text, message = 'Đã sao chép!') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(message);
}

// Định dạng ghi video tốt nhất trình duyệt hỗ trợ.
// Ưu tiên MP4 có H.264 (xem được trên mọi điện thoại), rồi WebM. "video/mp4" trơn để cuối
// cho Safari (không ghi được WebM), vì trên Chromium nó có thể chứa VP9 khó xem trên iPhone.
export function pickRecorderType() {
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1,opus',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find((t) => window.MediaRecorder?.isTypeSupported(t)) || '';
}

export function recorderExtension(mimeType) {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
