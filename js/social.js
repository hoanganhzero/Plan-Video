// Nội dung đăng mạng xã hội (tiêu đề, mô tả, hashtag) khi không dùng AI.

import { TEMPLATES, findById } from './templates.js';
import { slugify } from './ui-utils.js';

const TEMPLATE_TAGS = {
  story: ['phimngan', 'shortfilm'],
  musicvideo: ['mv', 'nhacviet', 'music'],
  animation: ['hoathinh', 'animation'],
  kidsong: ['nhacthieunhi', 'chobe', 'kids'],
  product: ['review', 'quangcao'],
  travel: ['dulich', 'vietnam', 'travel'],
  food: ['amthuc', 'monngon', 'food'],
  explainer: ['kienthuc', 'hoctap'],
  custom: ['video'],
};

export function socialFallback(project) {
  const template = findById(TEMPLATES, project.templateId);
  const title = (project.title || project.idea || 'Video mới').trim();
  const ideaTag = slugify(project.title || '', '').replace(/-/g, '');
  const hashtags = [...new Set([...(TEMPLATE_TAGS[template.id] || []), 'aivideo', 'googleflow', ideaTag].filter(Boolean))]
    .slice(0, 8)
    .map((t) => `#${t}`);
  const lines = project.scenes.map((s) => s.dialogue).filter(Boolean).slice(0, 2);
  return {
    youtubeTitle: `${title} | ${template.name} làm bằng AI`,
    youtubeDescription: [
      `${template.icon} ${title}`,
      project.idea ? `\n${project.idea}` : '',
      lines.length ? `\n“${lines.join(' … ')}”` : '',
      '\nVideo được tạo bằng Google Flow (Veo).',
      `\n${hashtags.join(' ')}`,
    ].join(''),
    tiktokCaption: `${title} ${template.icon} ${hashtags.slice(0, 5).join(' ')}`,
    hashtags,
  };
}
