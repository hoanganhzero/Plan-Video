// Trang thầy cô: tạo lớp, xem tiến độ học sinh, quản lý trò chuyện của lớp (và chat trận do mình tạo).
// Thầy cô được nhận diện bằng "mã giáo viên" (một mã bí mật lưu ở máy này) – dùng chung mã chủ với Bộ đề / Thi đấu trong trò chơi.
import { teacherApi, chatError, timeLabel, agoLabel, toCSV, cleanClassCode, CLASS_CODE_RE, matchRoom, parseRoom } from './chat.js';
import { zoneById } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const STORE = 'cauca-giaovien-v1';
const GAME = 'cauca-hocgioi-v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- mã giáo viên
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
const store = loadStore();
function saveStore() { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch { /* bị chặn */ } }
if (!store.key) {
  // Dùng lại mã chủ của trò chơi (nếu thầy cô đã tạo bộ đề / trận đấu trên máy này) để quản lý được chat trận.
  let fromGame = null;
  try { fromGame = JSON.parse(localStorage.getItem(GAME))?.online?.ownerKey; } catch { /* không có */ }
  store.key = UUID_RE.test(fromGame || '') ? fromGame : crypto.randomUUID();
  saveStore();
}
const T = () => store.key;

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
async function act(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok); return r; } catch (err) { toast(`⚠️ ${esc(chatError(err))}`); throw err; }
}

// ---------------------------------------------------------------- trạng thái
let classes = [];
let current = store.current || null;
let dash = null;
let tab = 'students';
let room = null;
let roomMsgs = [];
let sortKey = 'name';
let sortDir = 1;
let refreshTimer = null;

async function loadClasses() {
  try { classes = await teacherApi.list(T()); } catch (err) { $('#class-list').innerHTML = `<div class="muted small">${esc(chatError(err))}</div>`; return; }
  if (current && !classes.some((c) => c.code === current)) current = null;
  if (!current && classes[0]) current = classes[0].code;
  renderClassList();
  if (current) await loadDash();
  else $('#main').innerHTML = '<div class="card empty">Chưa có lớp nào – hãy tạo lớp đầu tiên ở bên trái.</div>';
}
function renderClassList() {
  $('#class-list').innerHTML = classes.length ? classes.map((c) => `
    <button class="class-item ${c.code === current ? 'on' : ''}" data-class="${c.code}">
      <b>${esc(c.name)}</b>
      <small>Mã ${c.code} · ${c.members} học sinh${c.online ? ` · <span style="color:var(--good)">${c.online} đang chơi</span>` : ''}
        ${c.reports ? ` · <span class="pill red">⚑ ${c.reports}</span>` : ''}</small>
    </button>`).join('') : '<div class="muted small">Chưa có lớp nào.</div>';
}
async function loadDash() {
  try { dash = await teacherApi.dashboard(T(), current); } catch (err) { $('#main').innerHTML = `<div class="card empty">${esc(chatError(err))}</div>`; return; }
  store.current = current; saveStore();
  render();
}

// ---------------------------------------------------------------- hiển thị
function accuracy(p) {
  const total = (p.correct || 0) + (p.wrong || 0);
  return total ? Math.round((p.correct / total) * 100) : null;
}
function bar(pct) {
  if (pct == null) return '<span class="muted">–</span>';
  return `<span class="bar"><i class="${pct >= 75 ? '' : pct >= 50 ? 'mid' : 'low'}" style="width:${pct}%"></i></span>${pct}%`;
}
function render() {
  if (!dash) return;
  const ms = dash.members;
  const online = ms.filter((m) => m.online).length;
  const accs = ms.map((m) => accuracy(m.progress)).filter((a) => a != null);
  const avg = accs.length ? Math.round(accs.reduce((s, a) => s + a, 0) / accs.length) : null;
  const fish = ms.reduce((s, m) => s + (m.progress.fish || 0), 0);
  $('#main').innerHTML = `
    <div class="card code-card">
      <div><div class="muted small">Mã lớp</div><div class="big-code">${dash.code}</div></div>
      <div class="grow">
        <h2 style="margin:0">${esc(dash.name)}</h2>
        <div class="muted small">Học sinh mở trò chơi → <b>💬 Trò chuyện</b> → <b>🏫 Lớp</b> → nhập mã <b>${dash.code}</b>.</div>
        <div class="row" style="margin-top:8px">
          <button class="btn small" id="copy-code">📋 Sao chép mã</button>
          <button class="btn small" id="present-btn">📺 Chiếu mã lên bảng</button>
          <span class="pill ${dash.chat_on ? 'green' : 'red'}">${dash.chat_on ? '💬 Chat lớp: bật' : '💬 Chat lớp: tắt'}</span>
          <span class="pill ${dash.dm_on ? 'green' : 'red'}">${dash.dm_on ? '👤 Nhắn riêng: bật' : '👤 Nhắn riêng: tắt'}</span>
        </div>
      </div>
    </div>
    <nav class="tabs">
      ${[['students', '📊 Học sinh'], ['chat', '💬 Trò chuyện'], ['reports', `⚑ Báo cáo${dash.reports.length ? ` (${dash.reports.length})` : ''}`], ['settings', '⚙️ Cài đặt lớp']]
        .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
    </nav>
    <div id="tab-body"></div>`;
  const body = $('#tab-body');
  if (tab === 'students') body.innerHTML = renderStudents(ms, online, avg, fish);
  else if (tab === 'chat') { body.innerHTML = renderChat(); renderRoom(); }
  else if (tab === 'reports') body.innerHTML = renderReports();
  else body.innerHTML = renderSettings();
}

const COLS = [
  ['name', 'Học sinh'], ['act', 'Quản lý chat'], ['seen', 'Hoạt động'], ['level', 'Cấp'], ['xp', 'Kinh nghiệm'], ['fish', 'Cá câu'], ['species', 'Loài'],
  ['correct', 'Đúng'], ['wrong', 'Sai'], ['acc', 'Tỉ lệ đúng'], ['best_streak', 'Chuỗi đúng'], ['review', 'Cần ôn'], ['msgs', 'Tin nhắn'],
];
function sortVal(m, k) {
  const p = m.progress;
  if (k === 'name') return m.name.toLowerCase();
  if (k === 'seen') return new Date(m.last_seen).getTime();
  if (k === 'acc') return accuracy(p) ?? -1;
  if (k === 'msgs') return m.flagged * 1000 + m.messages;
  return p[k] || 0;
}
function renderStudents(ms, online, avg, fish) {
  const rows = [...ms].sort((a, b) => {
    const x = sortVal(a, sortKey); const y = sortVal(b, sortKey);
    return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
  });
  return `
    <div class="stats">
      <div class="stat"><b>${ms.length}</b><span>học sinh trong lớp</span></div>
      <div class="stat"><b style="color:var(--good)">${online}</b><span>đang chơi</span></div>
      <div class="stat"><b>${avg == null ? '–' : `${avg}%`}</b><span>tỉ lệ trả lời đúng trung bình</span></div>
      <div class="stat"><b>${fmt(fish)}</b><span>cá cả lớp đã câu</span></div>
    </div>
    <div class="row" style="margin-bottom:8px"><span class="muted small grow">Tiến độ tự cập nhật khi học sinh chơi (khoảng 30 giây một lần). Bấm tiêu đề cột để sắp xếp.</span>
      <button class="btn small" id="csv-btn">⬇️ Tải bảng điểm (Excel)</button><button class="btn small" id="reload-btn">🔄 Làm mới</button></div>
    ${ms.length ? `<div class="table-wrap"><table>
      <thead><tr>${COLS.map(([k, l]) => `<th data-sort="${k}" class="${sortKey === k ? 'sorted' : ''}">${l}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((m) => {
        const p = m.progress;
        return `<tr>
          <td><span class="dot ${m.online ? 'on' : ''}"></span><b>${esc(m.name)}</b>${m.muted_until ? ' <span class="pill red" title="Đang bị tạm khoá chat">🔇</span>' : ''}</td>
          <td><div class="row">
            ${m.muted_until
              ? `<button class="btn small" data-member="unmute" data-pid="${m.pid}">🔊 Mở chat</button>`
              : `<button class="btn small" data-member="mute" data-min="15" data-pid="${m.pid}" title="Tạm khoá chat 15 phút">🔇 15′</button>
                 <button class="btn small" data-member="mute" data-min="1440" data-pid="${m.pid}" title="Tạm khoá chat 1 ngày">🔇 1 ngày</button>`}
            <button class="btn small danger" data-member="kick" data-pid="${m.pid}" data-name="${esc(m.name)}" title="Mời ra khỏi lớp">🚪</button>
          </div></td>
          <td class="muted">${m.online ? '<span style="color:var(--good)">đang chơi</span>' : agoLabel(m.last_seen)}${p.zone ? ` · ${esc(zoneById(p.zone)?.name || p.zone)}` : ''}</td>
          <td>${p.level || 1}</td><td>${fmt(p.xp)}</td><td>${fmt(p.fish)}</td><td>${p.species || 0}</td>
          <td style="color:var(--good)">${p.correct || 0}</td><td style="color:var(--bad)">${p.wrong || 0}</td>
          <td>${bar(accuracy(p))}</td><td>${p.best_streak || 0}</td><td>${p.review || 0}</td>
          <td>${m.messages}${m.flagged ? ` <span class="pill orange" title="Tin bị bộ lọc che">${m.flagged} lọc</span>` : ''}</td>
</tr>`;
      }).join('')}</tbody></table></div>` : '<div class="card empty">Chưa có học sinh nào vào lớp. Hãy đọc mã lớp cho các em nhé!</div>'}`;
}

function roomLabel(r) {
  const p = parseRoom(r);
  if (p.kind === 'class') return '🏫 Chat cả lớp';
  if (p.kind === 'match') return `⚔️ Trận ${p.id}`;
  const d = dash.dms.find((x) => x.room === r);
  return `👤 ${esc(d?.a || '?')} ↔ ${esc(d?.b || '?')}`;
}
function renderChat() {
  room ||= `class:${dash.code}`;
  return `<div class="chat-grid">
    <div class="room-list">
      <button class="room ${room === `class:${dash.code}` ? 'on' : ''}" data-room="class:${dash.code}">🏫 Chat cả lớp</button>
      <div class="muted small" style="margin-top:6px">👤 Tin nhắn riêng trong lớp</div>
      ${dash.dms.length ? dash.dms.map((d) => `<button class="room ${room === d.room ? 'on' : ''}" data-room="${esc(d.room)}">
        ${esc(d.a || '?')} ↔ ${esc(d.b || '?')}<small>${d.count} tin · ${agoLabel(d.last_at)}${d.flagged ? ` · <span class="pill orange">${d.flagged} lọc</span>` : ''}</small></button>`).join('')
        : '<div class="muted small">Chưa có tin nhắn riêng.</div>'}
      <form id="match-form" class="row" style="margin-top:10px"><input id="match-code" maxlength="6" placeholder="Mã trận" style="width:110px;text-transform:uppercase"><button class="btn small">⚔️ Xem chat trận</button></form>
      <div class="muted small">Chỉ xem được trận do chính thầy cô tạo trên máy này.</div>
    </div>
    <div class="card"><div class="row"><h2 class="grow" style="margin:0" id="room-title"></h2><button class="btn small" id="room-reload">🔄</button></div>
      <div class="muted small" style="margin:4px 0 8px">Thầy cô thấy cả tin đã bị bộ lọc che (viền cam), tin bị báo cáo (viền đỏ) và tin đã ẩn (gạch ngang). Ẩn tin → học sinh không còn thấy.</div>
      <div class="msgs" id="room-msgs"><div class="empty">Đang tải…</div></div></div>
  </div>`;
}
function msgCard(m, { showRoom = false } = {}) {
  return `<div class="m ${m.flagged ? 'flagged' : ''} ${m.reports ? 'reported' : ''} ${m.hidden ? 'hidden' : ''}">
    <div class="head"><b>${esc(m.name)}</b><span>${timeLabel(m.at)}</span>${showRoom ? `<span>${roomLabel(m.room)}</span>` : ''}
      ${m.flagged ? '<span class="pill orange">bị lọc</span>' : ''}${m.reports ? `<span class="pill red">⚑ ${m.reports} báo cáo</span>` : ''}
      ${m.hidden ? `<span class="pill">đã ẩn${m.hidden_by ? ` (${esc(m.hidden_by)})` : ''}</span>` : ''}</div>
    <div class="body">${esc(m.body)}</div>
    <div class="acts">
      ${m.hidden ? `<button class="btn small" data-hide="0" data-id="${m.id}">👁 Hiện lại</button>` : `<button class="btn small danger" data-hide="1" data-id="${m.id}">🙈 Ẩn tin</button>`}
      ${m.reports ? `<button class="btn small" data-done="${m.id}">✔ Bỏ qua báo cáo</button>` : ''}
      ${m.pid && dash.members.some((x) => x.pid === m.pid) ? `<button class="btn small" data-member="mute" data-min="15" data-pid="${m.pid}">🔇 Khoá chat 15′</button>` : ''}
    </div></div>`;
}
async function renderRoom() {
  if (!$('#room-msgs')) return;
  $('#room-title').innerHTML = roomLabel(room);
  try { roomMsgs = await teacherApi.messages(T(), room); } catch (err) { $('#room-msgs').innerHTML = `<div class="empty">${esc(chatError(err))}</div>`; return; }
  const box = $('#room-msgs');
  box.innerHTML = roomMsgs.length ? roomMsgs.map((m) => msgCard(m)).join('') : '<div class="empty">Chưa có tin nhắn.</div>';
  box.scrollTop = box.scrollHeight;
}
function renderReports() {
  return dash.reports.length ? `<div class="muted small" style="margin-bottom:8px">Tin bị học sinh báo cáo. Ẩn tin nếu không phù hợp, hoặc bỏ qua nếu không có vấn đề.</div>
    <div class="msgs" style="max-height:none">${dash.reports.map((m) => msgCard(m, { showRoom: true })).join('')}</div>`
    : '<div class="card empty">✅ Không có báo cáo nào cần xử lý.</div>';
}
function renderSettings() {
  return `<div class="card">
      <h2>Cài đặt lớp</h2>
      <form id="rename-form" class="row"><input id="rename" class="grow" maxlength="60" value="${esc(dash.name)}"><button class="btn">💾 Đổi tên</button></form>
      <label class="switch"><input type="checkbox" id="chat-on" ${dash.chat_on ? 'checked' : ''}><div><b>💬 Chat cả lớp</b><div class="muted small">Học sinh nhắn tin trong phòng chung của lớp.</div></div></label>
      <label class="switch"><input type="checkbox" id="dm-on" ${dash.dm_on ? 'checked' : ''}><div><b>👤 Nhắn riêng giữa học sinh</b><div class="muted small">Chỉ giữa các bạn cùng lớp; thầy cô xem được ở mục 💬 Trò chuyện.</div></div></label>
      <p class="muted small">Mọi tin nhắn đều qua bộ lọc: che từ tục, số điện thoại, đường link, email. Học sinh dùng 3 lần từ tục trong 10 phút bị tự khoá chat 10 phút. 3 bạn báo cáo một tin thì tin tự ẩn. Tin nhắn tự xoá sau 30 ngày.</p>
    </div>
    <div class="card">
      <h2>🗑️ Xoá lớp</h2>
      <p class="muted small">Xoá lớp sẽ xoá danh sách học sinh, tiến độ và toàn bộ tin nhắn của lớp. Không thể hoàn tác.</p>
      <button class="btn danger" id="delete-class">Xoá lớp "${esc(dash.name)}"</button>
    </div>`;
}

// ---------------------------------------------------------------- sự kiện
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-class]');
  if (c) { current = c.dataset.class; room = null; tab = 'students'; renderClassList(); await loadDash(); return; }
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; render(); return; }
  const s = e.target.closest('[data-sort]');
  if (s) { const k = s.dataset.sort; if (k === 'act') return; sortDir = sortKey === k ? -sortDir : (k === 'name' ? 1 : -1); sortKey = k; render(); return; }
  const r = e.target.closest('[data-room]');
  if (r) { room = r.dataset.room; render(); return; }
  const mem = e.target.closest('[data-member]');
  if (mem) {
    const a = mem.dataset.member;
    if (a === 'kick' && !confirm(`Mời "${mem.dataset.name}" ra khỏi lớp? Em ấy có thể vào lại bằng mã lớp.`)) return;
    await act(() => teacherApi.member(T(), current, mem.dataset.pid, a, Number(mem.dataset.min || 0)),
      a === 'kick' ? 'Đã mời ra khỏi lớp.' : a === 'mute' ? '🔇 Đã tạm khoá chat.' : '🔊 Đã mở lại chat.').catch(() => {});
    await loadDash(); return;
  }
  const h = e.target.closest('[data-hide]');
  if (h) {
    await act(() => teacherApi.hide(T(), Number(h.dataset.id), h.dataset.hide === '1'), h.dataset.hide === '1' ? '🙈 Đã ẩn tin nhắn.' : 'Đã hiện lại tin nhắn.').catch(() => {});
    await loadDash(); return;
  }
  const d = e.target.closest('[data-done]');
  if (d) { await act(() => teacherApi.reportDone(T(), Number(d.dataset.done)), 'Đã bỏ qua báo cáo.').catch(() => {}); await loadDash(); return; }
  if (e.target.id === 'copy-code') { navigator.clipboard?.writeText(dash.code).then(() => toast('📋 Đã sao chép mã lớp.'), () => toast(dash.code)); return; }
  if (e.target.id === 'present-btn') {
    $('#present').innerHTML = `<div><p>🎣 Câu Cá Học Giỏi – <b>${esc(dash.name)}</b></p><p class="muted">Mở trò chơi → 💬 Trò chuyện → 🏫 Lớp → nhập mã:</p>
      <div class="big-code">${dash.code}</div><p class="muted small">(bấm để đóng)</p></div>`;
    $('#present').hidden = false; return;
  }
  if (e.target.closest('#present')) { $('#present').hidden = true; return; }
  if (e.target.id === 'reload-btn') { await loadClasses(); toast('Đã làm mới.'); return; }
  if (e.target.id === 'room-reload') { renderRoom(); return; }
  if (e.target.id === 'csv-btn') { downloadCSV(); return; }
  if (e.target.id === 'delete-class') {
    if (!confirm(`Xoá hẳn lớp "${dash.name}" cùng toàn bộ học sinh và tin nhắn?`)) return;
    await act(() => teacherApi.remove(T(), current), 'Đã xoá lớp.').catch(() => {});
    current = null; dash = null; await loadClasses(); return;
  }
  if (e.target.id === 'key-btn') { keyDialog(); }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'chat-on' || e.target.id === 'dm-on') {
    const on = e.target.checked;
    await act(() => teacherApi.update(T(), current, e.target.id === 'chat-on' ? { chatOn: on } : { dmOn: on }), on ? 'Đã bật.' : 'Đã tắt.').catch(() => {});
    await loadDash(); loadClasses();
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'create-form') {
    const name = $('#create-name').value.trim();
    if (!name) return;
    const code = await act(() => teacherApi.create(T(), name)).catch(() => null);
    if (!code) return;
    $('#create-name').value = '';
    current = code; tab = 'students';
    toast(`✅ Đã tạo lớp – mã lớp <b>${code}</b>`);
    await loadClasses();
  } else if (e.target.id === 'rename-form') {
    await act(() => teacherApi.update(T(), current, { name: $('#rename').value }), 'Đã đổi tên lớp.').catch(() => {});
    await loadDash(); loadClasses();
  } else if (e.target.id === 'match-form') {
    const code = cleanClassCode($('#match-code').value);
    if (!CLASS_CODE_RE.test(code)) { toast('Mã trận gồm 6 ký tự.'); return; }
    room = matchRoom(code); renderRoom();
  }
});

function downloadCSV() {
  const rows = [['Học sinh', 'Lần hoạt động cuối', 'Cấp', 'Kinh nghiệm', 'Cá câu được', 'Số loài', 'Trả lời đúng', 'Trả lời sai', 'Tỉ lệ đúng (%)', 'Chuỗi đúng dài nhất', 'Câu cần ôn', 'Cá huyền thoại+', 'Tin nhắn', 'Tin bị lọc']];
  for (const m of dash.members) {
    const p = m.progress;
    rows.push([m.name, new Date(m.last_seen).toLocaleString('vi-VN'), p.level || 1, p.xp || 0, p.fish || 0, p.species || 0, p.correct || 0, p.wrong || 0,
      accuracy(p) ?? '', p.best_streak || 0, p.review || 0, p.legendary || 0, m.messages, m.flagged]);
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }));
  a.download = `tien-do-${dash.code}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function keyDialog() {
  const v = prompt(`🔑 MÃ GIÁO VIÊN của thầy cô (giữ bí mật – ai có mã này sẽ quản lý được các lớp):\n\n${T()}\n\nĐể dùng các lớp này trên máy khác: mở trang thầy cô ở máy đó, bấm "Mã giáo viên" và dán mã vào ô dưới đây.\nDán mã giáo viên khác để chuyển sang (để trống = giữ nguyên):`, '');
  if (!v) return;
  const k = v.trim();
  if (!UUID_RE.test(k)) { toast('Mã giáo viên không đúng định dạng.'); return; }
  store.key = k; store.current = null; current = null; saveStore();
  toast('Đã đổi mã giáo viên.');
  loadClasses();
}

loadClasses();
refreshTimer = setInterval(() => { if (!document.hidden && current && (tab === 'students' || tab === 'reports')) { loadClasses(); } }, 20000);
