// Tiện ích giao diện dùng chung giữa các tab.

export const $ = (sel) => document.querySelector(sel);

export const STORAGE_KEYS = {
  project: 'plan-video:project',
  apiKey: 'plan-video:gemini-key',
  model: 'plan-video:gemini-model',
  ttsModel: 'plan-video:gemini-tts-model',
  dubLanguage: 'plan-video:dub-language',
};

export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* chế độ ẩn danh */ } },
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
