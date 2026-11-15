// Bảng xếp hạng chung (Supabase). Trình duyệt chỉ gọi 3 hàm công khai:
// fishing_submit (nộp điểm), fishing_top (top người chơi), fishing_me (hạng của mình).
// Khoá "publishable" bên dưới được thiết kế để công khai trong trình duyệt; bảng điểm khoá bằng RLS
// nên không ai đọc/sửa trực tiếp được, và mã người chơi (player key) không bao giờ bị trả về cho người khác.
import { RARITIES, rarityIndex, fishById } from './data.js';

export const ONLINE = {
  url: 'https://ckbdbcprsgsiunliqhhp.supabase.co',
  key: 'sb_publishable_KyAFLlc0Y9FqsUGlZTE2-g_vEsCNeqq',
};

export const NICK_MIN = 2;
export const NICK_MAX = 16;

export function cleanNickname(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
}

export function validNickname(nick) {
  const n = cleanNickname(nick);
  if (n.length < NICK_MIN) return 'Biệt danh cần ít nhất 2 ký tự.';
  if (/(https?:|www\.|\.com|\.vn)/i.test(n)) return 'Biệt danh không được chứa đường link.';
  return '';
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Mã người chơi bí mật lưu trong trình duyệt – dùng để cập nhật đúng dòng điểm của mình.
export function ensurePlayerKey(state) {
  state.online ||= {};
  if (!state.online.key) state.online.key = uuid();
  return state.online.key;
}

// Con cá quý nhất từng câu được (độ hiếm cao nhất, cùng độ hiếm thì giá cao hơn).
export function bestFish(state) {
  let best = null;
  for (const id of Object.keys(state.collection || {})) {
    const f = fishById(id);
    if (!f) continue;
    const t = rarityIndex(f.rarity);
    if (!best || t > best.tier || (t === best.tier && f.value > best.fish.value)) best = { fish: f, tier: t };
  }
  return best ? { name: best.fish.name, rarity: best.tier } : { name: null, rarity: 0 };
}

export function buildSubmission(state) {
  const best = bestFish(state);
  return {
    p_key: ensurePlayerKey(state),
    p_nickname: cleanNickname(state.online.nickname),
    p_xp: Math.max(0, Math.floor(state.xp)),
    p_species: Object.keys(state.collection || {}).length,
    p_correct: state.stats?.correct || 0,
    p_best_fish: best.name,
    p_best_rarity: best.rarity,
  };
}

async function rpc(name, body, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${ONLINE.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ONLINE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Lỗi máy chủ (${res.status})`);
  return data;
}

// Nộp điểm. Trả về { rank, total, xp } (xp là điểm máy chủ đã ghi nhận).
export async function submitScore(state, fetchImpl) {
  if (!cleanNickname(state.online?.nickname)) return null;
  const rows = await rpc('fishing_submit', buildSubmission(state), fetchImpl);
  const row = rows?.[0] || null;
  if (row) Object.assign(state.online, { rank: row.rank, total: row.total, serverXp: row.xp, lastSubmit: Date.now() });
  return row;
}

export async function topPlayers(limit = 50, fetchImpl) {
  return (await rpc('fishing_top', { p_limit: limit }, fetchImpl)) || [];
}

export async function myRank(state, fetchImpl) {
  if (!state.online?.key) return null;
  const rows = await rpc('fishing_me', { p_key: state.online.key }, fetchImpl);
  return rows?.[0] || null;
}

export const rarityColor = (tier) => RARITIES[Math.max(0, Math.min(5, tier || 0))].color;
export const rarityName = (tier) => RARITIES[Math.max(0, Math.min(5, tier || 0))].name;

// ---------- Chia sẻ bộ đề qua mã 6 ký tự ----------
// Mã chủ sở hữu (bí mật, lưu trong trình duyệt người tạo) cho phép cập nhật lại đúng mã đã chia sẻ.
export const SET_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export async function publishSet(state, set, fetchImpl) {
  state.online ||= {};
  if (!state.online.ownerKey) state.online.ownerKey = ensurePlayerKey({ online: {} });
  const payload = set.questions.map(({ q, a, w, e, d }) => ({ q, a, w, e: e || '', d: d || 1 }));
  const code = await rpc('fishing_set_publish', {
    p_owner: state.online.ownerKey, p_name: set.name, p_payload: payload, p_code: set.code || null,
  }, fetchImpl);
  set.code = code;
  return code;
}

export async function fetchSet(code, fetchImpl) {
  const c = cleanCode(code);
  if (!SET_CODE_RE.test(c)) throw new Error('Mã bộ đề gồm 6 ký tự (chữ in hoa và số), ví dụ: K7M2QX.');
  const rows = await rpc('fishing_set_get', { p_code: c }, fetchImpl);
  if (!rows?.length) throw new Error(`Không tìm thấy bộ đề mã ${c}. Kiểm tra lại mã với thầy cô nhé.`);
  return rows[0];
}

// ---------- Lưu tiến trình lên mạng (mã lưu 12 ký tự, máy chủ chỉ giữ dạng băm) ----------
export const cleanSaveCode = (c) => {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return s.length === 12 ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}` : s;
};
// Bản lưu gửi lên: bỏ các thứ chỉ thuộc về máy này (mã lưu chính nó, thời điểm đồng bộ).
export function cloudSnapshot(state) {
  const { cloud, ...rest } = state;
  return rest;
}
export async function cloudCreate(state, fetchImpl) {
  const code = await rpc('fishing_cloud_create', { p_save: cloudSnapshot(state) }, fetchImpl);
  state.cloud = { code, syncedAt: Date.now() };
  return code;
}
export async function cloudPush(state, fetchImpl) {
  if (!state.cloud?.code) return null;
  const at = await rpc('fishing_cloud_put', { p_code: state.cloud.code, p_save: cloudSnapshot(state) }, fetchImpl);
  state.cloud.syncedAt = Date.now();
  return at;
}
export async function cloudFetch(code, fetchImpl) {
  const c = cleanSaveCode(code);
  if (c.replace(/-/g, '').length !== 12) throw new Error('Mã lưu gồm 12 ký tự, ví dụ: QCVR-KDCT-ZDSZ.');
  const rows = await rpc('fishing_cloud_get', { p_code: c }, fetchImpl);
  if (!rows?.length) throw new Error('Không tìm thấy bản lưu với mã này. Kiểm tra lại từng ký tự nhé.');
  return { code: c, save: rows[0].save, updatedAt: rows[0].updated_at };
}

// ---------- Báo cáo bộ đề cho giáo viên ----------
export async function logSetAnswer(state, setCode, question, ok, fetchImpl) {
  if (!setCode) return;
  await rpc('fishing_set_log', {
    p_code: setCode, p_player: ensurePlayerKey(state), p_nickname: cleanNickname(state.online?.nickname) || 'Ẩn danh',
    p_q: question, p_ok: !!ok,
  }, fetchImpl);
}
export async function setReport(state, setCode, fetchImpl) {
  return rpc('fishing_set_report', { p_code: setCode, p_owner: state.online?.ownerKey }, fetchImpl);
}

// ---------- Thi đấu ----------
export const MATCH_ERRORS = {
  'match not found': 'Không tìm thấy trận với mã này.',
  'team is full': 'Đội này đã đủ người – chọn đội khác nhé.',
  'nickname already used in this match': 'Biệt danh này đã có người dùng trong trận – hãy đổi biệt danh.',
  'match has ended': 'Trận đã kết thúc.',
  'match is not running': 'Trận chưa bắt đầu hoặc đã hết giờ.',
  'already answered': 'Câu này bạn đã trả lời rồi.',
  'not the owner of this match': 'Chỉ người tạo trận mới làm được việc này.',
  'no players yet': 'Chưa có ai vào phòng.',
  'match already started': 'Trận đã bắt đầu rồi.',
  'join the match first': 'Bạn chưa vào trận.',
};
export function friendlyError(err) {
  const m = String(err?.message || err);
  for (const [k, v] of Object.entries(MATCH_ERRORS)) if (m.includes(k)) return v;
  return m;
}
const ownerKey = (state) => {
  state.online ||= {};
  if (!state.online.ownerKey) state.online.ownerKey = ensurePlayerKey({ online: {} });
  return state.online.ownerKey;
};
export const matchApi = {
  create: (state, { mode, title, teams, teamSize, questions, live, minutes }, f) => rpc('fishing_match_create', {
    p_owner: ownerKey(state), p_mode: mode, p_title: title, p_teams: teams, p_team_size: teamSize,
    p_questions: questions.map(({ q, a, w, e, d }) => ({ q, a, w, e: e || '', d: d || 1 })), p_live: live, p_minutes: minutes,
  }, f),
  join: (state, code, nickname, team, f) => rpc('fishing_match_join', { p_code: cleanCode(code), p_player: ensurePlayerKey(state), p_nickname: cleanNickname(nickname), p_team: team }, f),
  // Chủ trận xem bằng mã chủ; người chơi xem bằng mã người chơi.
  // Luôn hỏi bằng mã người chơi (để biết mình đã vào trận chưa); quyền chủ trận ghi nhớ ở máy.
  info: (state, code, f) => rpc('fishing_match_info', { p_code: cleanCode(code), p_player: ensurePlayerKey(state) }, f),
  start: (state, code, f) => rpc('fishing_match_start', { p_code: cleanCode(code), p_owner: ownerKey(state) }, f),
  end: (state, code, f) => rpc('fishing_match_end', { p_code: cleanCode(code), p_owner: ownerKey(state) }, f),
  answer: (state, code, index, choice, ms, f) => rpc('fishing_match_answer', { p_code: cleanCode(code), p_player: ensurePlayerKey(state), p_index: index, p_choice: choice, p_ms: Math.round(ms) }, f),
  fish: (state, code, tier, f) => rpc('fishing_match_fish', { p_code: cleanCode(code), p_player: ensurePlayerKey(state), p_tier: tier }, f),
  board: (code, f) => rpc('fishing_match_board', { p_code: cleanCode(code) }, f),
  report: (state, code, f) => rpc('fishing_match_report', { p_code: cleanCode(code), p_owner: ownerKey(state) }, f),
};
