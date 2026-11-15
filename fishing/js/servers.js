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
  'wrong pin': 'Sai mã PIN.',
  'too many tries': 'Sai PIN quá nhiều lần – hãy đợi 5 phút hoặc nhờ thầy cô đặt lại PIN.',
  'pin must be 4-6 digits': 'PIN gồm 4–6 chữ số.',
  'ask teacher for pin': 'Tài khoản này chưa có PIN – nhờ thầy cô bấm “Đặt lại PIN”.',
  'server is invite only': 'Server này chỉ dành cho học sinh thầy cô đã tạo tài khoản – hãy nhập đúng tên và PIN thầy cô phát.',
  'set not found': 'Không tìm thấy bộ đề với mã này.',
  'too many names': 'Mỗi lần thêm tối đa 80 tên.',
  'save too large': 'Bản lưu quá lớn.',
};

export const serverApi = {
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
