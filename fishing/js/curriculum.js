// Chương trình học lớp 1–12 (theo Chương trình GDPT 2018): mỗi khối lớp có các môn tương ứng.
// Thầy cô chọn khối lớp + môn cho từng server; học sinh chơi cá nhân chỉ chọn khối lớp của mình.

export const GRADE_MIN = 1;
export const GRADE_MAX = 12;
export const GRADE_LIST = Array.from({ length: GRADE_MAX }, (_, i) => i + 1);

// sources: ngân hàng câu hỏi nào được dùng cho môn này (câu vẫn lọc theo khối lớp).
export const ALL_SUBJECTS = [
  { id: 'math', name: 'Toán', icon: '🔢' },
  { id: 'vi', name: 'Tiếng Việt', icon: '📖' },
  { id: 'lit', name: 'Ngữ văn', icon: '📚', sources: ['lit', 'vi'] },
  { id: 'en', name: 'Tiếng Anh', icon: '🔤' },
  { id: 'nature', name: 'Tự nhiên và Xã hội', icon: '🌱', sources: ['nature', 'sci'] },
  { id: 'sci', name: 'Khoa học', icon: '🔬' },
  { id: 'khtn', name: 'Khoa học tự nhiên', icon: '⚗️', sources: ['khtn', 'phy', 'chem', 'bio'] },
  { id: 'his', name: 'Lịch sử và Địa lí', icon: '🌏' },
  { id: 'ethics', name: 'Đạo đức', icon: '💛' },
  { id: 'civic', name: 'Giáo dục công dân', icon: '⚖️' },
  { id: 'phy', name: 'Vật lí', icon: '⚡' },
  { id: 'chem', name: 'Hoá học', icon: '🧪' },
  { id: 'bio', name: 'Sinh học', icon: '🧬' },
  { id: 'hist', name: 'Lịch sử', icon: '🏛️', sources: ['hist', 'his'] },
  { id: 'geo', name: 'Địa lí', icon: '🗺️', sources: ['geo', 'his'] },
  { id: 'ktpl', name: 'GD Kinh tế và Pháp luật', icon: '💼', sources: ['ktpl', 'civic'] },
  { id: 'it', name: 'Tin học', icon: '💻' },
  { id: 'tech', name: 'Công nghệ', icon: '🛠️' },
];

const BY_GRADE = {
  1: ['math', 'vi', 'en', 'nature', 'ethics'],
  2: ['math', 'vi', 'en', 'nature', 'ethics'],
  3: ['math', 'vi', 'en', 'nature', 'ethics', 'it', 'tech'],
  4: ['math', 'vi', 'en', 'sci', 'his', 'ethics', 'it', 'tech'],
  5: ['math', 'vi', 'en', 'sci', 'his', 'ethics', 'it', 'tech'],
  6: ['math', 'lit', 'en', 'khtn', 'his', 'civic', 'it', 'tech'],
  7: ['math', 'lit', 'en', 'khtn', 'his', 'civic', 'it', 'tech'],
  8: ['math', 'lit', 'en', 'khtn', 'his', 'civic', 'it', 'tech'],
  9: ['math', 'lit', 'en', 'khtn', 'his', 'civic', 'it', 'tech'],
  10: ['math', 'lit', 'en', 'phy', 'chem', 'bio', 'hist', 'geo', 'ktpl', 'it', 'tech'],
  11: ['math', 'lit', 'en', 'phy', 'chem', 'bio', 'hist', 'geo', 'ktpl', 'it', 'tech'],
  12: ['math', 'lit', 'en', 'phy', 'chem', 'bio', 'hist', 'geo', 'ktpl', 'it', 'tech'],
};

export const clampGrade = (g) => Math.min(GRADE_MAX, Math.max(GRADE_MIN, Math.round(Number(g)) || 1));
export const subjectsForGrade = (g) => [...BY_GRADE[clampGrade(g)]];
export const subjectInfo = (id) => ALL_SUBJECTS.find((s) => s.id === id);
export const subjectSources = (id) => subjectInfo(id)?.sources || [id];
export const gradeLabel = (g) => `Lớp ${clampGrade(g)}`;
export const levelLabel = (g) => (clampGrade(g) <= 5 ? 'Tiểu học' : clampGrade(g) <= 9 ? 'THCS' : 'THPT');

// Bản lưu cũ dùng 'g1' / 'g3' / 'g6' → đổi sang số lớp.
export function normalizeGrade(g) {
  if (typeof g === 'number' || /^\d+$/.test(String(g))) return clampGrade(g);
  return { g1: 2, g3: 4, g6: 7 }[g] || 1;
}
// Chỉ giữ môn hợp lệ với khối lớp (và bộ đề của thầy cô nếu có).
export function cleanSubjects(list, grade) {
  const allowed = new Set(subjectsForGrade(grade));
  const out = (list || []).filter((s) => allowed.has(s) || s === 'custom');
  return out.some((s) => s !== 'custom') ? [...new Set(out)] : [...subjectsForGrade(grade), ...(out.includes('custom') ? ['custom'] : [])];
}

// Mức Toán sinh tự động (1–8) theo khối lớp.
const MATH_BASE = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 5, 8: 6, 9: 6, 10: 7, 11: 8, 12: 8 };
export function mathLevel(grade, difficulty = 2) {
  const base = MATH_BASE[clampGrade(grade)];
  return Math.max(1, Math.min(8, base + Math.min(1, difficulty - 2)));
}
