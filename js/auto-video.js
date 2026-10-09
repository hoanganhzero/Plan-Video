// Điều phối chế độ "tự động hoàn toàn": với mỗi cảnh, tạo ảnh khung đầu (có người + sản phẩm thật)
// → tạo video 8 giây bằng Veo → tải về. Các hàm gọi API được truyền vào để dễ kiểm thử.

import { buildScenePrompt, buildReferenceFramePrompt, buildFramePrompt, SECONDS_PER_CLIP } from './prompt-builder.js';

// Giá tham khảo (USD/giây video) theo các trang tổng hợp giá 9/2026 – có thể thay đổi,
// luôn kiểm tra trang giá chính thức của Google trước khi dùng nhiều.
export const PRICE_PER_SECOND = { lite: 0.07, fast: 0.12, standard: 0.4 };

export function priceTier(modelId = '') {
  if (/lite/i.test(modelId)) return 'lite';
  if (/fast/i.test(modelId)) return 'fast';
  return 'standard';
}

export function estimateCost(modelId, sceneCount, seconds = SECONDS_PER_CLIP) {
  return Math.round(PRICE_PER_SECOND[priceTier(modelId)] * seconds * sceneCount * 100) / 100;
}

export const STEP_LABELS = {
  waiting: 'Đang chờ',
  image: 'Đang tạo ảnh khung đầu…',
  video: 'Đang tạo video…',
  download: 'Đang tải video…',
  done: 'Xong',
  manual: 'Xong – cần tải thủ công',
  error: 'Lỗi',
};

// images: { person?, product?, extra? } – mỗi ảnh là {mimeType, data}; tối đa 3 ảnh gửi cho model tạo ảnh.
// api: { generateImage, startVideo, waitForVideo, downloadVideo } (đã gắn sẵn apiKey)
export async function renderScene({ project, scene, images, api, models, onUpdate, useFrames = true }) {
  const result = { status: 'image', frame: null, uri: '', blob: null, url: '', error: '' };
  const update = (patch) => { Object.assign(result, patch); onUpdate?.({ ...result }); };
  try {
    const refs = [images.person, images.product, images.extra].filter(Boolean).slice(0, 3);
    if (useFrames && models.image) {
      update({ status: 'image' });
      const framePrompt = refs.length
        ? buildReferenceFramePrompt(project, scene, { hasPerson: Boolean(images.person), hasProduct: Boolean(images.product) })
        : buildFramePrompt(project, scene);
      const frame = await api.generateImage({ model: models.image, prompt: framePrompt, images: refs, aspectRatio: project.aspectRatio });
      update({ frame });
    }
    update({ status: 'video' });
    const operation = await api.startVideo({
      model: models.video,
      prompt: buildScenePrompt({ ...project, referenceMode: false }, scene),
      image: result.frame,
      aspectRatio: project.aspectRatio,
    });
    const uri = await api.waitForVideo({ operation, onTick: (ms) => update({ status: 'video', elapsed: ms }) });
    update({ status: 'download', uri });
    const { blob, url } = await api.downloadVideo({ uri });
    update({ status: blob ? 'done' : 'manual', blob, url });
  } catch (err) {
    update({ status: 'error', error: err.message || String(err) });
  }
  return result;
}

// Chạy nhiều cảnh song song (mặc định 2 cảnh một lúc để tránh bị giới hạn lượt).
export async function runAll(tasks, concurrency = 2) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}
