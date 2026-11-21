// Thế giới chung: thấy các bạn đang câu cùng khu, theo thời gian thực.
// - Mỗi khu câu là một "kênh": người cùng khu thấy nhau (tối đa MAX_VISIBLE người hiện trên hồ).
// - Chia sẻ: biệt danh, cấp, cần câu, màu áo, diện mạo (giới tính, tóc, trang phục, mũ), hành động (ném / chờ / cá cắn / kéo / câu được), biểu cảm.
// - Biểu cảm có sẵn đi qua kênh này; tin nhắn gõ chữ đi qua máy chủ (chat-ui.js) để được lọc và kiểm duyệt.
// - Không gửi mã bí mật của người chơi: chỉ một mã công khai ngẫu nhiên (publicId).
// Chạy bằng Supabase Realtime (presence + broadcast); để thử nghiệm có thể dùng BroadcastChannel giữa các tab.
import { FISH, RODS } from './data.js';
import { normalizeLook } from './engine.js';

export const MAX_VISIBLE = 7;
export const PHASES = ['idle', 'charge', 'cast', 'wait', 'bite', 'fight', 'question', 'result'];
export const EMOTES = [
  ['👋', 'Xin chào!'], ['🎉', 'Hay quá!'], ['👍', 'Tuyệt vời!'], ['😂', 'Haha!'],
  ['🐟', 'Cá to quá!'], ['💪', 'Cố lên!'], ['🏆', 'Mình câu được rồi!'], ['❤️', 'Cảm ơn bạn!'],
];
const SHIRTS = ['#2f6db5', '#c0392b', '#16a085', '#8e44ad', '#d35400', '#2c3e50', '#27ae60', '#e67e22', '#e84393', '#0097a7'];

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n).trim();
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const colorFor = (id) => SHIRTS[hash(id) % SHIRTS.length];

export function makePublicId() {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// Lọc dữ liệu nhận từ người khác (không tin dữ liệu bên ngoài).
export function sanitizeMeta(m) {
  if (!m || typeof m !== 'object') return null;
  const id = clean(m.id, 24);
  if (!/^[a-z0-9]{6,24}$/.test(id)) return null;
  const level = Math.max(1, Math.min(999, Math.round(Number(m.level) || 1)));
  return {
    id, name: clean(m.name, 16) || 'Ngư dân', level,
    rod: RODS.some((r) => r.id === m.rod) ? m.rod : 'bamboo',
    color: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : colorFor(id),
    title: clean(m.title, 24), joined: Number(m.joined) || 0,
    // Diện mạo (nam/nữ, tóc, trang phục, mũ) – chỉ nhận giá trị trong danh sách có sẵn.
    look: m.look && typeof m.look === 'object' ? normalizeLook(m.look) : null,
  };
}
export function sanitizeEvent(type, p) {
  if (!p || typeof p !== 'object') return null;
  const id = clean(p.id, 24);
  if (!/^[a-z0-9]{6,24}$/.test(id)) return null;
  if (type === 'act') {
    if (!PHASES.includes(p.phase)) return null;
    return { id, phase: p.phase, dist: Math.max(4, Math.min(30, Number(p.dist) || 12)), tension: Math.max(0, Math.min(1, Number(p.tension) || 0)) };
  }
  if (type === 'catch') {
    const fish = FISH.find((f) => f.id === p.fishId);
    if (!fish) return null;
    return { id, fishId: fish.id, kg: Math.max(0, Math.min(10000, Number(p.kg) || 0)) };
  }
  if (type === 'emote') {
    const i = Math.round(Number(p.e));
    return i >= 0 && i < EMOTES.length ? { id, e: i } : null;
  }
  return null;
}

// Giữ chỗ ngồi cố định cho người đã có mặt; người mới lấy chỗ trống. Trả về Map id → số chỗ.
export function assignSlots(players, prev = new Map(), max = MAX_VISIBLE) {
  const next = new Map();
  const ids = players.map((p) => p.id);
  for (const id of ids) if (prev.has(id) && next.size < max) next.set(id, prev.get(id));
  const used = new Set(next.values());
  for (const id of ids) {
    if (next.has(id) || next.size >= max) continue;
    let s = 0;
    while (used.has(s)) s++;
    next.set(id, s);
    used.add(s);
  }
  return next;
}

// ---------------------------------------------------------------- truyền dữ liệu
function supabaseTransport({ url, key }) {
  let client = null;
  let ch = null;
  return {
    async open(name, meta, on) {
      if (!window.supabase?.createClient) throw new Error('Chưa tải được thư viện kết nối.');
      client ||= window.supabase.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 8 } } });
      ch = client.channel(name, { config: { presence: { key: meta.id }, broadcast: { self: false } } });
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState();
        on.presence(Object.values(st).map((arr) => arr[arr.length - 1]));
      });
      for (const ev of ['act', 'catch', 'emote']) ch.on('broadcast', { event: ev }, ({ payload }) => on.event(ev, payload));
      ch.subscribe(async (status) => {
        on.status(status);
        if (status === 'SUBSCRIBED') await ch.track(meta);
      });
    },
    async update(meta) { if (ch) await ch.track(meta); },
    send(event, payload) { ch?.send({ type: 'broadcast', event, payload }); },
    async close() { if (ch && client) { await client.removeChannel(ch); ch = null; } },
  };
}

// Thử nghiệm trên cùng một máy: các tab cùng trình duyệt thấy nhau (không cần mạng).
function localTransport() {
  let bc = null;
  let beat = null;
  let me = null;
  const peers = new Map();
  let onRef = null;
  const emitPresence = () => {
    const now = Date.now();
    for (const [id, p] of peers) if (now - p.at > 6000) peers.delete(id);
    onRef?.presence([me, ...[...peers.values()].map((p) => p.meta)]);
  };
  return {
    async open(name, meta, on) {
      me = meta; onRef = on;
      bc = new BroadcastChannel(`fishing-world:${name}`);
      bc.onmessage = ({ data }) => {
        if (data.kind === 'hello' || data.kind === 'beat') {
          peers.set(data.meta.id, { meta: data.meta, at: Date.now() });
          if (data.kind === 'hello') bc.postMessage({ kind: 'beat', meta: me });
          emitPresence();
        } else if (data.kind === 'bye') { peers.delete(data.id); emitPresence(); }
        else if (data.kind === 'event') on.event(data.event, data.payload);
      };
      bc.postMessage({ kind: 'hello', meta });
      beat = setInterval(() => { bc.postMessage({ kind: 'beat', meta: me }); emitPresence(); }, 2000);
      on.status('SUBSCRIBED');
      emitPresence();
    },
    async update(meta) { me = meta; bc?.postMessage({ kind: 'beat', meta }); },
    send(event, payload) { bc?.postMessage({ kind: 'event', event, payload }); },
    async close() {
      clearInterval(beat);
      bc?.postMessage({ kind: 'bye', id: me?.id });
      bc?.close();
      bc = null;
      peers.clear();
    },
  };
}

// ---------------------------------------------------------------- thế giới
export function createWorld({ identity, onPlayers, onEvent, onStatus, mode = 'supabase', url, key }) {
  const transport = mode === 'local' ? localTransport() : supabaseTransport({ url, key });
  let zone = null;
  let lastAct = null;
  let lastActAt = 0;
  let lastEmoteAt = 0;
  let joined = 0;
  let enabled = true;

  const meta = () => ({ ...identity(), joined });

  async function join(z) {
    if (!enabled || z === zone) return;
    await leave();
    zone = z;
    joined = Date.now();
    const me = meta();
    try {
      await transport.open(`fishing:world:${z}`, me, {
        presence: (list) => {
          const players = list.map(sanitizeMeta).filter((p) => p && p.id !== me.id)
            .sort((a, b) => a.joined - b.joined);
          onPlayers(players, list.length);
        },
        event: (type, payload) => {
          const ev = sanitizeEvent(type, payload);
          if (ev && ev.id !== me.id) onEvent(type, ev);
        },
        status: (s) => onStatus?.(s),
      });
    } catch (err) { onStatus?.('ERROR', err); }
  }

  async function leave() {
    if (!zone) return;
    zone = null;
    lastAct = null;
    await transport.close().catch(() => {});
    onPlayers([], 0);
  }

  return {
    join,
    leave,
    get zone() { return zone; },
    setEnabled(on, z) { enabled = on; if (!on) leave(); else if (z) join(z); },
    async refreshMeta() { if (zone) await transport.update(meta()).catch(() => {}); },
    // Hành động: chỉ gửi khi đổi pha (hoặc mỗi 1 giây khi đang kéo cá để cập nhật độ căng).
    act(phase, extra = {}) {
      if (!zone) return;
      const now = Date.now();
      if (phase === lastAct && (phase !== 'fight' || now - lastActAt < 1000)) return;
      lastAct = phase;
      lastActAt = now;
      transport.send('act', { id: identity().id, phase, ...extra });
    },
    caught(fishId, kg) { if (zone) transport.send('catch', { id: identity().id, fishId, kg }); },
    // Biểu cảm: tối đa 1 lần / 1,5 giây.
    emote(i) {
      if (!zone) return false;
      const now = Date.now();
      if (now - lastEmoteAt < 1500) return false;
      lastEmoteAt = now;
      transport.send('emote', { id: identity().id, e: i });
      return true;
    },
  };
}
