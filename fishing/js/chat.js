// Trò chuyện, Lớp học, Thầy cô, Quản trị – phần gọi máy chủ dùng chung cho trò chơi, trang thầy cô và trang admin.
// Máy chủ (supabase/004_chat_classes.sql) lọc từ tục, số điện thoại, link; giới hạn tốc độ; kiểm tra quyền từng phòng.
import { ONLINE } from './online.js';

export const CLASS_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const MAX_LEN = 200;

export async function rpc(name, body, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${ONLINE.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ONLINE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || `Lỗi máy chủ (${res.status})`);
  return data;
}

// ---------------------------------------------------------------- phòng chat
export const zoneRoom = (zoneId) => `zone:${zoneId}`;
export const classRoom = (code) => `class:${code}`;
export const matchRoom = (code) => `match:${code}`;
export function dmRoom(code, pidA, pidB) {
  const [a, b] = [pidA, pidB].sort();
  return `dm:${code}:${a}:${b}`;
}
export function parseRoom(room) {
  const p = String(room || '').split(':');
  if (p[0] === 'dm') return { kind: 'dm', code: p[1], a: p[2], b: p[3] };
  return { kind: p[0], id: p[1] };
}
export const cleanClassCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

// ---------------------------------------------------------------- lỗi → tiếng Việt
const ERRORS = {
  'slow down': 'Gửi chậm lại một chút nhé 🙂',
  'you are muted': 'Bạn đang bị tạm khoá chat.',
  'chat is turned off': 'Trò chuyện đang tạm tắt.',
  'lake chat is off': 'Chat ở hồ đang tắt – hãy chat trong lớp nhé.',
  'class chat is off': 'Thầy cô đã tắt chat của lớp.',
  'private chat is off': 'Nhắn riêng đang tắt.',
  'say hello first': 'Hãy đặt biệt danh trước khi trò chuyện.',
  'bad nickname': 'Biệt danh không phù hợp – hãy đổi biệt danh khác.',
  'public id taken': 'Mã người chơi bị trùng – hãy tải lại trang.',
  'class not found': 'Không tìm thấy lớp với mã này.',
  'join the class first': 'Bạn chưa ở trong lớp này.',
  'class is full': 'Lớp đã đủ 80 bạn.',
  'nickname already used in this class': 'Biệt danh này đã có bạn dùng trong lớp – hãy đổi biệt danh.',
  'not your conversation': 'Bạn không xem được cuộc trò chuyện này.',
  'join the match first': 'Bạn chưa vào trận này.',
  'message too long': 'Tin nhắn dài quá (tối đa 200 ký tự).',
  'empty message': 'Tin nhắn trống.',
  'cannot report yourself': 'Không thể báo cáo tin của chính mình.',
  'not the teacher of this class': 'Bạn không phải thầy cô của lớp này (mã giáo viên khác).',
  'not allowed': 'Bạn không có quyền với phòng chat này.',
  'too many classes': 'Mỗi thầy cô tạo tối đa 30 lớp.',
  'class name required': 'Hãy nhập tên lớp.',
  'student not found': 'Không tìm thấy học sinh.',
  'not admin': 'Mã quản trị không đúng.',
  'player not found': 'Không tìm thấy người chơi.',
  'account not found': 'Không tìm thấy tài khoản này.',
  'Failed to fetch': 'Không kết nối được máy chủ – kiểm tra mạng.',
};
export function chatError(err) {
  const m = String(err?.message || err);
  for (const [k, v] of Object.entries(ERRORS)) if (m.includes(k)) return v;
  return m;
}

// ---------------------------------------------------------------- tiện ích hiển thị
export function timeLabel(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? hm : `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${hm}`;
}
export function agoLabel(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}
// Gộp tin mới vào danh sách đã có (bỏ trùng, bỏ tin đã bị ẩn, giữ tối đa `max` tin).
export function mergeMessages(list, incoming = [], hidden = [], max = 150) {
  const gone = new Set(hidden);
  const byId = new Map(list.filter((m) => !gone.has(m.id)).map((m) => [m.id, m]));
  for (const m of incoming) if (!gone.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-max);
}

// Tiến độ gửi cho thầy cô – chỉ số liệu học tập, không gửi gì riêng tư.
export function progressSummary(state, levelFromXp) {
  const st = state.stats || {};
  const answered = st.answered || 0;
  const correct = st.correct || 0;
  return {
    level: levelFromXp(state.xp || 0), xp: Math.floor(state.xp || 0), coins: Math.floor(state.coins || 0),
    fish: st.catches || 0, species: Object.keys(state.collection || {}).length, casts: st.casts || 0,
    correct, wrong: Math.max(0, answered - correct), streak: st.streak || 0, best_streak: st.bestStreak || 0,
    legendary: (st.catchesByRarity?.legendary || 0) + (st.catchesByRarity?.mythic || 0),
    review: (state.review || []).length, zone: state.zone || '', rod: state.rod || '',
    subjects: Object.fromEntries(Object.entries(st.correctBySubject || {}).slice(0, 20)),
  };
}

// ---------------------------------------------------------------- API
export const chatApi = {
  hello: (key, pid, name, f) => rpc('fishing_chat_hello', { p_player: key, p_public_id: pid, p_nickname: name }, f),
  send: (key, room, body, f) => rpc('fishing_chat_send', { p_player: key, p_room: room, p_body: body }, f),
  poll: (key, cursors, f) => rpc('fishing_chat_poll', { p_player: key, p_cursors: cursors }, f),
  report: (key, id, reason, f) => rpc('fishing_chat_report', { p_player: key, p_message: id, p_reason: reason }, f),
};
export const classApi = {
  join: (key, pid, code, name, f) => rpc('fishing_class_join', { p_player: key, p_public_id: pid, p_code: cleanClassCode(code), p_nickname: name }, f),
  me: (key, code, f) => rpc('fishing_class_me', { p_player: key, p_code: code }, f),
  leave: (key, code, f) => rpc('fishing_class_leave', { p_player: key, p_code: code }, f),
  progress: (key, code, progress, f) => rpc('fishing_class_progress', { p_player: key, p_code: code, p_progress: progress }, f),
};
export const teacherApi = {
  create: (t, name, f) => rpc('fishing_class_create', { p_teacher: t, p_name: name }, f),
  list: (t, f) => rpc('fishing_class_list', { p_teacher: t }, f),
  dashboard: (t, code, f) => rpc('fishing_class_dashboard', { p_teacher: t, p_code: code }, f),
  update: (t, code, { name = null, chatOn = null, dmOn = null }, f) => rpc('fishing_class_update', { p_teacher: t, p_code: code, p_name: name, p_chat_on: chatOn, p_dm_on: dmOn }, f),
  member: (t, code, pid, action, minutes = 0, f) => rpc('fishing_class_member', { p_teacher: t, p_code: code, p_pid: pid, p_action: action, p_minutes: minutes }, f),
  remove: (t, code, f) => rpc('fishing_class_delete', { p_teacher: t, p_code: code }, f),
  messages: (t, room, before = null, f) => rpc('fishing_mod_messages', { p_key: t, p_room: room, p_before: before }, f),
  hide: (t, id, hidden, f) => rpc('fishing_mod_hide', { p_key: t, p_message: id, p_hidden: hidden }, f),
  reportDone: (t, id, f) => rpc('fishing_mod_report_done', { p_key: t, p_message: id }, f),
};
export const adminApi = {
  overview: (a, f) => rpc('fishing_admin_overview', { p_admin: a }, f),
  messages: (a, filter, search, before = null, f) => rpc('fishing_admin_messages', { p_admin: a, p_filter: filter, p_search: search, p_before: before }, f),
  hide: (a, id, hidden, f) => rpc('fishing_admin_hide', { p_admin: a, p_message: id, p_hidden: hidden }, f),
  reportDone: (a, id, f) => rpc('fishing_admin_report_done', { p_admin: a, p_message: id }, f),
  users: (a, search, f) => rpc('fishing_admin_users', { p_admin: a, p_search: search }, f),
  ban: (a, pid, hours, reason, purge, f) => rpc('fishing_admin_ban', { p_admin: a, p_pid: pid, p_hours: hours, p_reason: reason, p_purge: purge }, f),
  classes: (a, f) => rpc('fishing_admin_classes', { p_admin: a }, f),
  removeClass: (a, code, f) => rpc('fishing_admin_class_delete', { p_admin: a, p_code: code }, f),
  scores: (a, search, f) => rpc('fishing_admin_scores', { p_admin: a, p_search: search }, f),
  removeScore: (a, handle, f) => rpc('fishing_admin_score_delete', { p_admin: a, p_handle: handle }, f),
  setting: (a, key, value, f) => rpc('fishing_admin_setting', { p_admin: a, p_key: key, p_value: value }, f),
  resetAccount: (a, username, f) => rpc('fishing_admin_account_reset', { p_admin: a, p_username: username }, f),
};

// Tạo bảng CSV (dấu ; để Excel tiếng Việt mở đúng cột), có BOM UTF-8.
export function toCSV(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\n');
}
