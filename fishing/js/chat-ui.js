// Hộp trò chuyện trong trò chơi: 🌊 Hồ (cùng khu) · 🏫 Lớp · ⚔️ Trận · 👤 Riêng (bạn cùng lớp).
// Không chặn trò chơi: khung chat nằm bên phải, vừa câu vừa chat được.
import { ensurePlayerKey, cleanNickname } from './online.js';
import { chatApi, classApi, chatError, zoneRoom, classRoom, matchRoom, dmRoom, parseRoom, mergeMessages, timeLabel,
  cleanClassCode, CLASS_CODE_RE, MAX_LEN, progressSummary } from './chat.js';

const QUICK = ['Xin chào! 👋', 'Hay quá! 🎉', 'Cố lên! 💪', 'Câu được cá to rồi 🐟', 'Câu này khó quá 🤔', 'Cảm ơn bạn ❤️'];

export function initChatUI({ getState, save, toast, esc, beep, scene, getZone, getZoneName, getMatchCode, levelFromXp, openSheet }) {
  const $ = (s) => document.querySelector(s);
  const panel = $('#chat-panel');
  const list = $('#chat-list');
  const input = $('#chat-input');
  const st = () => getState();
  const chat = () => (st().chat ||= { classCode: null, read: {}, lastProgress: 0 });
  const key = () => ensurePlayerKey(st());
  const pid = () => st().online?.publicId;
  const nick = () => cleanNickname(st().online?.nickname);

  let tab = 'lake';
  let dmWith = null;          // { pid, name } đang nhắn riêng
  let rooms = new Map();      // room → { messages: [], error }
  let cursors = {};           // room → id lớn nhất đã nhận
  let helloDone = '';
  let cls = null;             // thông tin lớp (fishing_class_me)
  let clsAt = 0;
  let mutedUntil = null;
  let settings = { chat_all: true, chat_public: true, chat_dm: true };
  let timer = null;
  let busy = false;
  let sending = false;

  // ---------------------------------------------------------------- phòng đang theo dõi
  function currentRoom() {
    if (tab === 'lake') return zoneRoom(getZone());
    if (tab === 'class') return cls ? classRoom(cls.code) : null;
    if (tab === 'match') return getMatchCode() ? matchRoom(getMatchCode()) : null;
    if (tab === 'dm') return cls && dmWith ? dmRoom(cls.code, pid(), dmWith.pid) : null;
    return null;
  }
  function watchedRooms() {
    const r = new Set([zoneRoom(getZone())]);
    if (cls) r.add(classRoom(cls.code));
    if (getMatchCode()) r.add(matchRoom(getMatchCode()));
    for (const d of cls?.dms || []) r.add(d.room);
    const cur = currentRoom();
    if (cur) r.add(cur);
    return [...r].slice(0, 12);
  }

  // ---------------------------------------------------------------- máy chủ
  async function hello() {
    const n = nick();
    if (!n || !pid()) return false;
    if (helloDone === n) return true;
    const r = await chatApi.hello(key(), pid(), n);
    helloDone = n;
    mutedUntil = r.muted_until;
    settings = { chat_all: r.chat_all, chat_public: r.chat_public, chat_dm: r.chat_dm };
    return true;
  }
  async function refreshClass(force = false) {
    const code = chat().classCode;
    if (!code) { cls = null; return; }
    if (!force && Date.now() - clsAt < 12000) return;
    clsAt = Date.now();
    try { cls = await classApi.me(key(), code); } catch (err) {
      if (/join the class first|class not found/.test(String(err.message))) {
        toast(`🏫 Bạn không còn ở lớp <b>${esc(code)}</b>.`);
        chat().classCode = null; cls = null; save();
      }
    }
  }
  async function poll() {
    if (busy || !nick()) return;
    busy = true;
    try {
      await hello();
      await refreshClass();
      const want = watchedRooms();
      const cur = Object.fromEntries(want.map((r) => [r, cursors[r] || 0]));
      const res = await chatApi.poll(key(), cur);
      mutedUntil = res.muted_until;
      settings = { chat_all: res.chat_all, chat_public: res.chat_public, chat_dm: res.chat_dm };
      let fresh = false;
      for (const [room, data] of Object.entries(res.rooms || {})) {
        const prev = rooms.get(room) || { messages: [] };
        if (data.error) { rooms.set(room, { ...prev, error: data.error }); continue; }
        const first = !cursors[room];
        const merged = mergeMessages(prev.messages, data.messages, data.hidden);
        const newOnes = data.messages.filter((m) => !prev.messages.some((p) => p.id === m.id));
        rooms.set(room, { messages: merged, error: null });
        if (merged.length) cursors[room] = Math.max(cursors[room] || 0, merged.at(-1).id);
        if (newOnes.length) fresh = true;
        // Lần đầu vào phòng: coi tin cũ là đã đọc. Tin mới ở hồ → hiện bong bóng trên đầu bạn đó.
        // (Tin nhắn riêng thì không: bạn nhắn cho mình lúc mình chưa mở phải được báo.)
        if (first && !room.startsWith('dm:')) { chat().read[room] = Math.max(chat().read[room] || 0, cursors[room] || 0); continue; }
        if (first) continue;
        if (room.startsWith('zone:')) for (const m of newOnes) if (!m.mine) scene.remoteEmote?.(m.pid, m.body.length > 42 ? `${m.body.slice(0, 40)}…` : m.body);
        if (newOnes.some((m) => !m.mine) && room !== currentRoom()) beep([[660, 0.05], [880, 0.07]]);
      }
      if (fresh && !panel.hidden) render(true);
      else if (!panel.hidden) renderStatus();
      markRead();
      badge();
    } catch (err) {
      console.warn('Chat:', err);
      if (!panel.hidden) renderStatus(chatError(err));
    } finally { busy = false; }
  }
  function schedule() {
    clearTimeout(timer);
    if (!nick()) return;
    timer = setTimeout(async () => { await poll(); schedule(); }, panel.hidden ? 10000 : 3000);
  }

  // ---------------------------------------------------------------- chưa đọc
  function unread(room) {
    const r = rooms.get(room);
    if (!r) return 0;
    const seen = chat().read[room] || 0;
    return r.messages.filter((m) => !m.mine && m.id > seen).length;
  }
  function markRead() {
    if (panel.hidden) return;
    const room = currentRoom();
    if (room && cursors[room]) chat().read[room] = cursors[room];
  }
  function tabUnread(t) {
    if (t === 'lake') return unread(zoneRoom(getZone()));
    if (t === 'class') return cls ? unread(classRoom(cls.code)) : 0;
    if (t === 'match') return getMatchCode() ? unread(matchRoom(getMatchCode())) : 0;
    if (t === 'dm') return (cls?.dms || []).reduce((s, d) => s + unread(d.room), 0);
    return 0;
  }
  function badge() {
    const n = ['lake', 'class', 'match', 'dm'].reduce((s, t) => s + (t === 'lake' ? 0 : tabUnread(t)), 0) + (tabUnread('lake') ? 1 : 0);
    const b = $('#chat-badge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
    for (const t of ['lake', 'class', 'match', 'dm']) {
      const el = panel.querySelector(`[data-chat-tab="${t}"] i`);
      if (el) { const k = tabUnread(t); el.hidden = !k || tab === t; el.textContent = k > 9 ? '9+' : k; }
    }
  }

  // ---------------------------------------------------------------- hiển thị
  const NOTICE = {
    lake: 'Mọi bạn đang câu ở khu này đều đọc được. Hãy lịch sự nhé!',
    class: 'Chỉ bạn trong lớp và thầy cô đọc được.',
    match: 'Các bạn trong trận và người tạo trận đọc được.',
    dm: 'Tin nhắn riêng giữa hai bạn cùng lớp – thầy cô của lớp có thể xem để giữ an toàn.',
  };
  function bubble(m) {
    return `<div class="msg ${m.mine ? 'mine' : ''}" data-id="${m.id}">
      ${m.mine ? '' : `<b class="who">${esc(m.name)}</b>`}
      <div class="txt">${esc(m.body)}</div>
      <div class="meta">${timeLabel(m.at)}${m.mine ? '' : ` <button class="report" data-report="${m.id}" title="Báo cáo tin nhắn không phù hợp">⚑</button>`}</div>
    </div>`;
  }
  function renderStatus(err) {
    const s = $('#chat-status');
    const muted = mutedUntil || cls?.me?.muted_until;
    let msg = err || rooms.get(currentRoom())?.error && chatError(rooms.get(currentRoom()).error) || '';
    if (!msg && muted && new Date(muted) > new Date()) msg = `🔇 Bạn bị tạm khoá chat đến ${timeLabel(muted)}.`;
    if (!msg && !settings.chat_all) msg = 'Trò chuyện đang tạm tắt.';
    if (!msg && tab === 'lake' && !settings.chat_public) msg = 'Chat ở hồ đang tắt – hãy chat trong lớp nhé.';
    if (!msg && tab === 'class' && cls && !cls.chat_on) msg = 'Thầy cô đã tắt chat của lớp.';
    if (!msg && tab === 'dm' && cls && !cls.dm_on) msg = 'Nhắn riêng đang tắt.';
    s.textContent = msg;
    s.hidden = !msg;
  }
  function render(keepScroll = false) {
    for (const b of panel.querySelectorAll('[data-chat-tab]')) b.classList.toggle('on', b.dataset.chatTab === tab);
    panel.querySelector('[data-chat-tab="match"]').hidden = !getMatchCode();
    const head = $('#chat-head');
    const compose = $('#chat-compose');
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    compose.hidden = false;
    if (!nick()) {
      head.innerHTML = '';
      list.innerHTML = `<div class="chat-empty">✏️ Hãy đặt <b>biệt danh</b> trước khi trò chuyện.<br><button class="btn small" id="chat-nick">Đặt biệt danh</button></div>`;
      compose.hidden = true;
      $('#chat-nick').onclick = () => { close(); openSheet('rank'); };
      renderStatus(); badge();
      return;
    }
    if ((tab === 'class' || tab === 'dm') && !cls) {
      head.innerHTML = '';
      list.innerHTML = `<div class="chat-empty">
        🏫 Vào <b>server lớp học</b> của thầy cô (mã server + tên + PIN) để chat cùng lớp và nhắn riêng với bạn.
        <button class="btn gold small" id="chat-server">🌐 Vào server lớp học</button></div>`;
      compose.hidden = true;
      $('#chat-server').onclick = () => { close(); openSheet('server'); };
      renderStatus(); badge();
      return;
    }
    if (tab === 'dm' && !dmWith) {
      head.innerHTML = `<div class="chat-sub">👤 Nhắn riêng với bạn cùng lớp <b>${esc(cls.name)}</b></div>`;
      const others = cls.members.filter((m) => m.pid !== pid());
      list.innerHTML = others.length ? `<div class="mate-list">${others.map((m) => {
        const room = dmRoom(cls.code, pid(), m.pid);
        const n = unread(room);
        return `<button class="mate" data-mate="${esc(m.pid)}"><span class="dot ${m.online ? 'on' : ''}"></span><b>${esc(m.name)}</b><small>Cấp ${m.level}</small>${n ? `<i class="badge">${n}</i>` : ''}</button>`;
      }).join('')}</div>` : '<div class="chat-empty">Lớp chưa có bạn nào khác.</div>';
      compose.hidden = true;
      renderStatus(); badge();
      return;
    }
    if (tab === 'class') {
      const online = cls.members.filter((m) => m.online).length;
      head.innerHTML = `<div class="chat-sub">🏫 <b>${esc(cls.name)}</b> · ${cls.members.length} bạn · <span class="ok">${online} đang chơi</span>
        <button class="link" id="chat-leave">Rời lớp</button></div>`;
      $('#chat-leave').onclick = leaveClass;
    } else if (tab === 'dm') {
      head.innerHTML = `<div class="chat-sub"><button class="link" id="chat-back">‹ Bạn cùng lớp</button> · 👤 <b>${esc(dmWith.name)}</b></div>`;
      $('#chat-back').onclick = () => { dmWith = null; render(); };
    } else if (tab === 'match') {
      head.innerHTML = `<div class="chat-sub">⚔️ Trận <b>${esc(getMatchCode())}</b></div>`;
    } else {
      head.innerHTML = `<div class="chat-sub">🌊 ${esc(getZoneName())} – mọi bạn cùng khu</div>`;
    }
    const msgs = rooms.get(currentRoom())?.messages || [];
    list.innerHTML = `<div class="chat-note">🛡️ ${NOTICE[tab]}</div>` + (msgs.length ? msgs.map(bubble).join('') : '<div class="chat-empty">Chưa có tin nhắn nào – hãy chào mọi người nhé! 👋</div>');
    if (!keepScroll || nearBottom) list.scrollTop = list.scrollHeight;
    markRead();
    renderStatus();
    badge();
  }

  // ---------------------------------------------------------------- hành động
  async function send(text) {
    const body = String(text || '').replace(/\s+/g, ' ').trim();
    const room = currentRoom();
    if (!body || !room || sending) return;
    if (body.length > MAX_LEN) { toast('Tin nhắn dài quá (tối đa 200 ký tự).'); return; }
    sending = true;
    try {
      await hello();
      const m = await chatApi.send(key(), room, body);
      const prev = rooms.get(room) || { messages: [] };
      rooms.set(room, { messages: mergeMessages(prev.messages, [m]), error: null });
      cursors[room] = Math.max(cursors[room] || 0, m.id);
      if (room.startsWith('zone:')) scene.selfEmote?.(m.body.length > 42 ? `${m.body.slice(0, 40)}…` : m.body);
      if (m.filtered) toast('🛡️ Một số từ trong tin nhắn đã bị che. Hãy dùng lời lẽ lịch sự nhé!');
      if (room.startsWith('dm:') && cls && !cls.dms?.some((d) => d.room === room)) cls.dms = [{ room, last_id: m.id }, ...(cls.dms || [])];
      input.value = '';
      updateCount();
      beep([[700, 0.04]]);
      render();
    } catch (err) {
      toast(chatError(err));
      if (/muted/.test(String(err.message))) { helloDone = ''; clsAt = 0; poll(); }
    } finally { sending = false; }
  }
  async function joinClass(e) {
    e.preventDefault();
    const code = cleanClassCode($('#chat-code').value);
    if (!CLASS_CODE_RE.test(code)) { toast('Mã lớp gồm 6 ký tự (chữ in hoa và số).'); return; }
    try {
      cls = await classApi.join(key(), pid(), code, nick());
      clsAt = Date.now();
      chat().classCode = cls.code;
      chat().lastProgress = 0;
      save();
      pushProgress(true);
      toast(`🏫 Đã vào lớp <b>${esc(cls.name)}</b>!`);
      beep([[523, 0.08], [784, 0.12]]);
      poll();
      render();
    } catch (err) { toast(chatError(err)); }
  }
  async function leaveClass() {
    if (!cls || !confirm(`Rời lớp "${cls.name}"? Em có thể vào lại bằng mã lớp.`)) return;
    try { await classApi.leave(key(), cls.code); } catch { /* vẫn rời ở máy */ }
    chat().classCode = null; cls = null; dmWith = null; save();
    render();
  }
  async function report(id) {
    if (!confirm('Báo cáo tin nhắn này cho thầy cô / quản trị? (3 bạn báo cáo thì tin tự ẩn)')) return;
    try { await chatApi.report(key(), Number(id), 'không phù hợp'); toast('Đã báo cáo. Cảm ơn em đã giúp giữ lớp học an toàn 💙'); } catch (err) { toast(chatError(err)); }
  }
  async function pushProgress(force = false) {
    const c = chat();
    if (!c.classCode || (!force && Date.now() - (c.lastProgress || 0) < 30000)) return;
    c.lastProgress = Date.now();
    try { await classApi.progress(key(), c.classCode, progressSummary(st(), levelFromXp)); } catch (err) { console.warn('Tiến độ lớp:', err); }
  }

  function updateCount() { $('#chat-count').textContent = `${input.value.length}/${MAX_LEN}`; }
  function open(which) {
    if (which) tab = which;
    panel.hidden = false;
    document.body.classList.add('chat-open');
    render();
    poll();
    schedule();
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }
  function close() {
    panel.hidden = true;
    document.body.classList.remove('chat-open');
    schedule();
  }

  // ---------------------------------------------------------------- sự kiện
  $('#chat-quick').innerHTML = QUICK.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  $('#chat-quick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('#chat-form').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('input', updateCount);
  input.addEventListener('keydown', (e) => e.stopPropagation()); // không kích hoạt phím tắt của trò chơi
  $('#chat-close').addEventListener('click', close);
  $('#chat-open').addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-chat-tab]');
    if (t) { tab = t.dataset.chatTab; if (tab !== 'dm') dmWith = null; if (tab === 'class' || tab === 'dm') refreshClass(true).then(() => render()); render(); poll(); return; }
    const mate = e.target.closest('[data-mate]');
    if (mate) { const m = cls.members.find((x) => x.pid === mate.dataset.mate); dmWith = { pid: m.pid, name: m.name }; render(); poll(); return; }
    const rep = e.target.closest('[data-report]');
    if (rep) report(rep.dataset.report);
  });
  updateCount();
  schedule();
  setTimeout(poll, 1500);

  return {
    open,
    close,
    afterAction() { pushProgress(); },
    zoneChanged() { if (!panel.hidden) render(); poll(); },
    nicknameChanged() { helloDone = ''; if (!panel.hidden) render(); poll(); schedule(); },
    get classCode() { return chat().classCode; },
    _debug: () => ({ tab, rooms, cursors, cls }),
  };
}

export { parseRoom };
