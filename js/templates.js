// Mẫu kịch bản có sẵn. Mỗi "beat" là một cảnh ~8 giây trong Google Flow.
// - goal: gợi ý tiếng Việt cho người dùng biết cảnh này cần làm gì
// - camera: góc máy (tiếng Anh, Veo hiểu tốt nhất)
// - action: mô tả hành động mặc định, {idea} được thay bằng ý tưởng của người dùng
// - voiceType: 'dialogue' (lời thoại), 'sing' (hát), 'narration' (thuyết minh)
// - dialogue: lời mẫu tiếng Việt (không bắt buộc)
// Template có thể đặt sẵn phong cách/cảm xúc qua `defaults`.

export const TEMPLATES = [
  {
    id: 'story',
    name: 'Phim ngắn',
    icon: '🎬',
    description: 'Phim có mở đầu, biến cố, xung đột, cao trào và kết thúc.',
    defaults: { styleId: 'cinematic', moodId: 'mystery' },
    beats: [
      { title: 'Mở cảnh', goal: 'Toàn cảnh giới thiệu thế giới của phim.', camera: 'Establishing wide shot, slow crane down', action: 'The world of the story is revealed. Story: {idea}' },
      { title: 'Giới thiệu nhân vật', goal: 'Cận mặt nhân vật chính, cho thấy tính cách.', camera: 'Medium close-up, shallow depth of field', action: 'Introduce the main character in their everyday life. Story: {idea}', voiceType: 'narration' },
      { title: 'Biến cố', goal: 'Điều gì đó bất ngờ xảy ra.', camera: 'Medium shot, slow push-in', action: 'Something unexpected happens to the main character. Story: {idea}' },
      { title: 'Đối thoại', goal: 'Nhân vật nói câu thoại quan trọng.', camera: 'Over-the-shoulder shot', action: 'The main character speaks with determination about what they must do. Story: {idea}', voiceType: 'dialogue' },
      { title: 'Cao trào', goal: 'Khoảnh khắc quyết định, kịch tính nhất.', camera: 'Low angle, dynamic handheld camera', action: 'The decisive moment: the main character makes a brave choice. Story: {idea}' },
      { title: 'Kết thúc', goal: 'Hình ảnh cuối đọng lại cảm xúc.', camera: 'Wide shot, slow pull-back', action: 'The main character at peace after everything, final lingering image. Story: {idea}', voiceType: 'narration' },
    ],
  },
  {
    id: 'musicvideo',
    name: 'Video ca nhạc',
    icon: '🎤',
    description: 'MV: ca sĩ hát xen cảnh kể chuyện theo bài hát.',
    defaults: { styleId: 'cinematic', moodId: 'epic' },
    beats: [
      { title: 'Intro', goal: 'Không khí mở đầu, chưa hát.', camera: 'Aerial drone shot, slowly descending', action: 'An atmospheric opening that sets the feeling of a song about {idea}' },
      { title: 'Verse 1 – Hát', goal: 'Ca sĩ hát câu đầu, cận mặt.', camera: 'Close-up on the singer, slow dolly in', action: 'The main character sings softly and emotionally, a song about {idea}', voiceType: 'sing' },
      { title: 'Verse 1 – Câu chuyện', goal: 'Cảnh kể chuyện minh hoạ lời bài hát.', camera: 'Medium shot, gentle handheld', action: 'A story moment illustrating the lyrics about {idea}' },
      { title: 'Tiền điệp khúc', goal: 'Cảm xúc dâng lên, ca sĩ hát mạnh hơn.', camera: 'Medium shot, slow orbit around the singer', action: 'The main character sings with growing emotion, a song about {idea}', voiceType: 'sing' },
      { title: 'Câu chuyện 2', goal: 'Cảnh kể chuyện tiếp theo.', camera: 'Tracking shot', action: 'The story continues, a turning point related to {idea}' },
      { title: 'Điệp khúc', goal: 'Cao trào bài hát, cảnh hoành tráng.', camera: 'Wide shot, sweeping crane move, lens flares', action: 'The main character sings the chorus powerfully, arms open, a song about {idea}', voiceType: 'sing' },
      { title: 'Outro', goal: 'Kết thúc nhẹ nhàng, nhạc nhỏ dần.', camera: 'Slow pull-back into silhouette', action: 'A quiet final image as the song about {idea} fades out' },
    ],
  },
  {
    id: 'animation',
    name: 'Phim hoạt hình',
    icon: '🧸',
    description: 'Hoạt hình 3D/anime: thế giới, nhân vật, cuộc phiêu lưu.',
    defaults: { styleId: 'pixar', moodId: 'fun' },
    beats: [
      { title: 'Thế giới', goal: 'Toàn cảnh thế giới hoạt hình đầy màu sắc.', camera: 'Sweeping wide establishing shot', action: 'A colorful animated world. Story: {idea}' },
      { title: 'Nhân vật chính', goal: 'Nhân vật xuất hiện dễ thương, chào khán giả.', camera: 'Medium shot, eye level', action: 'The main character appears and waves happily. Story: {idea}', voiceType: 'dialogue', dialogue: 'Xin chào các bạn!' },
      { title: 'Gặp bạn mới', goal: 'Gặp một người bạn, nói chuyện.', camera: 'Two-shot, gentle push-in', action: 'The main character meets a new friend and they talk excitedly. Story: {idea}', voiceType: 'dialogue' },
      { title: 'Rắc rối', goal: 'Gặp một vấn đề cần giải quyết.', camera: 'Dutch angle, dramatic', action: 'A funny problem appears and the friends look worried. Story: {idea}' },
      { title: 'Cùng nhau vượt qua', goal: 'Hợp sức giải quyết, hành động vui nhộn.', camera: 'Dynamic tracking shot', action: 'The friends work together in a fun adventure to fix the problem. Story: {idea}' },
      { title: 'Kết có hậu', goal: 'Mọi người vui vẻ, bài học nhỏ.', camera: 'Wide shot, slow pull-back, sunset', action: 'Everyone celebrates happily together. Story: {idea}', voiceType: 'narration' },
    ],
  },
  {
    id: 'kidsong',
    name: 'Nhạc thiếu nhi',
    icon: '🎵',
    description: 'Bài hát cho bé: con vật dễ thương, lời đơn giản, vui tươi.',
    defaults: { styleId: 'kids', moodId: 'fun' },
    beats: [
      { title: 'Mở đầu', goal: 'Các con vật nhảy múa chào bé.', camera: 'Wide shot, bouncy camera', action: 'Cute cartoon characters dance happily to introduce a kids song about {idea}' },
      { title: 'Đoạn 1', goal: 'Nhân vật hát câu đầu tiên.', camera: 'Medium shot, facing camera', action: 'The main character sings cheerfully while doing simple hand movements, a kids song about {idea}', voiceType: 'sing' },
      { title: 'Đoạn 2', goal: 'Hát tiếp, minh hoạ lời bài hát.', camera: 'Slow pan following the characters', action: 'The characters act out the lyrics playfully, a kids song about {idea}', voiceType: 'sing' },
      { title: 'Điệp khúc', goal: 'Cả nhóm cùng hát và nhảy.', camera: 'Wide shot, gentle orbit', action: 'All the characters sing and dance together in a circle, a kids song about {idea}', voiceType: 'sing' },
      { title: 'Tạm biệt', goal: 'Vẫy tay chào tạm biệt bé.', camera: 'Medium shot, slow zoom out', action: 'The characters wave goodbye to the viewer with big smiles', voiceType: 'dialogue', dialogue: 'Tạm biệt các bé nhé!' },
    ],
  },
  {
    id: 'product',
    name: 'Quảng cáo sản phẩm',
    icon: '🛍️',
    description: 'Giới thiệu sản phẩm: thu hút → vấn đề → giải pháp → kêu gọi mua.',
    defaults: { styleId: 'commercial', moodId: 'warm' },
    beats: [
      { title: 'Mở đầu gây chú ý', goal: 'Cận cảnh sản phẩm thật đẹp, gây tò mò trong 2 giây đầu.', camera: 'Extreme close-up, slow push-in', action: 'A dramatic reveal of {idea}, light glinting across its surface' },
      { title: 'Vấn đề', goal: 'Cho thấy khó khăn mà khách hàng đang gặp.', camera: 'Medium shot, handheld', action: 'The main character looks frustrated by an everyday problem that {idea} solves' },
      { title: 'Giải pháp', goal: 'Nhân vật dùng sản phẩm, mọi thứ trở nên dễ dàng.', camera: 'Medium close-up, smooth dolly', action: 'The main character discovers and uses {idea}, their expression turning to delight' },
      { title: 'Kết quả', goal: 'Khoảnh khắc vui vẻ, hài lòng nhờ sản phẩm.', camera: 'Wide shot, slow orbit', action: 'The main character enjoys the result of using {idea}, smiling confidently', voiceType: 'dialogue' },
      { title: 'Kêu gọi hành động', goal: 'Sản phẩm ở trung tâm khung hình, nền gọn gàng.', camera: 'Static hero shot, centered composition', action: '{idea} displayed proudly on a clean surface, soft spotlight', voiceType: 'narration' },
    ],
  },
  {
    id: 'travel',
    name: 'Vlog du lịch',
    icon: '✈️',
    description: 'Khám phá một địa điểm: toàn cảnh → đến nơi → trải nghiệm → hoàng hôn.',
    defaults: { styleId: 'realistic', moodId: 'warm' },
    beats: [
      { title: 'Toàn cảnh', goal: 'Cảnh flycam nhìn từ trên cao xuống địa điểm.', camera: 'Aerial drone shot, slowly flying forward', action: 'A breathtaking aerial view of {idea}' },
      { title: 'Đến nơi', goal: 'Nhân vật đến nơi, ngắm nhìn xung quanh.', camera: 'Tracking shot following from behind', action: 'The main character arrives at {idea}, looking around in awe' },
      { title: 'Khám phá', goal: 'Đi dạo, khám phá những góc đặc trưng.', camera: 'Gimbal walking shot, eye level', action: 'The main character walks through the most iconic spot of {idea}', voiceType: 'dialogue' },
      { title: 'Ẩm thực địa phương', goal: 'Thưởng thức món ăn đặc sản.', camera: 'Close-up, shallow depth of field', action: 'The main character tastes a famous local dish at {idea}, steam rising' },
      { title: 'Hoàng hôn', goal: 'Kết thúc nhẹ nhàng, cảm xúc.', camera: 'Wide shot, silhouette against the sky', action: 'The main character watches the sunset over {idea}', voiceType: 'narration' },
    ],
  },
  {
    id: 'food',
    name: 'Quán ăn / Món ăn',
    icon: '🍜',
    description: 'Quảng bá món ăn hoặc quán: nguyên liệu → chế biến → thưởng thức.',
    defaults: { styleId: 'cinematic', moodId: 'warm' },
    beats: [
      { title: 'Mặt tiền quán', goal: 'Không khí quán ăn mời gọi.', camera: 'Wide shot, slow dolly in', action: 'A cozy, inviting restaurant serving {idea}, warm lights, people chatting' },
      { title: 'Nguyên liệu', goal: 'Nguyên liệu tươi ngon.', camera: 'Overhead top-down shot', action: 'Fresh ingredients for {idea} arranged beautifully on a wooden table' },
      { title: 'Chế biến', goal: 'Đầu bếp nấu, lửa, khói, âm thanh xèo xèo.', camera: 'Close-up, slow motion', action: 'The chef cooks {idea}, flames and steam rising, sizzling sounds' },
      { title: 'Món ăn hoàn chỉnh', goal: 'Món ăn đẹp mắt trên bàn.', camera: 'Macro shot, slow orbit', action: 'A perfectly plated {idea}, glistening, steam curling up' },
      { title: 'Thưởng thức', goal: 'Khách ăn ngon miệng.', camera: 'Medium close-up', action: 'A customer takes the first bite of {idea} and smiles with satisfaction', voiceType: 'dialogue', dialogue: 'Ngon quá!' },
    ],
  },
  {
    id: 'explainer',
    name: 'Giải thích / Giáo dục',
    icon: '🎓',
    description: 'Giải thích một khái niệm đơn giản bằng hình ảnh trực quan.',
    defaults: { styleId: 'pixar', moodId: 'fun' },
    beats: [
      { title: 'Câu hỏi', goal: 'Đặt câu hỏi gây tò mò.', camera: 'Medium shot, facing camera', action: 'The main character asks the audience a curious question about {idea}', voiceType: 'dialogue' },
      { title: 'Minh hoạ 1', goal: 'Hình ảnh minh hoạ ý chính đầu tiên.', camera: 'Slow zoom in', action: 'A clear visual metaphor showing the first key idea of {idea}', voiceType: 'narration' },
      { title: 'Minh hoạ 2', goal: 'Hình ảnh minh hoạ ý chính thứ hai.', camera: 'Smooth pan left to right', action: 'A clear visual metaphor showing how {idea} works step by step', voiceType: 'narration' },
      { title: 'Kết luận', goal: 'Tóm tắt, nhân vật mỉm cười.', camera: 'Medium shot, facing camera', action: 'The main character summarizes {idea} with a confident smile', voiceType: 'dialogue' },
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
  { id: 'pixar', name: 'Hoạt hình 3D', prompt: '3D animated, Pixar-style, soft lighting, expressive characters' },
  { id: 'anime', name: 'Anime', prompt: 'Japanese anime style, vibrant colors, hand-drawn look, Studio Ghibli inspired' },
  { id: 'kids', name: 'Hoạt hình thiếu nhi', prompt: 'colorful 2D cartoon for young children, simple rounded shapes, bright primary colors, cute friendly characters, child-friendly and safe' },
  { id: 'clay', name: 'Đất nặn', prompt: 'claymation stop-motion style, handmade clay textures, playful' },
  { id: 'commercial', name: 'Quảng cáo', prompt: 'high-end commercial, clean studio lighting, crisp and glossy' },
  { id: 'vintage', name: 'Hoài cổ', prompt: 'vintage 1990s film look, film grain, warm faded colors' },
];

export const MOODS = [
  { id: 'warm', name: 'Ấm áp', prompt: 'warm golden hour light, cozy and inviting mood' },
  { id: 'epic', name: 'Hùng tráng', prompt: 'epic and grand mood, dramatic lighting' },
  { id: 'fun', name: 'Vui tươi', prompt: 'bright, cheerful and playful mood' },
  { id: 'calm', name: 'Thư giãn', prompt: 'calm, peaceful, soft diffused light' },
  { id: 'romantic', name: 'Lãng mạn', prompt: 'romantic, dreamy soft focus, pastel tones' },
  { id: 'mystery', name: 'Bí ẩn', prompt: 'mysterious, moody low-key lighting, light fog' },
];

// Ngôn ngữ/giọng cho lời thoại, lời hát, thuyết minh.
// - prompt: đưa vào prompt Flow/Veo
// - tts: hướng dẫn cho giọng đọc AI (công cụ lồng tiếng)
export const VOICE_LANGUAGES = [
  { id: 'vi-north', name: 'Tiếng Việt – giọng Bắc (Hà Nội)', prompt: 'Vietnamese with a natural Northern Vietnamese (Hanoi) accent', tts: 'a natural, standard Northern Vietnamese (Hanoi) accent' },
  { id: 'vi-south', name: 'Tiếng Việt – giọng Nam (Sài Gòn)', prompt: 'Vietnamese with a natural Southern Vietnamese (Saigon) accent', tts: 'a natural Southern Vietnamese (Saigon) accent' },
  { id: 'vi-central', name: 'Tiếng Việt – giọng Trung (Huế)', prompt: 'Vietnamese with a natural Central Vietnamese (Hue) accent', tts: 'a natural Central Vietnamese (Hue) accent' },
  { id: 'en', name: 'Tiếng Anh', prompt: 'English', tts: 'a natural English accent' },
];

export const VOICE_TYPES = [
  { id: 'dialogue', name: 'Lời thoại' },
  { id: 'narration', name: 'Thuyết minh' },
  { id: 'sing', name: 'Hát' },
];

export function findById(list, id) {
  return list.find((item) => item.id === id) || list[0];
}
