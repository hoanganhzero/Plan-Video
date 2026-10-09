// Biến kế hoạch video thành các prompt sẵn sàng dán vào Google Flow (Veo).
// Cấu trúc prompt theo khuyến nghị của Veo:
//   góc máy → nhân vật → hành động → bối cảnh → ánh sáng/cảm xúc → phong cách → âm thanh → lời thoại

import { TEMPLATES, STYLES, MOODS, findById } from './templates.js';

export const SECONDS_PER_CLIP = 8;

export function createProject(overrides = {}) {
  return {
    title: '',
    idea: '',
    templateId: 'product',
    character: '',
    setting: '',
    styleId: 'cinematic',
    moodId: 'warm',
    aspectRatio: '16:9',
    music: '',
    noText: true,
    scenes: [],
    ...overrides,
  };
}

function fill(text, project) {
  return (text || '').replaceAll('{idea}', project.idea.trim() || 'the subject');
}

// Tạo danh sách cảnh từ mẫu đã chọn (chế độ không cần AI).
// Nếu số cảnh nhiều hơn mẫu, các cảnh thêm là cảnh trống để người dùng tự viết.
export function scenesFromTemplate(project, count) {
  const template = findById(TEMPLATES, project.templateId);
  const n = Math.max(1, Math.min(12, count || template.beats.length));
  return Array.from({ length: n }, (_, i) => {
    const beat = template.beats[i] || { title: `Cảnh ${i + 1}`, goal: 'Tự mô tả cảnh này.', camera: 'Medium shot', action: '' };
    return {
      title: beat.title,
      goal: beat.goal,
      camera: beat.camera,
      action: fill(beat.action, project),
      dialogue: '',
      sound: '',
    };
  });
}

function sentence(text) {
  const t = (text || '').trim();
  if (!t) return '';
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

export function buildScenePrompt(project, scene) {
  const style = findById(STYLES, project.styleId);
  const mood = findById(MOODS, project.moodId);
  const character = project.character.trim();

  // Dùng lại đúng mô tả nhân vật trong mọi cảnh để Flow giữ nhân vật nhất quán.
  const action = character
    ? scene.action.replaceAll('The main character', character).replaceAll('the main character', character)
    : scene.action;

  const parts = [
    sentence(scene.camera),
    sentence(action),
    project.setting.trim() ? sentence(`Setting: ${project.setting.trim()}`) : '',
    sentence(mood.prompt),
    sentence(`Style: ${style.prompt}`),
  ];

  const audio = [scene.sound, project.music].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  if (audio) parts.push(sentence(`Audio: ${audio}`));
  if (scene.dialogue && scene.dialogue.trim()) {
    parts.push(`Dialogue: "${scene.dialogue.trim().replace(/"/g, "'")}"`);
  }
  if (project.noText) parts.push('No subtitles, no on-screen text, no watermarks.');

  return parts.filter(Boolean).join(' ');
}

export function buildAllPrompts(project) {
  return project.scenes.map((scene, i) => ({
    index: i + 1,
    title: scene.title,
    prompt: buildScenePrompt(project, scene),
  }));
}

export function totalDuration(project) {
  return project.scenes.length * SECONDS_PER_CLIP;
}

// Xuất toàn bộ kịch bản ra văn bản để lưu hoặc gửi cho người khác.
export function exportText(project) {
  const header = [
    `# ${project.title || 'Video của tôi'}`,
    `Ý tưởng: ${project.idea}`,
    `Tỉ lệ khung hình: ${project.aspectRatio} · ${project.scenes.length} cảnh · ~${totalDuration(project)} giây`,
  ];
  if (project.character) header.push(`Nhân vật: ${project.character}`);
  header.push('');
  const body = buildAllPrompts(project).map((p) => `## Cảnh ${p.index}: ${p.title}\n${p.prompt}\n`);
  return [...header, ...body].join('\n');
}
