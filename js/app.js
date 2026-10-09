import { TEMPLATES, STYLES, MOODS, VOICE_LANGUAGES, VOICE_TYPES, findById } from './templates.js';
import {
  createProject, scenesFromTemplate, buildAllPrompts, totalDuration, exportText, MAX_SCENES,
  buildCharacterSheetPrompt, buildFramePrompt, progress,
} from './prompt-builder.js';
import { createLibrary } from './projects.js';
import { socialFallback } from './social.js';
import { generateStoryboard, generateSocialPost, DEFAULT_MODEL } from './gemini.js';
import {
  $, storage, STORAGE_KEYS, escapeHtml, toast, setStatus as setStatusEl, fillOptions, download, slugify,
  bindApiKeyInputs, getApiKey, copyText,
} from './ui-utils.js';
import { initDubbing } from './dub-ui.js';
import { initMontage } from './montage-ui.js';

const library = createLibrary(storage);
let project = library.openCurrent();
library.setCurrent(project.id);

function save() {
  library.save(project);
  $('#current-project-name').textContent = project.title || 'Video không tên';
}

function setStatus(message, isError = false) {
  setStatusEl($('#status'), message, isError);
}

// ---------- Điều hướng ----------
const NAMED_STEPS = ['guide', 'dub', 'edit', 'projects'];

function goTo(step) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `step-${step}`));
  document.querySelectorAll('.step').forEach((b) => {
    const active = b.dataset.step === String(step);
    b.classList.toggle('active', active);
    if (active) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  if (step === 2) renderScenes();
  if (step === 3) renderPrompts();
  if (step === 'projects') renderProjects();
  if (step === 'edit') montage.refresh();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.step').forEach((btn) => {
  btn.addEventListener('click', () => {
    const step = btn.dataset.step;
    if ((step === '2' || step === '3') && project.scenes.length === 0) {
      toast('Hãy tạo kịch bản ở bước 1 trước nhé');
      return;
    }
    goTo(NAMED_STEPS.includes(step) ? step : Number(step));
  });
});

// ---------- Bước 1: form ý tưởng ----------
function renderTemplates() {
  $('#template-list').innerHTML = TEMPLATES.map((t) => `
    <button type="button" class="card ${t.id === project.templateId ? 'selected' : ''}" data-id="${t.id}">
      <span class="icon">${t.icon}</span>
      <span class="name">${escapeHtml(t.name)}</span>
      <span class="desc">${escapeHtml(t.description)}</span>
    </button>`).join('');
  renderIdeas();
}

function renderIdeas() {
  const ideas = findById(TEMPLATES, project.templateId).ideas || [];
  $('#idea-suggestions').innerHTML = ideas.length
    ? `<span class="muted">💡 Gợi ý:</span> ${ideas.map((idea) => `<button type="button" class="chip" data-idea="${escapeHtml(idea)}">${escapeHtml(idea)}</button>`).join('')}`
    : '';
}

$('#idea-suggestions').addEventListener('click', (e) => {
  const idea = e.target.dataset.idea;
  if (!idea) return;
  project.idea = idea;
  $('#idea').value = idea;
  save();
});

$('#template-list').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const template = findById(TEMPLATES, card.dataset.id);
  project.templateId = template.id;
  Object.assign(project, template.defaults || {});
  $('#style').value = project.styleId;
  $('#mood').value = project.moodId;
  $('#scene-count').value = template.beats.length;
  renderTemplates();
  save();
});

const FIELDS = {
  '#idea': 'idea',
  '#title': 'title',
  '#character': 'character',
  '#setting': 'setting',
  '#music': 'music',
  '#style': 'styleId',
  '#mood': 'moodId',
  '#aspect': 'aspectRatio',
  '#voice-language': 'voiceLanguage',
};

// Đưa dữ liệu dự án lên form (gọi lại khi đổi dự án hoặc mở file .json).
function syncForm() {
  renderTemplates();
  fillOptions($('#style'), STYLES, project.styleId);
  fillOptions($('#mood'), MOODS, project.moodId);
  fillOptions($('#voice-language'), VOICE_LANGUAGES, project.voiceLanguage);
  for (const [sel, key] of Object.entries(FIELDS)) $(sel).value = project[key];
  $('#scene-count').value = project.scenes.length || findById(TEMPLATES, project.templateId).beats.length;
  $('#current-project-name').textContent = project.title || 'Video không tên';
  $('#social-output').innerHTML = '';
  setStatus('');
}

function bindForm() {
  for (const [sel, key] of Object.entries(FIELDS)) {
    $(sel).addEventListener('input', (e) => { project[key] = e.target.value; save(); });
  }
  bindApiKeyInputs();
  $('#model').value = storage.get(STORAGE_KEYS.model) || '';
  $('#model').addEventListener('input', (e) => storage.set(STORAGE_KEYS.model, e.target.value.trim()));
}

function sceneCount() {
  const n = parseInt($('#scene-count').value, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_SCENES, n)) : 6;
}

function requireIdea() {
  if (project.idea.trim()) return true;
  setStatus('Hãy viết ý tưởng video trước nhé (hoặc bấm một gợi ý).', true);
  $('#idea').focus();
  return false;
}

function confirmOverwrite() {
  return project.scenes.length === 0 || confirm('Tạo lại sẽ thay thế kịch bản hiện tại. Tiếp tục?');
}

$('#btn-template').addEventListener('click', () => {
  if (!requireIdea() || !confirmOverwrite()) return;
  project.scenes = scenesFromTemplate(project, sceneCount());
  save();
  setStatus('');
  goTo(2);
});

function requireKeyFor(statusFn, focusBox) {
  const apiKey = getApiKey();
  if (apiKey) return apiKey;
  if (focusBox) focusBox.open = true;
  statusFn('Hãy nhập Gemini API key (miễn phí) ở bước 1 để dùng AI.', true);
  return '';
}

$('#btn-ai').addEventListener('click', async () => {
  if (!requireIdea()) return;
  const apiKey = requireKeyFor(setStatus, $('#ai-box'));
  if (!apiKey) return $('#api-key').focus();
  if (!confirmOverwrite()) return;

  const btn = $('#btn-ai');
  btn.disabled = true;
  setStatus('AI đang viết kịch bản…');
  try {
    const result = await generateStoryboard({
      apiKey,
      model: $('#model').value.trim() || DEFAULT_MODEL,
      project,
      sceneCount: sceneCount(),
      templateName: findById(TEMPLATES, project.templateId).name,
    });
    project.scenes = result.scenes.map((s) => ({ ...s, done: false }));
    if (!project.title.trim()) project.title = result.title;
    if (!project.character.trim()) project.character = result.character;
    if (!project.setting.trim()) project.setting = result.setting;
    ['#title', '#character', '#setting'].forEach((sel) => { $(sel).value = project[FIELDS[sel]]; });
    save();
    setStatus('');
    goTo(2);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Bước 2: sửa kịch bản ----------
const SCENE_FIELDS = [
  { key: 'camera', label: 'Góc máy', placeholder: 'VD: Close-up, slow push-in' },
  { key: 'action', label: 'Hành động / nội dung cảnh', placeholder: 'Mô tả điều xảy ra trong cảnh', rows: 3 },
  { key: 'voiceType', label: 'Loại giọng', options: VOICE_TYPES },
  { key: 'dialogue', label: 'Lời thoại / lời hát (tiếng Việt có dấu)', placeholder: 'VD: Chào buổi sáng!' },
  { key: 'sound', label: 'Âm thanh (không bắt buộc)', placeholder: 'VD: birds chirping, coffee pouring' },
];

function renderScenes() {
  $('#duration').textContent = `Tổng: ${project.scenes.length} cảnh · khoảng ${totalDuration(project)} giây.`;
  $('#scene-list').innerHTML = project.scenes.map((scene, i) => `
    <div class="scene" data-index="${i}">
      <div class="scene-head">
        <span class="badge">Cảnh ${i + 1}</span>
        <input data-key="title" value="${escapeHtml(scene.title)}" aria-label="Tên cảnh">
        <span>
          <button class="icon-btn" data-act="up" title="Lên" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-act="down" title="Xuống" ${i === project.scenes.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-act="copy" title="Nhân đôi cảnh">⧉</button>
          <button class="icon-btn" data-act="delete" title="Xoá">🗑</button>
        </span>
      </div>
      ${scene.goal ? `<p class="goal">💡 ${escapeHtml(scene.goal)}</p>` : ''}
      <div class="grid">
        ${SCENE_FIELDS.map((f) => `
          <label class="${f.rows ? 'full' : ''}">${f.label}
            ${f.options
              ? `<select data-key="${f.key}">${f.options.map((o) => `<option value="${o.id}" ${o.id === (scene[f.key] || 'dialogue') ? 'selected' : ''}>${o.name}</option>`).join('')}</select>`
              : f.rows
              ? `<textarea data-key="${f.key}" rows="${f.rows}" placeholder="${escapeHtml(f.placeholder)}">${escapeHtml(scene[f.key])}</textarea>`
              : `<input data-key="${f.key}" value="${escapeHtml(scene[f.key])}" placeholder="${escapeHtml(f.placeholder)}">`}
          </label>`).join('')}
      </div>
    </div>`).join('');
}

$('#scene-list').addEventListener('input', (e) => {
  const key = e.target.dataset.key;
  const box = e.target.closest('.scene');
  if (!key || !box) return;
  project.scenes[Number(box.dataset.index)][key] = e.target.value;
  save();
});

$('#scene-list').addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  const box = e.target.closest('.scene');
  if (!act || !box) return;
  const i = Number(box.dataset.index);
  const scenes = project.scenes;
  if (act === 'delete') {
    if (scenes.length === 1) return toast('Cần ít nhất 1 cảnh');
    if (!confirm(`Xoá cảnh ${i + 1}?`)) return;
    scenes.splice(i, 1);
  } else if (act === 'copy') {
    if (scenes.length >= MAX_SCENES) return toast(`Tối đa ${MAX_SCENES} cảnh`);
    scenes.splice(i + 1, 0, { ...scenes[i], title: `${scenes[i].title} (2)`, done: false });
  } else {
    const j = act === 'up' ? i - 1 : i + 1;
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
  }
  save();
  renderScenes();
});

$('#btn-add-scene').addEventListener('click', () => {
  if (project.scenes.length >= MAX_SCENES) return toast(`Tối đa ${MAX_SCENES} cảnh`);
  project.scenes.push({ title: `Cảnh ${project.scenes.length + 1}`, goal: '', camera: 'Medium shot', action: '', voiceType: 'dialogue', dialogue: '', sound: '', done: false });
  save();
  renderScenes();
});

$('#btn-to-prompts').addEventListener('click', () => goTo(3));

// ---------- Bước 3: prompt cho Flow ----------
function renderProgress() {
  const p = progress(project);
  $('#progress-text').textContent = `${p.done}/${p.total} cảnh${p.total && p.done === p.total ? ' 🎉' : ''}`;
  $('#progress-bar').style.width = `${p.percent}%`;
}

function renderPrompts() {
  $('#aspect-hint').textContent = project.aspectRatio;
  renderProgress();

  const sheet = buildCharacterSheetPrompt(project);
  $('#character-card').innerHTML = sheet
    ? `<div class="prompt-card highlight">
        <div class="prompt-head">
          <span>🧍 <strong>Ảnh nhân vật tham chiếu</strong> <span class="muted small">– tạo 1 lần, dùng cho mọi cảnh (Ingredients to Video)</span></span>
          <button class="secondary" data-copy-sheet>📋 Sao chép</button>
        </div>
        <pre class="prompt-text">${escapeHtml(sheet)}</pre>
      </div>`
    : '<p class="muted small">💡 Thêm “Mô tả nhân vật chính” ở bước 1 để có prompt ảnh nhân vật tham chiếu, giúp nhân vật giống nhau ở mọi cảnh.</p>';

  $('#prompt-list').innerHTML = buildAllPrompts(project).map((p, i) => {
    const scene = project.scenes[i];
    return `
    <div class="prompt-card ${scene.done ? 'done' : ''}" data-index="${i}">
      <div class="prompt-head">
        <span><span class="badge">Cảnh ${p.index}</span> <strong>${escapeHtml(p.title)}</strong></span>
        <span class="prompt-actions">
          <label class="check"><input type="checkbox" data-done ${scene.done ? 'checked' : ''}> Đã tạo xong</label>
          <button class="secondary" data-copy>📋 Sao chép</button>
        </span>
      </div>
      <pre class="prompt-text">${escapeHtml(p.prompt)}</pre>
      <details class="frame">
        <summary>🖼️ Prompt ảnh khung đầu (Frames to Video)</summary>
        <pre class="prompt-text">${escapeHtml(buildFramePrompt(project, scene))}</pre>
        <button class="secondary small-btn" data-copy-frame>📋 Sao chép prompt ảnh</button>
      </details>
    </div>`;
  }).join('');
}

$('#character-card').addEventListener('click', (e) => {
  if (e.target.closest('[data-copy-sheet]')) copyText(buildCharacterSheetPrompt(project), 'Đã sao chép! Tạo ảnh trong Flow hoặc Gemini nhé');
});

$('#prompt-list').addEventListener('click', (e) => {
  const card = e.target.closest('.prompt-card');
  if (!card) return;
  const i = Number(card.dataset.index);
  if (e.target.closest('[data-copy]')) copyText(buildAllPrompts(project)[i].prompt, 'Đã sao chép! Dán vào Google Flow nhé');
  if (e.target.closest('[data-copy-frame]')) copyText(buildFramePrompt(project, project.scenes[i]), 'Đã sao chép prompt ảnh!');
});

$('#prompt-list').addEventListener('change', (e) => {
  if (!e.target.matches('[data-done]')) return;
  const card = e.target.closest('.prompt-card');
  project.scenes[Number(card.dataset.index)].done = e.target.checked;
  card.classList.toggle('done', e.target.checked);
  save();
  renderProgress();
  if (progress(project).percent === 100) toast('Xong tất cả cảnh! Sang tab “4. Ghép phim” nhé 🎉');
});

$('#btn-copy-all').addEventListener('click', () => copyText(exportText(project), 'Đã sao chép tất cả prompt!'));

function fileBase() {
  return slugify(project.title);
}

$('#btn-export-txt').addEventListener('click', () => download(`${fileBase()}.txt`, exportText(project), 'text/plain;charset=utf-8'));
$('#btn-export-json').addEventListener('click', () => download(`${fileBase()}.json`, JSON.stringify(project, null, 2), 'application/json'));

// ---------- Đăng mạng xã hội ----------
const SOCIAL_FIELDS = [
  { key: 'youtubeTitle', label: 'Tiêu đề YouTube' },
  { key: 'youtubeDescription', label: 'Mô tả YouTube / Facebook', rows: 6 },
  { key: 'tiktokCaption', label: 'Chú thích TikTok / Reels', rows: 2 },
  { key: 'hashtags', label: 'Hashtag' },
];

function renderSocial(post) {
  const value = (key) => (key === 'hashtags' ? post.hashtags.join(' ') : post[key]);
  $('#social-output').innerHTML = SOCIAL_FIELDS.map((f) => `
    <div class="social-field">
      <div class="prompt-head"><strong>${f.label}</strong><button class="secondary small-btn" data-social="${f.key}">📋 Sao chép</button></div>
      <textarea data-social-text="${f.key}" rows="${f.rows || 1}">${escapeHtml(value(f.key))}</textarea>
    </div>`).join('');
}

$('#social-output').addEventListener('click', (e) => {
  const key = e.target.dataset.social;
  if (key) copyText($(`[data-social-text="${key}"]`).value);
});

$('#btn-social').addEventListener('click', () => renderSocial(socialFallback(project)));

$('#btn-social-ai').addEventListener('click', async () => {
  const status = (msg, err) => setStatusEl($('#social-status'), msg, err);
  const apiKey = requireKeyFor(status);
  if (!apiKey) return;
  const btn = $('#btn-social-ai');
  btn.disabled = true;
  status('AI đang viết…');
  try {
    renderSocial(await generateSocialPost({
      apiKey,
      model: $('#model').value.trim() || DEFAULT_MODEL,
      project,
      templateName: findById(TEMPLATES, project.templateId).name,
    }));
    status('');
  } catch (err) {
    status(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Dự án ----------
function openProject(next, step = 1) {
  project = next;
  library.setCurrent(project.id);
  syncForm();
  goTo(step);
}

function newProject() {
  const fresh = createProject();
  library.save(fresh);
  openProject(fresh, 1);
  toast('Đã tạo dự án mới');
}

function renderProjects() {
  const list = library.list();
  $('#project-list').innerHTML = list.length ? list.map((p) => {
    const template = findById(TEMPLATES, p.templateId);
    const prog = progress(createProject(p));
    const date = p.updatedAt ? new Date(p.updatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
    return `
      <div class="project-card ${p.id === project.id ? 'current' : ''}" data-id="${p.id}">
        <div class="project-title">${template.icon} <strong>${escapeHtml(p.title || p.idea || 'Video không tên')}</strong></div>
        <div class="muted small">${escapeHtml(template.name)} · ${p.scenes.length} cảnh · ${date}</div>
        <div class="progress-track small"><div class="progress-fill" style="width:${prog.percent}%"></div></div>
        <div class="muted small">${prog.done}/${prog.total} cảnh đã tạo trong Flow${p.id === project.id ? ' · <strong>đang mở</strong>' : ''}</div>
        <div class="project-actions">
          <button class="secondary small-btn" data-proj="open">Mở</button>
          <button class="secondary small-btn" data-proj="duplicate">Nhân bản</button>
          <button class="secondary small-btn danger" data-proj="delete">Xoá</button>
        </div>
      </div>`;
  }).join('') : '<p class="muted">Chưa có dự án nào.</p>';
}

$('#project-list').addEventListener('click', (e) => {
  const act = e.target.dataset.proj;
  const card = e.target.closest('.project-card');
  if (!act || !card) return;
  const id = card.dataset.id;
  if (act === 'open') {
    openProject(library.get(id), library.get(id).scenes.length ? 3 : 1);
  } else if (act === 'duplicate') {
    library.duplicate(id);
    renderProjects();
    toast('Đã nhân bản dự án');
  } else if (act === 'delete') {
    const target = library.get(id);
    if (!confirm(`Xoá vĩnh viễn dự án “${target.title || 'Video không tên'}”?`)) return;
    library.remove(id);
    if (id === project.id) {
      project = library.openCurrent();
      library.save(project);
      library.setCurrent(project.id);
      syncForm();
    }
    renderProjects();
  }
});

$('#btn-new-project').addEventListener('click', newProject);
$('#btn-new-project-2').addEventListener('click', newProject);

async function importProject(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.scenes)) throw new Error();
    // Nếu đã có dự án cùng mã thì nhập thành bản mới để không ghi đè.
    const imported = createProject({ ...data, id: library.get(data.id) ? undefined : data.id });
    if (!imported.id) imported.id = createProject().id;
    library.save(imported);
    openProject(imported, 3);
    toast('Đã mở dự án');
  } catch {
    toast('File không hợp lệ');
  }
}

$('#import-json').addEventListener('change', importProject);
$('#import-json-2').addEventListener('change', importProject);

// ---------- Lồng tiếng & ghép phim ----------
const dubbing = initDubbing({ getVoiceLanguage: () => project.voiceLanguage });
const montage = initMontage({ getProject: () => project });

$('#btn-voice-script').addEventListener('click', () => {
  if (!dubbing.loadFromProject(project)) {
    toast('Chưa có lời thoại/thuyết minh nào trong kịch bản (lời hát không đọc được)');
    return;
  }
  goTo('dub');
});

// ---------- Cài như ứng dụng (PWA) ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

bindForm();
syncForm();
save();
