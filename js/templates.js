// Mẫu kịch bản có sẵn. Mỗi "beat" là một cảnh ~8 giây trong Google Flow.
// - goal: gợi ý tiếng Việt cho người dùng biết cảnh này cần làm gì
// - camera: góc máy (tiếng Anh, Veo hiểu tốt nhất)
// - action: mô tả hành động mặc định, {idea} được thay bằng ý tưởng của người dùng

export const TEMPLATES = [
  {
    id: 'product',
    name: 'Quảng cáo sản phẩm',
    icon: '🛍️',
    description: 'Giới thiệu sản phẩm: thu hút → vấn đề → giải pháp → kêu gọi mua.',
    beats: [
      { title: 'Mở đầu gây chú ý', goal: 'Cận cảnh sản phẩm thật đẹp, gây tò mò trong 2 giây đầu.', camera: 'Extreme close-up, slow push-in', action: 'A dramatic reveal of {idea}, light glinting across its surface' },
      { title: 'Vấn đề', goal: 'Cho thấy khó khăn mà khách hàng đang gặp.', camera: 'Medium shot, handheld', action: 'The main character looks frustrated by an everyday problem that {idea} solves' },
      { title: 'Giải pháp', goal: 'Nhân vật dùng sản phẩm, mọi thứ trở nên dễ dàng.', camera: 'Medium close-up, smooth dolly', action: 'The main character discovers and uses {idea}, their expression turning to delight' },
      { title: 'Kết quả', goal: 'Khoảnh khắc vui vẻ, hài lòng nhờ sản phẩm.', camera: 'Wide shot, slow orbit', action: 'The main character enjoys the result of using {idea}, smiling confidently' },
      { title: 'Kêu gọi hành động', goal: 'Sản phẩm ở trung tâm khung hình, nền gọn gàng.', camera: 'Static hero shot, centered composition', action: '{idea} displayed proudly on a clean surface, soft spotlight' },
    ],
  },
  {
    id: 'travel',
    name: 'Vlog du lịch',
    icon: '✈️',
    description: 'Khám phá một địa điểm: toàn cảnh → đến nơi → trải nghiệm → hoàng hôn.',
    beats: [
      { title: 'Toàn cảnh', goal: 'Cảnh flycam nhìn từ trên cao xuống địa điểm.', camera: 'Aerial drone shot, slowly flying forward', action: 'A breathtaking aerial view of {idea}' },
      { title: 'Đến nơi', goal: 'Nhân vật đến nơi, ngắm nhìn xung quanh.', camera: 'Tracking shot following from behind', action: 'The main character arrives at {idea}, looking around in awe' },
      { title: 'Khám phá', goal: 'Đi dạo, khám phá những góc đặc trưng.', camera: 'Gimbal walking shot, eye level', action: 'The main character walks through the most iconic spot of {idea}' },
      { title: 'Ẩm thực địa phương', goal: 'Thưởng thức món ăn đặc sản.', camera: 'Close-up, shallow depth of field', action: 'The main character tastes a famous local dish at {idea}, steam rising' },
      { title: 'Hoàng hôn', goal: 'Kết thúc nhẹ nhàng, cảm xúc.', camera: 'Wide shot, silhouette against the sky', action: 'The main character watches the sunset over {idea}' },
    ],
  },
  {
    id: 'story',
    name: 'Kể chuyện ngắn',
    icon: '📖',
    description: 'Câu chuyện có mở đầu, xung đột, cao trào và kết thúc.',
    beats: [
      { title: 'Mở đầu', goal: 'Giới thiệu nhân vật và bối cảnh.', camera: 'Establishing wide shot', action: 'Introduce the main character in their everyday world. Story: {idea}' },
      { title: 'Biến cố', goal: 'Điều gì đó bất ngờ xảy ra.', camera: 'Medium shot, slow push-in', action: 'Something unexpected happens to the main character. Story: {idea}' },
      { title: 'Xung đột', goal: 'Nhân vật gặp thử thách.', camera: 'Handheld close-up, tense', action: 'The main character struggles against the challenge. Story: {idea}' },
      { title: 'Cao trào', goal: 'Khoảnh khắc quyết định.', camera: 'Low angle, dynamic camera move', action: 'The decisive moment: the main character makes a brave choice. Story: {idea}' },
      { title: 'Kết thúc', goal: 'Kết quả và cảm xúc cuối cùng.', camera: 'Wide shot, slow pull-back', action: 'The main character at peace after everything. Story: {idea}' },
    ],
  },
  {
    id: 'food',
    name: 'Quán ăn / Món ăn',
    icon: '🍜',
    description: 'Quảng bá món ăn hoặc quán: nguyên liệu → chế biến → thưởng thức.',
    beats: [
      { title: 'Mặt tiền quán', goal: 'Không khí quán ăn mời gọi.', camera: 'Wide shot, slow dolly in', action: 'A cozy, inviting restaurant serving {idea}, warm lights, people chatting' },
      { title: 'Nguyên liệu', goal: 'Nguyên liệu tươi ngon.', camera: 'Overhead top-down shot', action: 'Fresh ingredients for {idea} arranged beautifully on a wooden table' },
      { title: 'Chế biến', goal: 'Đầu bếp nấu, lửa, khói, âm thanh xèo xèo.', camera: 'Close-up, slow motion', action: 'The chef cooks {idea}, flames and steam rising, sizzling sounds' },
      { title: 'Món ăn hoàn chỉnh', goal: 'Món ăn đẹp mắt trên bàn.', camera: 'Macro shot, slow orbit', action: 'A perfectly plated {idea}, glistening, steam curling up' },
      { title: 'Thưởng thức', goal: 'Khách ăn ngon miệng.', camera: 'Medium close-up', action: 'A customer takes the first bite of {idea} and smiles with satisfaction' },
    ],
  },
  {
    id: 'explainer',
    name: 'Giải thích / Giáo dục',
    icon: '🎓',
    description: 'Giải thích một khái niệm đơn giản bằng hình ảnh trực quan.',
    beats: [
      { title: 'Câu hỏi', goal: 'Đặt câu hỏi gây tò mò.', camera: 'Medium shot, facing camera', action: 'The main character asks the audience a curious question about {idea}' },
      { title: 'Minh hoạ 1', goal: 'Hình ảnh minh hoạ ý chính đầu tiên.', camera: 'Slow zoom in', action: 'A clear visual metaphor showing the first key idea of {idea}' },
      { title: 'Minh hoạ 2', goal: 'Hình ảnh minh hoạ ý chính thứ hai.', camera: 'Smooth pan left to right', action: 'A clear visual metaphor showing how {idea} works step by step' },
      { title: 'Kết luận', goal: 'Tóm tắt, nhân vật mỉm cười.', camera: 'Medium shot, facing camera', action: 'The main character summarizes {idea} with a confident smile' },
    ],
  },
  {
    id: 'custom',
    name: 'Tự do',
    icon: '✏️',
    description: 'Tự viết từng cảnh theo ý bạn.',
    beats: [
      { title: 'Cảnh 1', goal: 'Tự mô tả cảnh này.', camera: 'Wide shot', action: '{idea}' },
      { title: 'Cảnh 2', goal: 'Tự mô tả cảnh này.', camera: 'Medium shot', action: '' },
      { title: 'Cảnh 3', goal: 'Tự mô tả cảnh này.', camera: 'Close-up', action: '' },
    ],
  },
];

export const STYLES = [
  { id: 'cinematic', name: 'Điện ảnh', prompt: 'cinematic, shot on 35mm film, rich color grading, shallow depth of field' },
  { id: 'realistic', name: 'Chân thực', prompt: 'photorealistic, natural lighting, documentary feel, 4K detail' },
  { id: 'anime', name: 'Anime', prompt: 'Japanese anime style, vibrant colors, hand-drawn look, Studio Ghibli inspired' },
  { id: 'pixar', name: 'Hoạt hình 3D', prompt: '3D animated, Pixar-style, soft lighting, expressive characters' },
  { id: 'vintage', name: 'Hoài cổ', prompt: 'vintage 1990s film look, film grain, warm faded colors' },
  { id: 'commercial', name: 'Quảng cáo', prompt: 'high-end commercial, clean studio lighting, crisp and glossy' },
];

export const MOODS = [
  { id: 'warm', name: 'Ấm áp', prompt: 'warm golden hour light, cozy and inviting mood' },
  { id: 'epic', name: 'Hùng tráng', prompt: 'epic and grand mood, dramatic lighting' },
  { id: 'fun', name: 'Vui tươi', prompt: 'bright, cheerful and playful mood' },
  { id: 'calm', name: 'Thư giãn', prompt: 'calm, peaceful, soft diffused light' },
  { id: 'mystery', name: 'Bí ẩn', prompt: 'mysterious, moody low-key lighting, light fog' },
];

export function findById(list, id) {
  return list.find((item) => item.id === id) || list[0];
}
