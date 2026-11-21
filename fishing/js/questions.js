// Câu hỏi học tập: Toán sinh tự động theo cấp độ, các môn khác lấy từ ngân hàng có sẵn,
// cộng thêm câu hỏi riêng do phụ huynh / giáo viên nhập.
// Câu hỏi chuẩn: { id, subject, difficulty, text, choices: [4 chuỗi], answer: chỉ số đúng, explain }

import { BANK2, DEFAULT_RANGE } from './bank2.js';
import { subjectSources, mathLevel, clampGrade, subjectInfo } from './curriculum.js';

// s: môn, d: độ khó 1–3, q: câu hỏi, a: đáp án đúng, w: đáp án sai, e: giải thích, g: [từ lớp, đến lớp]
const BANK = [
  // ---------- Tiếng Việt ----------
  { s: 'vi', d: 1, q: 'Từ nào viết đúng chính tả?', a: 'trung thực', w: ['chung thực', 'trung thựt', 'chung thựt'] },
  { s: 'vi', d: 1, q: 'Từ nào là từ chỉ hoạt động?', a: 'chạy', w: ['cái bàn', 'màu xanh', 'xinh đẹp'] },
  { s: 'vi', d: 1, q: 'Từ nào trái nghĩa với "cao"?', a: 'thấp', w: ['to', 'dài', 'xa'] },
  { s: 'vi', d: 1, q: 'Từ nào cùng nghĩa với "siêng năng"?', a: 'chăm chỉ', w: ['lười biếng', 'nhanh nhẹn', 'vui vẻ'] },
  { s: 'vi', d: 1, q: 'Câu "Con mèo đang ngủ." có mấy tiếng?', a: '4', w: ['3', '5', '2'], e: 'Con / mèo / đang / ngủ = 4 tiếng.' },
  { s: 'vi', d: 1, q: 'Từ nào chỉ màu sắc?', a: 'đỏ thắm', w: ['thơm ngát', 'mềm mại', 'ngọt lịm'] },
  { s: 'vi', d: 1, q: 'Cuối câu hỏi ta đặt dấu gì?', a: 'Dấu chấm hỏi (?)', w: ['Dấu chấm (.)', 'Dấu phẩy (,)', 'Dấu hai chấm (:)'] },
  { s: 'vi', d: 2, q: 'Câu "Mặt trời như quả bóng lửa" dùng biện pháp tu từ gì?', a: 'So sánh', w: ['Nhân hoá', 'Điệp ngữ', 'Hoán dụ'], e: 'Có từ so sánh "như".' },
  { s: 'vi', d: 2, q: 'Câu "Ông mặt trời thức dậy" dùng biện pháp tu từ gì?', a: 'Nhân hoá', w: ['So sánh', 'Ẩn dụ', 'Liệt kê'], e: 'Gọi mặt trời là "ông" và cho "thức dậy" như người.' },
  { s: 'vi', d: 2, q: 'Trong câu "Hoa nở rực rỡ.", vị ngữ là:', a: 'nở rực rỡ', w: ['Hoa', 'Hoa nở', 'rực'] },
  { s: 'vi', d: 2, q: 'Từ nào là từ láy?', a: 'lấp lánh', w: ['bàn ghế', 'sách vở', 'nhà cửa'], e: '"Lấp lánh" lặp lại âm đầu "l"; các từ còn lại là từ ghép.' },
  { s: 'vi', d: 2, q: 'Câu "Uống nước nhớ nguồn" khuyên ta điều gì?', a: 'Biết ơn người đi trước', w: ['Uống nhiều nước', 'Tiết kiệm nước', 'Đi tìm nguồn nước'] },
  { s: 'vi', d: 2, q: 'Từ "nhà" trong câu "Cả nhà em đi chơi" chỉ:', a: 'những người trong gia đình', w: ['ngôi nhà', 'nơi làm việc', 'trường học'] },
  { s: 'vi', d: 2, q: 'Thành ngữ "Chậm như rùa" nói về điều gì?', a: 'Rất chậm chạp', w: ['Rất khoẻ', 'Sống lâu', 'Rất cẩn thận'] },
  { s: 'vi', d: 3, q: '"Truyện Kiều" là tác phẩm của ai?', a: 'Nguyễn Du', w: ['Nguyễn Trãi', 'Hồ Xuân Hương', 'Nguyễn Đình Chiểu'] },
  { s: 'vi', d: 3, q: '"Bình Ngô đại cáo" là tác phẩm của ai?', a: 'Nguyễn Trãi', w: ['Nguyễn Du', 'Lý Thường Kiệt', 'Trần Quốc Tuấn'] },
  { s: 'vi', d: 3, q: 'Từ "chân" trong "chân núi" được dùng theo nghĩa nào?', a: 'Nghĩa chuyển', w: ['Nghĩa gốc', 'Từ đồng âm', 'Từ mượn'], e: 'Nghĩa gốc của "chân" là bộ phận cơ thể; "chân núi" là nghĩa chuyển.' },
  { s: 'vi', d: 3, q: 'Từ Hán Việt nào có nghĩa là "sông núi"?', a: 'giang sơn', w: ['thiên địa', 'phụ mẫu', 'huynh đệ'], e: 'Giang = sông, sơn = núi.' },
  { s: 'vi', d: 3, q: 'Câu ghép là câu:', a: 'có từ hai cụm chủ – vị trở lên', w: ['chỉ có một cụm chủ – vị', 'không có chủ ngữ', 'chỉ có một từ'] },
  { s: 'vi', d: 3, q: 'Thể thơ lục bát gồm các cặp câu có số tiếng là:', a: '6 và 8', w: ['5 và 7', '7 và 7', '8 và 8'], e: 'Lục = 6, bát = 8.' },

  // ---------- Tiếng Anh ----------
  { s: 'en', d: 1, q: '"Apple" nghĩa là gì?', a: 'Quả táo', w: ['Quả cam', 'Quả chuối', 'Quả nho'] },
  { s: 'en', d: 1, q: '"Cat" nghĩa là gì?', a: 'Con mèo', w: ['Con chó', 'Con cá', 'Con chim'] },
  { s: 'en', d: 1, q: '"Red" là màu gì?', a: 'Màu đỏ', w: ['Màu xanh lá', 'Màu vàng', 'Màu trắng'] },
  { s: 'en', d: 1, q: '"Three" là số mấy?', a: '3', w: ['2', '4', '13'] },
  { s: 'en', d: 1, q: '"Fish" nghĩa là gì?', a: 'Con cá', w: ['Con ếch', 'Con vịt', 'Con cua'] },
  { s: 'en', d: 1, q: '"Chào buổi sáng" trong tiếng Anh là:', a: 'Good morning', w: ['Good night', 'Goodbye', 'Good evening'] },
  { s: 'en', d: 1, q: '"Book" nghĩa là gì?', a: 'Quyển sách', w: ['Cái bút', 'Cái bàn', 'Cái cặp'] },
  { s: 'en', d: 2, q: 'She ___ a student.', a: 'is', w: ['am', 'are', 'be'], e: 'She/He/It đi với "is".' },
  { s: 'en', d: 2, q: 'I ___ football every Sunday.', a: 'play', w: ['plays', 'playing', 'is play'], e: 'Thói quen → hiện tại đơn; chủ ngữ "I" dùng động từ nguyên mẫu.' },
  { s: 'en', d: 2, q: 'Số nhiều của "child" là:', a: 'children', w: ['childs', 'childes', 'childrens'] },
  { s: 'en', d: 2, q: 'There ___ two cats in the garden.', a: 'are', w: ['is', 'am', 'be'], e: 'Danh từ số nhiều → "There are".' },
  { s: 'en', d: 2, q: 'Từ trái nghĩa với "beautiful" là:', a: 'ugly', w: ['pretty', 'nice', 'lovely'] },
  { s: 'en', d: 2, q: 'What ___ your name?', a: 'is', w: ['are', 'am', 'do'] },
  { s: 'en', d: 2, q: '"River" nghĩa là gì?', a: 'Dòng sông', w: ['Hồ nước', 'Biển', 'Ngọn núi'] },
  { s: 'en', d: 3, q: 'Yesterday, I ___ to the zoo.', a: 'went', w: ['go', 'goes', 'going'], e: '"Yesterday" → quá khứ đơn; quá khứ của "go" là "went".' },
  { s: 'en', d: 3, q: 'Quá khứ của "catch" là:', a: 'caught', w: ['catched', 'catching', 'catches'] },
  { s: 'en', d: 3, q: 'She has lived here ___ 2015.', a: 'since', w: ['for', 'ago', 'at'], e: '"Since" + mốc thời gian; "for" + khoảng thời gian.' },
  { s: 'en', d: 3, q: 'If it rains, we ___ at home.', a: 'will stay', w: ['stayed', 'staying', 'stays'], e: 'Câu điều kiện loại 1: If + hiện tại đơn, will + động từ.' },
  { s: 'en', d: 3, q: 'This fish is ___ than that one.', a: 'bigger', w: ['big', 'biggest', 'more big'] },
  { s: 'en', d: 3, q: 'Câu nào là câu bị động?', a: 'The fish was caught by Nam.', w: ['Nam caught the fish.', 'Nam is catching a fish.', 'Nam catches fish.'] },

  // ---------- Khoa học ----------
  { s: 'sci', d: 1, q: 'Cá thở bằng gì?', a: 'Mang', w: ['Phổi', 'Da', 'Mũi'] },
  { s: 'sci', d: 1, q: 'Cây xanh cần gì để quang hợp?', a: 'Ánh sáng mặt trời', w: ['Bóng tối', 'Muối', 'Đá'] },
  { s: 'sci', d: 1, q: 'Nước đóng băng ở bao nhiêu độ C?', a: '0°C', w: ['10°C', '100°C', '50°C'] },
  { s: 'sci', d: 1, q: 'Con vật nào đẻ trứng?', a: 'Con gà', w: ['Con chó', 'Con mèo', 'Con bò'] },
  { s: 'sci', d: 1, q: 'Mặt Trời mọc ở hướng nào?', a: 'Hướng Đông', w: ['Hướng Tây', 'Hướng Nam', 'Hướng Bắc'] },
  { s: 'sci', d: 1, q: 'Con người có mấy giác quan cơ bản?', a: '5', w: ['3', '4', '6'], e: 'Thị giác, thính giác, khứu giác, vị giác, xúc giác.' },
  { s: 'sci', d: 1, q: 'Cơ quan nào giúp ta nhìn?', a: 'Mắt', w: ['Tai', 'Mũi', 'Lưỡi'] },
  { s: 'sci', d: 2, q: 'Ở điều kiện thường, nước sôi ở bao nhiêu độ C?', a: '100°C', w: ['50°C', '80°C', '120°C'] },
  { s: 'sci', d: 2, q: 'Hành tinh nào gần Mặt Trời nhất?', a: 'Sao Thuỷ', w: ['Sao Kim', 'Trái Đất', 'Sao Hoả'] },
  { s: 'sci', d: 2, q: 'Cá voi thuộc nhóm động vật nào?', a: 'Thú (động vật có vú)', w: ['Cá', 'Bò sát', 'Lưỡng cư'], e: 'Cá voi thở bằng phổi và nuôi con bằng sữa.' },
  { s: 'sci', d: 2, q: 'Khi quang hợp, cây xanh thải ra khí gì?', a: 'Khí ô-xi', w: ['Khí các-bô-níc', 'Khí ni-tơ', 'Khí hi-đrô'] },
  { s: 'sci', d: 2, q: 'Trái Đất quay một vòng quanh Mặt Trời mất khoảng:', a: '1 năm', w: ['1 ngày', '1 tháng', '10 năm'] },
  { s: 'sci', d: 2, q: 'Ếch thuộc nhóm động vật nào?', a: 'Lưỡng cư', w: ['Bò sát', 'Thú', 'Chim'] },
  { s: 'sci', d: 2, q: 'Vật nào dẫn điện tốt?', a: 'Dây đồng', w: ['Dây nhựa', 'Gỗ khô', 'Thuỷ tinh'] },
  { s: 'sci', d: 3, q: 'Công thức hoá học của nước là:', a: 'H₂O', w: ['CO₂', 'O₂', 'NaCl'] },
  { s: 'sci', d: 3, q: 'Đơn vị đo lực là:', a: 'Niu-tơn (N)', w: ['Jun (J)', 'Oát (W)', 'Mét (m)'] },
  { s: 'sci', d: 3, q: 'Bộ phận nào của tế bào chứa thông tin di truyền?', a: 'Nhân tế bào', w: ['Màng tế bào', 'Chất tế bào', 'Thành tế bào'] },
  { s: 'sci', d: 3, q: 'Âm thanh KHÔNG truyền được trong môi trường nào?', a: 'Chân không', w: ['Nước', 'Không khí', 'Thép'] },
  { s: 'sci', d: 3, q: 'Hành tinh lớn nhất Hệ Mặt Trời là:', a: 'Sao Mộc', w: ['Sao Thổ', 'Trái Đất', 'Sao Hải Vương'] },
  { s: 'sci', d: 3, q: 'Quá trình nước chuyển thành hơi gọi là:', a: 'Bay hơi', w: ['Ngưng tụ', 'Đông đặc', 'Nóng chảy'] },
  { s: 'sci', d: 3, q: 'Muối ăn có công thức hoá học là:', a: 'NaCl', w: ['H₂O', 'KCl', 'CaCO₃'] },

  // ---------- Lịch sử & Địa lý ----------
  { s: 'his', d: 1, q: 'Thủ đô của Việt Nam là:', a: 'Hà Nội', w: ['TP. Hồ Chí Minh', 'Đà Nẵng', 'Huế'] },
  { s: 'his', d: 1, q: 'Quốc kỳ Việt Nam có màu gì?', a: 'Nền đỏ, sao vàng', w: ['Nền xanh, sao trắng', 'Nền vàng, sao đỏ', 'Nền trắng, sao đỏ'] },
  { s: 'his', d: 1, q: 'Ngày Quốc khánh Việt Nam là ngày nào?', a: '2/9', w: ['30/4', '1/5', '1/6'] },
  { s: 'his', d: 1, q: 'Việt Nam nằm ở châu lục nào?', a: 'Châu Á', w: ['Châu Âu', 'Châu Phi', 'Châu Mỹ'] },
  { s: 'his', d: 1, q: 'Sông nào chảy qua Hà Nội?', a: 'Sông Hồng', w: ['Sông Hương', 'Sông Hàn', 'Sông Sài Gòn'] },
  { s: 'his', d: 1, q: 'Đại dương lớn nhất thế giới là:', a: 'Thái Bình Dương', w: ['Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương'] },
  { s: 'his', d: 1, q: 'Lãnh thổ phần đất liền Việt Nam có hình dạng giống chữ cái nào?', a: 'Chữ S', w: ['Chữ O', 'Chữ L', 'Chữ V'] },
  { s: 'his', d: 2, q: 'Ai lãnh đạo chiến thắng Bạch Đằng năm 938?', a: 'Ngô Quyền', w: ['Lê Hoàn', 'Trần Hưng Đạo', 'Lý Bí'] },
  { s: 'his', d: 2, q: 'Đỉnh núi cao nhất Việt Nam là:', a: 'Phan Xi Păng', w: ['Núi Bà Đen', 'Bạch Mã', 'Ngọc Linh'] },
  { s: 'his', d: 2, q: 'Hai Bà Trưng khởi nghĩa chống ách đô hộ của nhà nào?', a: 'Nhà Hán', w: ['Nhà Minh', 'Nhà Thanh', 'Nhà Nguyên'] },
  { s: 'his', d: 2, q: 'Vịnh Hạ Long thuộc tỉnh nào?', a: 'Quảng Ninh', w: ['Hải Phòng', 'Thanh Hoá', 'Nghệ An'] },
  { s: 'his', d: 2, q: 'Sông Mê Kông đổ ra biển ở vùng nào của Việt Nam?', a: 'Đồng bằng sông Cửu Long', w: ['Đồng bằng sông Hồng', 'Tây Nguyên', 'Duyên hải miền Trung'] },
  { s: 'his', d: 2, q: 'Ai đọc bản Tuyên ngôn Độc lập ngày 2/9/1945?', a: 'Chủ tịch Hồ Chí Minh', w: ['Võ Nguyên Giáp', 'Phạm Văn Đồng', 'Trường Chinh'] },
  { s: 'his', d: 2, q: 'Lễ Giỗ Tổ Hùng Vương diễn ra vào ngày nào (âm lịch)?', a: '10/3', w: ['15/8', '1/1', '5/5'] },
  { s: 'his', d: 3, q: 'Chiến thắng Điện Biên Phủ diễn ra năm nào?', a: '1954', w: ['1945', '1975', '1968'] },
  { s: 'his', d: 3, q: 'Quang Trung đại phá quân Thanh vào năm nào?', a: '1789', w: ['1771', '1802', '1858'] },
  { s: 'his', d: 3, q: 'Ba lần đánh thắng quân Nguyên – Mông gắn với triều đại nào?', a: 'Nhà Trần', w: ['Nhà Lý', 'Nhà Lê', 'Nhà Nguyễn'] },
  { s: 'his', d: 3, q: 'Quần đảo Hoàng Sa và Trường Sa nằm ở biển nào?', a: 'Biển Đông', w: ['Biển Đỏ', 'Biển Đen', 'Biển Địa Trung Hải'] },
  { s: 'his', d: 3, q: 'Kinh đô của nhà Nguyễn là:', a: 'Phú Xuân (Huế)', w: ['Thăng Long', 'Hoa Lư', 'Cổ Loa'] },
  { s: 'his', d: 3, q: 'Lý Thái Tổ dời đô ra Thăng Long năm nào?', a: '1010', w: ['938', '1009', '1428'] },
  { s: 'his', d: 3, q: 'Kinh tuyến gốc (0°) đi qua đài thiên văn ở thành phố nào?', a: 'Luân Đôn (Greenwich)', w: ['Pa-ri', 'Niu Oóc', 'Bắc Kinh'] },
];

// Toàn bộ ngân hàng: câu cũ (giữ nguyên mã câu để Sổ ôn tập không bị lệch) + câu bổ sung theo khối lớp.
const ALL = [
  ...BANK.map((item, index) => ({ item: { ...item, g: item.g || DEFAULT_RANGE[item.s]?.[item.d] || [1, 12] }, id: `${item.s}-${index}` })),
  ...BANK2.map((item, index) => ({ item, id: `${item.s}-x${index}` })),
];
export const BANK_SIZE = ALL.length;

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ghép đáp án đúng + sai thành câu hỏi trắc nghiệm đã xáo trộn.
export function makeQuestion({ id, subject, difficulty, text, correct, wrong, explain = '', fixedOrder = null }, rng = Math.random) {
  // Câu Đúng/Sai giữ thứ tự cố định "Đúng – Sai" cho dễ nhìn.
  const choices = fixedOrder || shuffle([String(correct), ...wrong.map(String)], rng);
  return { id, subject, difficulty, text, choices, answer: choices.indexOf(String(correct)), explain };
}

function fromBank(item, id, rng, subject = item.s) {
  return makeQuestion({
    id, subject, difficulty: item.d, text: item.q,
    correct: item.a, wrong: item.w, explain: item.e || '',
  }, rng);
}

// Câu trong ngân hàng của một môn; có khối lớp thì chỉ lấy câu hợp với khối đó (kể cả từ các nguồn của môn).
export function bankQuestions(subject, grade = null) {
  const sources = grade == null ? [subject] : subjectSources(subject);
  const g = grade == null ? null : clampGrade(grade);
  return ALL.filter(({ item }) => sources.includes(item.s) && (g == null || (g >= item.g[0] && g <= item.g[1])));
}

// ---------- Toán sinh tự động ----------
const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function mathDistractors(ans, rng, allowNegative) {
  const out = new Set();
  const spread = Math.max(3, Math.round(Math.abs(ans) * 0.2));
  const candidates = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10];
  for (const c of shuffle(candidates, rng)) {
    if (out.size >= 3) break;
    if (c !== ans && (allowNegative || c >= 0)) out.add(c);
  }
  while (out.size < 3) {
    const c = ans + int(rng, -spread, spread);
    if (c !== ans && (allowNegative || c >= 0)) out.add(c);
  }
  return [...out];
}

// level 1–8: 1 = cộng trừ trong 20 … 5 = số âm, phần trăm, tìm x; 6 = THCS cuối cấp; 7 = lớp 10; 8 = lớp 11–12.
export function mathQuestion(level, rng = Math.random) {
  const L = Math.min(8, Math.max(1, Math.round(level)));
  if (L >= 6) return advancedMath(L, rng);
  let text;
  let ans;
  let explain;
  const kind = rng();
  if (L === 1) {
    if (kind < 0.5) {
      const a = int(rng, 1, 10); const b = int(rng, 1, 10);
      ans = a + b; text = `${a} + ${b} = ?`;
    } else {
      const a = int(rng, 5, 20); const b = int(rng, 1, a);
      ans = a - b; text = `${a} − ${b} = ?`;
    }
  } else if (L === 2) {
    if (kind < 0.35) {
      const a = int(rng, 10, 60); const b = int(rng, 5, 39);
      ans = a + b; text = `${a} + ${b} = ?`;
    } else if (kind < 0.7) {
      const a = int(rng, 30, 99); const b = int(rng, 5, a);
      ans = a - b; text = `${a} − ${b} = ?`;
    } else {
      const a = int(rng, 2, 5); const b = int(rng, 1, 10);
      ans = a * b; text = `${a} × ${b} = ?`;
    }
  } else if (L === 3) {
    if (kind < 0.35) {
      const a = int(rng, 2, 9); const b = int(rng, 2, 9);
      ans = a * b; text = `${a} × ${b} = ?`;
    } else if (kind < 0.65) {
      const b = int(rng, 2, 9); ans = int(rng, 2, 9);
      text = `${b * ans} ÷ ${b} = ?`; explain = `${b} × ${ans} = ${b * ans} nên ${b * ans} ÷ ${b} = ${ans}.`;
    } else {
      const a = int(rng, 100, 600); const b = int(rng, 50, 399);
      if (rng() < 0.5) { ans = a + b; text = `${a} + ${b} = ?`; } else { const big = a + b; ans = big - b; text = `${big} − ${b} = ?`; }
    }
  } else if (L === 4) {
    if (kind < 0.3) {
      const a = int(rng, 12, 99); const b = int(rng, 3, 9);
      ans = a * b; text = `${a} × ${b} = ?`;
    } else if (kind < 0.55) {
      const a = int(rng, 2, 20); const b = int(rng, 2, 9); const c = int(rng, 2, 9);
      ans = a + b * c; text = `${a} + ${b} × ${c} = ?`;
      explain = `Nhân trước, cộng sau: ${b} × ${c} = ${b * c}; ${a} + ${b * c} = ${ans}.`;
    } else if (kind < 0.8) {
      const n = pick(rng, [2, 3, 4, 5]); const m = n * int(rng, 2, 12);
      ans = m / n; text = `1/${n} của ${m} là bao nhiêu?`; explain = `${m} ÷ ${n} = ${ans}.`;
    } else {
      const b = int(rng, 3, 12); ans = int(rng, 11, 40);
      text = `${b * ans} ÷ ${b} = ?`;
    }
  } else {
    if (kind < 0.25) {
      const a = int(rng, -20, 20); const b = int(rng, 5, 30);
      ans = a - b; text = `(${a}) − ${b} = ?`;
      return finishMath({ text, ans, explain, L, rng, allowNegative: true });
    }
    if (kind < 0.5) {
      const p = pick(rng, [10, 20, 25, 50, 75]); const base = pick(rng, [20, 40, 60, 80, 120, 200, 400]);
      ans = (p * base) / 100; text = `${p}% của ${base} là bao nhiêu?`; explain = `${base} × ${p} ÷ 100 = ${ans}.`;
    } else if (kind < 0.75) {
      const a = int(rng, 2, 9); const x = int(rng, 1, 12); const b = int(rng, 1, 20);
      ans = x; text = `Tìm x: ${a}x + ${b} = ${a * x + b}`;
      explain = `${a}x = ${a * x + b} − ${b} = ${a * x}, nên x = ${a * x} ÷ ${a} = ${x}.`;
    } else {
      const a = int(rng, 4, 20); ans = a * a; text = `${a}² = ?`; explain = `${a} × ${a} = ${ans}.`;
    }
  }
  return finishMath({ text, ans, explain, L, rng, allowNegative: false });
}

// Toán THCS cuối cấp – THPT: căn bậc hai, Pi-ta-go, hệ số góc, phương trình bậc hai, hàm số, lũy thừa, logarit, đạo hàm, tổ hợp, cấp số cộng.
function advancedMath(L, rng) {
  const kind = rng();
  let text; let ans; let explain;
  if (L === 6) {
    if (kind < 0.25) {
      const a = int(rng, 2, 25); ans = a; text = `√${a * a} = ?`; explain = `${a}² = ${a * a}.`;
    } else if (kind < 0.5) {
      const [a, b, c] = pick(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20]]);
      ans = c; text = `Tam giác vuông có hai cạnh góc vuông ${a} và ${b}. Cạnh huyền bằng?`;
      explain = `Pi-ta-go: √(${a}² + ${b}²) = √${a * a + b * b} = ${c}.`;
    } else if (kind < 0.75) {
      const x = int(rng, -9, 12); const a = int(rng, 2, 7); const b = int(rng, -15, 15); const c = a * x + b;
      ans = x; text = `Giải phương trình: ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;
      explain = `${a}x = ${c} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${a * x} ⇒ x = ${x}.`;
      return finishMath({ text, ans, explain, L, rng, allowNegative: true });
    } else {
      const a = int(rng, 2, 9); const b = int(rng, 2, 9);
      ans = (a + b) * (a + b); text = `(${a} + ${b})² = ?`; explain = `(${a} + ${b})² = ${a + b}² = ${ans}.`;
    }
  } else if (L === 7) {
    if (kind < 0.3) {
      let r1 = int(rng, -6, 6); let r2 = int(rng, -6, 6); if (r1 === r2) r2 += 2;
      const s = r1 + r2; const p = r1 * r2;
      ans = Math.max(r1, r2);
      text = `Nghiệm lớn hơn của x² ${s >= 0 ? '−' : '+'} ${Math.abs(s)}x ${p >= 0 ? '+' : '−'} ${Math.abs(p)} = 0 là?`;
      explain = `Tổng hai nghiệm = ${s}, tích = ${p} ⇒ x = ${r1} và x = ${r2}.`;
      return finishMath({ text, ans, explain, L, rng, allowNegative: true });
    } else if (kind < 0.55) {
      const a = int(rng, 1, 4); const b = int(rng, -5, 5); const c = int(rng, -6, 6); const x = int(rng, -3, 4);
      ans = a * x * x + b * x + c;
      text = `Cho f(x) = ${a === 1 ? '' : a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)}. Tính f(${x}).`;
      explain = `f(${x}) = ${a}·${x * x} ${b < 0 ? '−' : '+'} ${Math.abs(b * x)} ${c < 0 ? '−' : '+'} ${Math.abs(c)} = ${ans}.`;
      return finishMath({ text, ans, explain, L, rng, allowNegative: true });
    } else if (kind < 0.8) {
      const x = int(rng, -5, 8); const y = int(rng, -5, 8);
      ans = x; text = `Hệ: x + y = ${x + y} và x − y = ${x - y}. Tìm x.`; explain = `Cộng hai phương trình: 2x = ${2 * x} ⇒ x = ${x}.`;
      return finishMath({ text, ans, explain, L, rng, allowNegative: true });
    } else {
      const n = int(rng, 5, 12); const k = int(rng, 1, 3);
      ans = Math.round(fact(n) / (fact(k) * fact(n - k))); text = `Số tổ hợp chập ${k} của ${n} phần tử, C(${n},${k}) = ?`;
      explain = `C(${n},${k}) = ${n}! / (${k}!·${n - k}!) = ${ans}.`;
    }
  } else {
    if (kind < 0.25) {
      const b = pick(rng, [2, 3, 10]); const e = b === 10 ? int(rng, 1, 5) : int(rng, 2, b === 2 ? 10 : 5);
      ans = e; text = `log${b === 10 ? '' : `_${b}`}(${b ** e}) = ?`; explain = `${b}^${e} = ${b ** e}.`;
    } else if (kind < 0.5) {
      const n = int(rng, 2, 5); const x = int(rng, 1, 3); const a = int(rng, 1, 5);
      ans = a * n * x ** (n - 1); text = `Cho f(x) = ${a === 1 ? '' : a}x^${n}. Tính f'(${x}).`;
      explain = `f'(x) = ${a * n}x^${n - 1} ⇒ f'(${x}) = ${ans}.`;
    } else if (kind < 0.75) {
      const u1 = int(rng, 1, 10); const d = int(rng, 2, 6); const n = int(rng, 5, 12);
      ans = u1 + (n - 1) * d; text = `Cấp số cộng có u₁ = ${u1}, công sai d = ${d}. Tìm u${subscript(n)}.`;
      explain = `uₙ = u₁ + (n − 1)d = ${u1} + ${n - 1}·${d} = ${ans}.`;
    } else {
      const a = int(rng, 1, 4); const b = int(rng, a + 1, a + 4);
      ans = b * b - a * a; text = `Tính tích phân ∫ từ ${a} đến ${b} của 2x dx.`; explain = `∫2x dx = x² ⇒ ${b}² − ${a}² = ${ans}.`;
    }
  }
  return finishMath({ text, ans, explain, L, rng, allowNegative: false });
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const subscript = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);

function finishMath({ text, ans, explain, L, rng, allowNegative }) {
  const difficulty = Math.min(3, L <= 5 ? L : L - 5);
  return makeQuestion({
    id: `math:${text}`, subject: 'math', difficulty, text,
    correct: ans, wrong: mathDistractors(ans, rng, allowNegative),
    explain: explain || `${text.replace('?', String(ans))}`,
  }, rng);
}

// ---------- Câu hỏi riêng ----------
// Mỗi dòng: Câu hỏi | Đáp án đúng | Sai 1 | Sai 2 | Sai 3   (cần ít nhất 1 đáp án sai, dòng # là ghi chú)
export function parseCustomQuestions(textBlock) {
  const questions = [];
  const errors = [];
  String(textBlock || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) { errors.push(i + 1); return; }
    const [q, a, ...w] = parts;
    questions.push({ q, a, w: w.slice(0, 3) });
  });
  return { questions, errors };
}

// Câu từ bộ đề của giáo viên: { id, q, a, w, e, d }
const customId = (item, index) => `custom-${item.id || index}-${item.q}`;
function fromCustom(item, index, rng) {
  const tf = item.t === 'tf' && ['Đúng', 'Sai'].includes(item.a) && item.w?.length === 1;
  const q = makeQuestion({
    id: customId(item, index), subject: 'custom', difficulty: item.d || 1, text: item.q,
    correct: item.a, wrong: item.w, explain: item.e || '', fixedOrder: tf ? ['Đúng', 'Sai'] : null,
  }, rng);
  if (item.setCode) q.setCode = item.setCode; // bộ đề tải bằng mã → ghi báo cáo cho giáo viên
  // Câu từ sách giáo khoa: bài học + nội dung liên quan để xem lại khi trả lời sai.
  if (item.l) q.lesson = item.l;
  if (item.r) q.ref = item.r;
  if (item.t) q.qtype = item.t;
  return q;
}

// Chọn câu hỏi phù hợp độ khó, tránh lặp câu vừa hỏi, ưu tiên ôn lại câu từng sai.
// opts: { subjects, grade offset, recent: [id], review: [question], custom: [item] }
export function pickQuestion(difficulty, opts = {}, rng = Math.random) {
  const { subjects = ['math'], mathOffset = 0, recent = [], review = [], custom = [], grade = null } = opts;
  if (review.length && rng() < 0.25) {
    const q = review[Math.floor(rng() * review.length)];
    const correct = q.choices[q.answer];
    const shuffled = q.qtype === 'tf' ? q.choices : shuffle(q.choices, rng);
    return { ...q, choices: shuffled, answer: shuffled.indexOf(correct), isReview: true };
  }
  let usable = subjects.filter((s) => s !== 'custom' || custom.length);
  if (!usable.length) usable = ['math'];
  const subject = usable[Math.floor(rng() * usable.length)];
  if (subject === 'math') {
    const lv = grade == null ? difficulty + mathOffset : mathLevel(grade, difficulty);
    let q = mathQuestion(lv, rng);
    for (let tries = 0; tries < 5 && recent.includes(q.id); tries++) q = mathQuestion(lv, rng);
    return { ...q, difficulty };
  }
  if (subject === 'custom') {
    // Ưu tiên câu đúng độ khó của con cá; hết thì lấy câu bất kỳ trong bộ đề.
    const all = custom.map((item, index) => ({ item, index }));
    const byLevel = all.filter(({ item }) => (item.d || 1) === difficulty);
    const base = byLevel.length ? byLevel : all;
    const fresh = base.filter(({ item, index }) => !recent.includes(customId(item, index)));
    const pool = fresh.length ? fresh : base;
    const { item, index } = pool[Math.floor(rng() * pool.length)];
    return fromCustom(item, index, rng);
  }
  let all = bankQuestions(subject, grade);
  if (!all.length && grade != null) all = bankQuestions(subject); // môn chưa có câu cho khối này → lấy câu cùng môn
  if (!all.length) return pickQuestion(difficulty, { ...opts, subjects: ['math'], review: [] }, rng);
  const byLevel = all.filter(({ item }) => item.d === difficulty);
  const base = byLevel.length ? byLevel : all;
  const fresh = base.filter(({ id }) => !recent.includes(id));
  const pool = fresh.length ? fresh : base;
  const { item, id } = pool[Math.floor(rng() * pool.length)];
  // Câu lấy từ nguồn phụ (vd câu "Khoa học" dùng cho "Tự nhiên và Xã hội") vẫn ghi theo môn đang học.
  return fromBank(item, id, rng, subjectInfo(subject) ? subject : item.s);
}
