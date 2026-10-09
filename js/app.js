import { TEMPLATES, STYLES, MOODS, VOICE_LANGUAGES, VOICE_TYPES, findById } from './templates.js';
import { createProject, scenesFromTemplate, buildAllPrompts, totalDuration, exportText, MAX_SCENES } from './prompt-builder.js';
import { generateStoryboard, DEFAULT_MODEL } from './gemini.js';
import { $, storage, STORAGE_KEYS, escapeHtml, toast, setStatus as setStatusEl, fillOptions, download, slugify, bindApiKeyInputs, getApiKey } from './ui-utils.js';
import { initDubbing } from './dub-ui.js';

let project = loadProject();

function loadProject() {
  try {
    const saved = JSON.parse(storage.get(STORAGE_KEYS.project));
    if (saved && typeof saved === 'object') return createProject(saved);
  } catch { /* bỏ qua dữ liệu hỏng */ }
  return createProject();
}

function save() {
  storage.set(STORAGE_KEYS.project, JSON.stringify(project));
}

function setStatus(message, isError = false) {
  setStatusEl($('#status'), message, isError);
}

// ---------- Điều hướng ----------
function goTo(step) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `step-${step}`));
  document.querySelectorAll('.step').forEach((b) => b.classList.toggle('active', b.dataset.step === String(step)));
  if (step === 2) renderScenes();
  if (step === 3) renderPrompts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.step').forEach((btn) => {
  btn.addEventListener('click', () => {
    const step = btn.dataset.step;
    if ((step === '2' || step === '3') && project.scenes.length === 0) {
      toast('Hãy tạo kịch bản ở bước 1 trước nhé');
      return;
    }
    goTo(['guide', 'dub'].includes(step) ? step : Number(step));
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
}

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

// Đưa dữ liệu dự án lên form (gọi lại được nhiều lần, ví dụ khi mở file .json).
function syncForm() {
  renderTemplates();
  fillOptions($('#style'), STYLES, project.styleId);
  fillOptions($('#mood'), MOODS, project.moodId);
  fillOptions($('#voice-language'), VOICE_LANGUAGES, project.voiceLanguage);
  for (const [sel, key] of Object.entries(FIELDS)) $(sel).value = project[key];
  $('#scene-count').value = project.scenes.length || findById(TEMPLATES, project.templateId).beats.length;
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
  setStatus('Hãy viết ý tưởng video trước nhé.', true);
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

$('#btn-ai').addEventListener('click', async () => {
  if (!requireIdea()) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    $('#ai-box').open = true;
    setStatus('Hãy nhập Gemini API key (miễn phí) để dùng AI.', true);
    $('#api-key').focus();
    return;
  }
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
    project.scenes = result.scenes;
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
    scenes.splice(i, 1);
  } else {
    const j = act === 'up' ? i - 1 : i + 1;
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
  }
  save();
  renderScenes();
});

$('#btn-add-scene').addEventListener('click', () => {
  project.scenes.push({ title: `Cảnh ${project.scenes.length + 1}`, goal: '', camera: 'Medium shot', action: '', voiceType: 'dialogue', dialogue: '', sound: '' });
  save();
  renderScenes();
});

$('#btn-to-prompts').addEventListener('click', () => goTo(3));

// ---------- Bước 3: prompt cho Flow ----------
function renderPrompts() {
  $('#aspect-hint').textContent = project.aspectRatio;
  $('#prompt-list').innerHTML = buildAllPrompts(project).map((p) => `
    <div class="prompt-card">
      <div class="prompt-head">
        <span><span class="badge">Cảnh ${p.index}</span> <strong>${escapeHtml(p.title)}</strong></span>
        <button class="secondary" data-copy="${p.index - 1}">📋 Sao chép</button>
      </div>
      <pre class="prompt-text">${escapeHtml(p.prompt)}</pre>
    </div>`).join('');
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('Đã sao chép! Dán vào Google Flow nhé');
}

$('#prompt-list').addEventListener('click', (e) => {
  const idx = e.target.dataset.copy;
  if (idx === undefined) return;
  copy(buildAllPrompts(project)[Number(idx)].prompt);
});

$('#btn-copy-all').addEventListener('click', () => copy(exportText(project)));

function fileBase() {
  return slugify(project.title);
}

$('#btn-export-txt').addEventListener('click', () => download(`${fileBase()}.txt`, exportText(project), 'text/plain;charset=utf-8'));
$('#btn-export-json').addEventListener('click', () => download(`${fileBase()}.json`, JSON.stringify(project, null, 2), 'application/json'));

$('#import-json').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.scenes)) throw new Error();
    project = createProject(data);
    save();
    syncForm();
    renderPrompts();
    toast('Đã mở dự án');
  } catch {
    toast('File không hợp lệ');
  }
  e.target.value = '';
});

const dubbing = initDubbing({ getVoiceLanguage: () => project.voiceLanguage });

$('#btn-voice-script').addEventListener('click', () => {
  if (!dubbing.loadFromProject(project)) {
    toast('Chưa có lời thoại/thuyết minh nào trong kịch bản (lời hát không đọc được)');
    return;
  }
  goTo('dub');
});

bindForm();
syncForm();
