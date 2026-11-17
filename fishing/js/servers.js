// Server lớp học: mỗi server có thế giới (tiến trình) riêng, lưu trên máy chủ và đệm ở máy.
// - "Thế giới của em" (cá nhân): khoá lưu cũ SAVE_KEY, như trước.
// - Mỗi server: khoá `cauca-server-<MÃ>`; tài khoản (mã bí mật, mã công khai, tên) nhớ trong `cauca-servers`.
// Đổi thế giới = lưu thế giới hiện tại, ghi thế giới đang chọn, tải lại trang.
import { SAVE_KEY } from './engine.js';
import { rpc, cleanClassCode } from './chat.js';

export const WORLD_KEY = 'cauca-world';
export const SERVERS_KEY = 'cauca-servers';
export const slotKey = (code) => (code ? `cauca-server-${code}` : SAVE_KEY);

const read = (storage, k, fallback) => { try { const v = JSON.parse(storage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
const write = (storage, k, v) => { try { storage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function knownServers(storage) {
  const list = read(storage, SERVERS_KEY, []);
  return Array.isArray(list) ? list.filter((s) => s && s.code && s.key) : [];
}
export function rememberServer(storage, entry) {
  const list = knownServers(storage).filter((s) => s.code !== entry.code);
  list.unshift({ ...entry, at: Date.now() });
  write(storage, SERVERS_KEY, list.slice(0, 20));
}
export function forgetServer(storage, code) {
  write(storage, SERVERS_KEY, knownServers(storage).filter((s) => s.code !== code));
  try { storage.removeItem(slotKey(code)); } catch { /* */ }
  if (activeWorld(storage) === code) setActiveWorld(storage, null);
}
export function activeWorld(storage) {
  const code = read(storage, WORLD_KEY, null);
  return code && knownServers(storage).some((s) => s.code === code) ? code : null;
}
export function setActiveWorld(storage, code) { write(storage, WORLD_KEY, code || null); }

// Gắn danh tính tài khoản server vào bản lưu (bản lưu trên máy chủ không chứa mã bí mật).
export function applyServerIdentity(state, entry) {
  state.server = { code: entry.code, name: entry.name };
  state.online = { ...(state.online || {}), key: entry.key, publicId: entry.pid, nickname: entry.nick };
  state.chat = { ...(state.chat || {}), classCode: entry.code };
  delete state.cloud;
  return state;
}
// Bản gửi lên máy chủ: bỏ mã bí mật, mã lưu đám mây cá nhân, dữ liệu chỉ thuộc máy này.
export function serverSnapshot(state) {
  const { cloud, server, serverSavedAt, ...rest } = state;
  return { ...rest, online: { ...(rest.online || {}), key: null, ownerKey: null } };
}
export const isNewer = (a, b) => !!a && (!b || new Date(a).getTime() > new Date(b).getTime() + 500);

export const SERVER_ERRORS = {
  'account not found': 'Không tìm thấy tài khoản này – kiểm tra tên đăng nhập hoặc tạo tài khoản mới.',
  'username taken': 'Tên đăng nhập này đã có người dùng – hãy chọn tên khác.',
  'bad username': 'Tên đăng nhập gồm 3–20 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới (vd: an.5a).',
  'wrong server pin': 'Sai mã PIN của server – hỏi lại thầy cô nhé.',
  'name not in server': 'Không có tên này trong server. Nếu chưa có tài khoản, hãy đăng nhập tài khoản của em ở trên rồi vào server.',
  'use account': 'Tên này dùng tài khoản chung – hãy đăng nhập tài khoản của em ở trên.',
  'bad access': 'Cách vào server không hợp lệ.',
  'wrong pin': 'Sai mã PIN.',
  'too many tries': 'Sai PIN quá nhiều lần – hãy đợi 5 phút hoặc nhờ thầy cô đặt lại PIN.',
  'pin must be 4-6 digits': 'PIN gồm 4–6 chữ số.',
  'ask teacher for pin': 'Tài khoản này chưa có PIN – nhờ thầy cô bấm “Đặt lại PIN”.',
  'server is invite only': 'Server này chỉ dành cho học sinh thầy cô đã tạo tài khoản – hãy nhập đúng tên và PIN thầy cô phát.',
  'set not found': 'Không tìm thấy bộ đề với mã này.',
  'too many names': 'Mỗi lần thêm tối đa 80 tên.',
  'save too large': 'Bản lưu quá lớn.',
};

// ---------------------------------------------------------------- tài khoản chung
export const ACCOUNT_KEY = 'cauca-account';
export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const cleanUsername = (u) => String(u || '').trim().toLowerCase();
export function getAccount(storage) {
  const a = read(storage, ACCOUNT_KEY, null);
  return a && a.key && a.username ? a : null;
}
export function setAccount(storage, a) { write(storage, ACCOUNT_KEY, { key: a.key, username: a.username, nickname: a.nickname }); }
// Đăng xuất trên máy dùng chung: xoá tài khoản, các server đã vào và thế giới cá nhân của tài khoản (đã lưu trên mạng).
export function logoutAccount(storage, personalKey = SAVE_KEY) {
  const a = getAccount(storage);
  for (const sv of knownServers(storage)) { try { storage.removeItem(slotKey(sv.code)); } catch { /* */ } }
  write(storage, SERVERS_KEY, []);
  setActiveWorld(storage, null);
  try {
    const personal = JSON.parse(storage.getItem(personalKey));
    if (a && personal?.account === a.username) storage.removeItem(personalKey);
  } catch { /* */ }
  try { storage.removeItem(ACCOUNT_KEY); } catch { /* */ }
}
export const accountApi = {
  register: (username, nickname, pin, f) => rpc('fishing_account_register', { p_username: cleanUsername(username), p_nickname: nickname, p_pin: String(pin || '') }, f),
  login: (username, pin, f) => rpc('fishing_account_login', { p_username: cleanUsername(username), p_pin: String(pin || '') }, f),
  me: (key, f) => rpc('fishing_account_me', { p_key: key }, f),
  save: (key, save, f) => rpc('fishing_account_save', { p_key: key, p_save: save }, f),
  changePin: (key, oldPin, newPin, f) => rpc('fishing_account_change_pin', { p_key: key, p_old: String(oldPin || ''), p_new: String(newPin || '') }, f),
};
// Bản lưu thế giới cá nhân gửi lên tài khoản (bỏ mã bí mật, dữ liệu chỉ thuộc máy này).
export function accountSnapshot(state) {
  const { cloud, server, serverSavedAt, accountSavedAt, ...rest } = state;
  return { ...rest, online: { ...(rest.online || {}), key: null, ownerKey: null } };
}
export const ACCESS_LABEL = { open: '🚪 Vào tự do', pin: '🔢 Cần mã PIN của server', list: '📋 Chỉ tài khoản thầy cô tạo' };

export const serverApi = {
  join: (accountKey, code, serverPin, f) => rpc('fishing_server_join', { p_key: accountKey, p_code: cleanClassCode(code), p_server_pin: serverPin ? String(serverPin) : null }, f),
  access: (t, code, access, pin, f) => rpc('fishing_server_access', { p_teacher: t, p_code: code, p_access: access, p_pin: pin ? String(pin) : null }, f),
  resetAccountPin: (t, code, pid, f) => rpc('fishing_server_reset_account_pin', { p_teacher: t, p_code: code, p_pid: pid }, f),
  info: (code, f) => rpc('fishing_server_info', { p_code: cleanClassCode(code) }, f),
  enter: (code, name, pin, f) => rpc('fishing_server_enter', { p_code: cleanClassCode(code), p_name: name, p_pin: String(pin || '') }, f),
  load: (key, code, f) => rpc('fishing_server_load', { p_player: key, p_code: code }, f),
  save: (key, code, save, progress, f) => rpc('fishing_server_save', { p_player: key, p_code: code, p_save: save, p_progress: progress }, f),
  top: (key, code, f) => rpc('fishing_server_top', { p_player: key, p_code: code }, f),
  config: (t, code, { description = null, allowJoin = null, setCode = null }, f) => rpc('fishing_server_config', { p_teacher: t, p_code: code, p_description: description, p_allow_join: allowJoin, p_set_code: setCode }, f),
  addStudents: (t, code, names, f) => rpc('fishing_server_add_students', { p_teacher: t, p_code: code, p_names: names }, f),
  resetPin: (t, code, pid, f) => rpc('fishing_server_reset_pin', { p_teacher: t, p_code: code, p_pid: pid }, f),
};

// Danh sách tên dán từ Excel / Word: mỗi dòng (hoặc dấu phẩy / chấm phẩy) một tên, bỏ số thứ tự đầu dòng.
export function parseNames(text) {
  const seen = new Set();
  return String(text || '').split(/[\n;,\t]+/)
    .map((s) => s.replace(/^\s*\d+[.)\-\s]+/, '').replace(/\s+/g, ' ').trim().slice(0, 16))
    .filter((s) => s.length >= 2 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}
