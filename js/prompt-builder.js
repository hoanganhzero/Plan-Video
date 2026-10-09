// Biến kế hoạch video thành các prompt sẵn sàng dán vào Google Flow (Veo).
// Cấu trúc prompt theo khuyến nghị của Veo:
//   góc máy → nhân vật → hành động → bối cảnh → ánh sáng/cảm xúc → phong cách → âm thanh → lời thoại

import { TEMPLATES, STYLES, MOODS, VOICE_LANGUAGES, findById } from './templates.js';

export const SECONDS_PER_CLIP = 8;
export const MAX_SCENES = 30;

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createProject(overrides = {}) {
  return {
    id: newId(),
    updatedAt: 0,
    title: '',
    idea: '',
    templateId: 'story',
    character: '',
    setting: '',
    product: '',
    // true khi người dùng có ảnh người/sản phẩm để dùng làm tham chiếu (Ingredients to Video)
    referenceMode: false,
    styleId: 'cinematic',
    moodId: 'warm',
    aspectRatio: '16:9',
    music: '',
    voiceLanguage: 'vi-north',
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
  const n = Math.max(1, Math.min(MAX_SCENES, count || template.beats.length));
  return Array.from({ length: n }, (_, i) => {
    const beat = template.beats[i] || { title: `Cảnh ${i + 1}`, goal: 'Tự mô tả cảnh này.', camera: 'Medium shot', action: '' };
    return {
      title: beat.title,
      goal: beat.goal,
      camera: beat.camera,
      action: fill(beat.action, project),
      voiceType: beat.voiceType || 'dialogue',
      dialogue: beat.dialogue || '',
      sound: '',
      done: false,
    };
  });
}

// Câu mô tả giọng nói/lời hát, ghi rõ ngôn ngữ và giọng vùng miền để Veo phát âm đúng.
export function buildVoiceLine(project, scene) {
  const text = (scene.dialogue || '').trim();
  if (!text) return '';
  const lang = findById(VOICE_LANGUAGES, project.voiceLanguage).prompt;
  const quoted = `"${text.replace(/"/g, "'")}"`;
  switch (scene.voiceType) {
    case 'sing':
      return `The character sings in ${lang}, on beat, with clear and correct pronunciation. Lyrics: ${quoted}`;
    case 'narration':
      return `Voice-over narration in ${lang}, warm and clear, correct tones and pronunciation: ${quoted}`;
    default:
      return `The character speaks in ${lang}, clear pronunciation with correct tones, lips in sync: ${quoted}`;
  }
}

function sentence(text) {
  const t = (text || '').trim();
  if (!t) return '';
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

// Dùng lại đúng mô tả nhân vật trong mọi cảnh để Flow giữ nhân vật nhất quán.
function withCharacter(project, text) {
  const character = project.character.trim();
  return character
    ? (text || '').replaceAll('The main character', character).replaceAll('the main character', character)
    : (text || '');
}

export function buildScenePrompt(project, scene) {
  const style = findById(STYLES, project.styleId);
  const mood = findById(MOODS, project.moodId);
  const action = withCharacter(project, scene.action);

  const parts = [
    project.referenceMode ? 'Use the exact same person and product as in the reference images (same face, body, outfit, product design).' : '',
    sentence(scene.camera),
    sentence(action),
    project.setting.trim() ? sentence(`Setting: ${project.setting.trim()}`) : '',
    (project.product || '').trim() ? sentence(`The product, identical in every shot: ${project.product.trim()}`) : '',
    sentence(mood.prompt),
    sentence(`Style: ${style.prompt}`),
  ];

  const audio = [scene.sound, project.music].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  if (audio) parts.push(sentence(`Audio: ${audio}`));
  parts.push(buildVoiceLine(project, scene));
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

// Prompt tạo ảnh "bảng nhân vật" để dùng làm ảnh tham chiếu (Ingredients to Video),
// giúp khuôn mặt và trang phục giống nhau ở mọi cảnh.
export function buildCharacterSheetPrompt(project) {
  const character = project.character.trim();
  if (!character) return '';
  const style = findById(STYLES, project.styleId);
  return [
    sentence(`Character reference sheet of ${character}`),
    'Full body front view, side view and close-up of the face, neutral standing pose.',
    'Plain light grey background, even soft lighting, consistent design across all views.',
    sentence(`Style: ${style.prompt}`),
    'No text, no labels, no watermarks.',
  ].join(' ');
}

// Prompt tạo ảnh khung hình đầu của một cảnh (Frames to Video).
export function buildFramePrompt(project, scene) {
  const style = findById(STYLES, project.styleId);
  const mood = findById(MOODS, project.moodId);
  const orientation = project.aspectRatio === '9:16' ? 'vertical 9:16 composition' : 'wide 16:9 composition';
  return [
    sentence(`A single still frame, ${orientation}, ${scene.camera || 'medium shot'}`),
    sentence(withCharacter(project, scene.action)),
    project.setting.trim() ? sentence(`Setting: ${project.setting.trim()}`) : '',
    sentence(mood.prompt),
    sentence(`Style: ${style.prompt}`),
    'No text, no watermarks.',
  ].filter(Boolean).join(' ');
}

// Prompt tạo ảnh khung đầu có dùng ảnh thật của người/sản phẩm (cho chế độ tự động).
export function buildReferenceFramePrompt(project, scene, { hasPerson = false, hasProduct = false } = {}) {
  const refs = [
    hasPerson ? 'the exact person from the person photo (keep the same face, hairstyle, skin tone and body shape)' : '',
    hasProduct ? 'the exact product from the product photo (keep the same shape, colors, packaging and label)' : '',
  ].filter(Boolean);
  const intro = refs.length ? `Create a photorealistic image featuring ${refs.join(' and ')}. ` : '';
  const product = (project.product || '').trim() ? ` The product: ${project.product.trim()}.` : '';
  return `${intro}${buildFramePrompt(project, scene)}${product}`;
}

export function progress(project) {
  const total = project.scenes.length;
  const done = project.scenes.filter((s) => s.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
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
  header.push(`Giọng: ${findById(VOICE_LANGUAGES, project.voiceLanguage).name}`);
  header.push('');
  const body = buildAllPrompts(project).map((p) => `## Cảnh ${p.index}: ${p.title}\n${p.prompt}\n`);
  return [...header, ...body].join('\n');
}
