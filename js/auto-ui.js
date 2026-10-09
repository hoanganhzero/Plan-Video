// Tab "⚡ Tạo nhanh": ảnh người + sản phẩm + ý tưởng → kịch bản → (Flow hoặc tự động) → video.

import { TEMPLATES, VOICE_LANGUAGES, findById } from './templates.js';
import { createProject, scenesFromTemplate } from './prompt-builder.js';
import { renderScene, runAll, estimateCost, STEP_LABELS } from './auto-video.js';
import {
  generateStoryboard, listModels, pickModels, generateImage, startVideo, waitForVideo, downloadVideo, DEFAULT_MODEL,
} from './gemini.js';
import { $, storage, STORAGE_KEYS, escapeHtml, toast, setStatus, fillOptions, getApiKey, slugify, formatDuration } from './ui-utils.js';

const MAX_SIDE = 1024;
const MAX_PHOTOS = 2;

// Thu nhỏ ảnh (tối đa 1024px, JPEG) để gửi nhanh và không vượt giới hạn của API.
async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function initAuto({ adoptProject, getProject, goTo, montage }) {
  const state = { person: [], product: [], running: false, stopRequested: false, results: [] };
  const status = (msg, isError) => setStatus($('#auto-status'), msg, isError);

  // ---------- Tuỳ chọn ----------
  fillOptions($('#auto-template'), TEMPLATES.filter((t) => t.id !== 'custom'), 'product');
  fillOptions($('#auto-voice'), VOICE_LANGUAGES, 'vi-north');
  $('#auto-video-model').value = storage.get(STORAGE_KEYS.videoModel) || '';
  $('#auto-image-model').value = storage.get(STORAGE_KEYS.imageModel) || '';
  $('#auto-video-model').addEventListener('input', (e) => { storage.set(STORAGE_KEYS.videoModel, e.target.value.trim()); showCost(); });
  $('#auto-image-model').addEventListener('input', (e) => storage.set(STORAGE_KEYS.imageModel, e.target.value.trim()));
  $('#auto-scenes').addEventListener('input', showCost);

  function models() {
    return { video: $('#auto-video-model').value.trim(), image: $('#auto-image-model').value.trim() };
  }

  function showCost() {
    const n = Number($('#auto-scenes').value);
    const cost = estimateCost(models().video || 'fast', n);
    $('#auto-cost').textContent = `Ước tính ~${cost.toFixed(2)} USD cho ${n} cảnh (giá tham khảo).`;
  }
  showCost();

  // ---------- Ảnh ----------
  function renderThumbs(role) {
    $(`#auto-${role}-thumbs`).innerHTML = state[role].map((p, i) => `
      <div class="thumb"><img src="${p.preview}" alt="${escapeHtml(p.name)}"><button type="button" data-role="${role}" data-index="${i}" title="Bỏ ảnh">✕</button></div>`).join('');
  }

  for (const role of ['person', 'product']) {
    $(`#auto-${role}`).addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const file of files) {
        if (state[role].length >= MAX_PHOTOS) { toast(`Tối đa ${MAX_PHOTOS} ảnh`); break; }
        try {
          state[role].push(await loadPhoto(file));
        } catch {
          toast(`Không đọc được ảnh ${file.name}`);
        }
      }
      renderThumbs(role);
    });
    $(`#auto-${role}-thumbs`).addEventListener('click', (e) => {
      if (e.target.dataset.index === undefined) return;
      state[role].splice(Number(e.target.dataset.index), 1);
      renderThumbs(role);
    });
  }

  function referenceImages() {
    return {
      person: state.person[0] || null,
      product: state.product[0] || null,
      extra: state.person[1] || state.product[1] || null,
    };
  }

  function storyboardImages() {
    return [
      ...state.person.map((p) => ({ role: 'person', mimeType: p.mimeType, data: p.data })),
      ...state.product.map((p) => ({ role: 'product', mimeType: p.mimeType, data: p.data })),
    ];
  }

  // ---------- Kiểm tra key ----------
  async function checkKey() {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Hãy nhập Gemini API key trước.');
    $('#auto-check-result').textContent = 'Đang kiểm tra…';
    const picked = pickModels(await listModels({ apiKey }));
    if (picked.video) { $('#auto-video-model').value = picked.video; storage.set(STORAGE_KEYS.videoModel, picked.video); }
    if (picked.image) { $('#auto-image-model').value = picked.image; storage.set(STORAGE_KEYS.imageModel, picked.image); }
    showCost();
    $('#auto-check-result').innerHTML = [
      '✓ Key hợp lệ.',
      picked.video ? `Video: <strong>${escapeHtml(picked.video)}</strong>.` : '⚠ Chưa thấy model tạo video (Veo) cho key này.',
      picked.image ? `Ảnh: <strong>${escapeHtml(picked.image)}</strong>.` : '⚠ Chưa thấy model tạo ảnh.',
      !picked.video && picked.omni ? 'Key có model Gemini Omni nhưng ứng dụng chưa hỗ trợ model này.' : '',
      'Lưu ý: model có trong danh sách vẫn có thể yêu cầu bật thanh toán khi tạo video.',
    ].filter(Boolean).join(' ');
    return picked;
  }

  $('#btn-auto-check').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await checkKey(); } catch (err) { $('#auto-check-result').textContent = `✕ ${err.message}`; } finally { e.target.disabled = false; }
  });

  // ---------- Tạo kịch bản ----------
  function validate() {
    if (!$('#auto-idea').value.trim()) {
      status('Hãy viết ý tưởng hoặc mô tả sản phẩm trước nhé.', true);
      $('#auto-idea').focus();
      return false;
    }
    if (state.person.length && !$('#auto-consent').checked) {
      status('Hãy xác nhận bạn có quyền dùng ảnh của người trong ảnh.', true);
      $('#auto-consent').focus();
      return false;
    }
    return true;
  }

  async function buildProject() {
    const template = findById(TEMPLATES, $('#auto-template').value);
    const project = createProject({
      templateId: template.id,
      ...(template.defaults || {}),
      idea: $('#auto-idea').value.trim(),
      aspectRatio: $('#auto-aspect').value,
      voiceLanguage: $('#auto-voice').value,
      referenceMode: state.person.length + state.product.length > 0,
    });
    if (state.person.length || state.product.length) project.styleId = template.id === 'animation' || template.id === 'kidsong' ? project.styleId : 'commercial';
    const count = Number($('#auto-scenes').value);
    const apiKey = getApiKey();
    if (!apiKey) {
      project.scenes = scenesFromTemplate(project, count);
      project.title = project.idea.slice(0, 40);
      return { project, usedAi: false };
    }
    status('AI đang xem ảnh và viết kịch bản…');
    const result = await generateStoryboard({
      apiKey,
      model: storage.get(STORAGE_KEYS.model) || DEFAULT_MODEL,
      project,
      sceneCount: count,
      templateName: template.name,
      images: storyboardImages(),
    });
    Object.assign(project, {
      title: result.title,
      character: result.character,
      setting: result.setting,
      product: result.product,
      scenes: result.scenes.map((s) => ({ ...s, done: false })),
    });
    return { project, usedAi: true };
  }

  // ---------- Làm trong Flow ----------
  $('#btn-auto-flow').addEventListener('click', async (e) => {
    if (!validate() || state.running) return;
    e.target.disabled = true;
    try {
      const { project, usedAi } = await buildProject();
      adoptProject(project, 3);
      status('');
      toast(usedAi ? 'AI đã viết xong kịch bản!' : 'Đã tạo kịch bản từ mẫu (nhập API key để AI viết hay hơn)');
    } catch (err) {
      status(err.message, true);
    } finally {
      e.target.disabled = false;
    }
  });

  // ---------- Tự động hoàn toàn ----------
  function renderCards(project) {
    const wide = project.aspectRatio === '16:9' ? 'wide' : '';
    $('#auto-scenes-list').innerHTML = project.scenes.map((scene, i) => {
      const r = state.results[i] || { status: 'waiting' };
      let media = `<span>${STEP_LABELS[r.status]}${r.status === 'video' && r.elapsed ? ` ${formatDuration(r.elapsed / 1000)}` : ''}</span>`;
      if (r.videoUrl) media = `<video src="${r.videoUrl}" muted playsinline loop autoplay></video>`;
      else if (r.frame) media = `<img src="data:${r.frame.mimeType};base64,${r.frame.data}" alt="">`;
      return `
        <div class="auto-card ${r.status === 'done' || r.status === 'manual' ? 'done' : ''} ${r.status === 'error' ? 'error' : ''}" data-index="${i}">
          <div class="auto-media ${wide}">${media}</div>
          <div class="small"><span class="badge">${i + 1}</span> <strong>${escapeHtml(scene.title)}</strong></div>
          <div class="muted small">${STEP_LABELS[r.status]}</div>
          ${r.status === 'error' ? `<div class="error-text">${escapeHtml(r.error)}</div><button class="secondary small-btn" data-retry>↻ Thử lại</button>` : ''}
          ${r.status === 'manual' ? `<a class="small" href="${r.url}" target="_blank" rel="noopener">⬇ Mở/tải video cảnh ${i + 1}</a>` : ''}
        </div>`;
    }).join('');
  }

  function api(apiKey) {
    return {
      generateImage: (o) => generateImage({ apiKey, ...o }),
      startVideo: (o) => startVideo({ apiKey, ...o }),
      waitForVideo: (o) => waitForVideo({ apiKey, ...o }),
      downloadVideo: (o) => downloadVideo({ apiKey, ...o }),
    };
  }

  function sceneTask(project, i, apiKey) {
    return async () => {
      if (state.stopRequested) return state.results[i];
      const result = await renderScene({
        project,
        scene: project.scenes[i],
        images: referenceImages(),
        api: api(apiKey),
        models: models(),
        onUpdate: (r) => {
          if (state.results[i]?.videoUrl) URL.revokeObjectURL(state.results[i].videoUrl);
          state.results[i] = { ...r, videoUrl: r.blob ? URL.createObjectURL(r.blob) : '' };
          renderCards(project);
        },
      });
      if (result.status === 'done' || result.status === 'manual') {
        project.scenes[i].done = true;
        adoptProject(project, null);
      }
      return result;
    };
  }

  async function finish(project) {
    const ok = state.results.filter((r) => r?.status === 'done');
    const failed = state.results.filter((r) => r?.status === 'error').length;
    const manual = state.results.filter((r) => r?.status === 'manual').length;
    $('#btn-auto-stop').hidden = true;
    $('#btn-auto-open-edit').hidden = false;
    if (ok.length === project.scenes.length) {
      status('Tất cả cảnh đã xong! Đang ghép thành video hoàn chỉnh… (giữ tab mở)');
      await montageNow(project);
    } else {
      $('#btn-auto-montage').hidden = ok.length === 0;
      status([
        `${ok.length}/${project.scenes.length} cảnh đã xong.`,
        failed ? `${failed} cảnh lỗi – bấm “Thử lại” trên cảnh đó.` : '',
        manual ? `${manual} cảnh cần tải thủ công rồi thêm ở tab Ghép phim.` : '',
      ].filter(Boolean).join(' '), failed > 0);
    }
  }

  async function montageNow(project) {
    const files = state.results
      .map((r, i) => (r?.status === 'done' && r.blob ? new File([r.blob], `${String(i + 1).padStart(2, '0')}-${slugify(project.scenes[i].title)}.mp4`, { type: r.blob.type || 'video/mp4' }) : null))
      .filter(Boolean);
    try {
      goTo('edit');
      await montage.loadAndExport(files, { title: project.title, subtitles: true });
    } catch (err) {
      status(err.message, true);
    }
  }

  $('#btn-auto-run').addEventListener('click', async (e) => {
    if (!validate() || state.running) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      $('#auto-settings').open = true;
      status('Chế độ tự động cần Gemini API key đã bật thanh toán.', true);
      $('#auto-api-key').focus();
      return;
    }
    const button = e.target;
    button.disabled = true;
    state.running = true;
    state.stopRequested = false;
    try {
      if (!models().video) await checkKey();
      if (!models().video) throw new Error('Key này chưa dùng được model tạo video. Hãy bật thanh toán hoặc kiểm tra lại key.');
      const n = Number($('#auto-scenes').value);
      const cost = estimateCost(models().video, n);
      if (!confirm(`Tạo ${n} cảnh bằng ${models().video}.\nChi phí ước tính khoảng ${cost.toFixed(2)} USD (tính vào tài khoản Google Cloud của bạn).\nTiếp tục?`)) return;

      const { project } = await buildProject();
      adoptProject(project, null);
      state.results.forEach((r) => r?.videoUrl && URL.revokeObjectURL(r.videoUrl));
      state.results = project.scenes.map(() => ({ status: 'waiting' }));
      $('#auto-progress').hidden = false;
      $('#btn-auto-stop').hidden = false;
      $('#btn-auto-montage').hidden = true;
      $('#btn-auto-open-edit').hidden = true;
      renderCards(project);
      status(`Đang tạo “${project.title}”…`);
      $('#auto-progress').scrollIntoView({ behavior: 'smooth' });

      await runAll(project.scenes.map((_, i) => sceneTask(project, i, apiKey)), 2);
      await finish(project);
    } catch (err) {
      status(err.message, true);
    } finally {
      state.running = false;
      button.disabled = false;
    }
  });

  $('#auto-scenes-list').addEventListener('click', async (e) => {
    if (!e.target.matches('[data-retry]') || state.running) return;
    const i = Number(e.target.closest('.auto-card').dataset.index);
    const apiKey = getApiKey();
    const project = getProject();
    state.running = true;
    try {
      await sceneTask(project, i, apiKey)();
      await finish(project);
    } finally {
      state.running = false;
    }
  });

  $('#btn-auto-stop').addEventListener('click', () => {
    state.stopRequested = true;
    status('Sẽ dừng sau khi các cảnh đang tạo xong (không huỷ được cảnh đã gửi cho Google).');
  });

  $('#btn-auto-montage').addEventListener('click', () => montageNow(getProject()));
  $('#btn-auto-open-edit').addEventListener('click', async () => {
    const project = getProject();
    goTo('edit');
    const files = state.results
      .map((r, i) => (r?.blob ? new File([r.blob], `${String(i + 1).padStart(2, '0')}.mp4`, { type: r.blob.type || 'video/mp4' }) : null))
      .filter(Boolean);
    if (files.length) await montage.loadClips(files, project.title);
  });
}
