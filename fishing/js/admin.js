// Trang quản trị: tổng quan, xử lý báo cáo, duyệt tin nhắn, khoá người vi phạm, quản lý lớp, dọn bảng xếp hạng, bật/tắt trò chuyện.
// Mã quản trị chỉ giữ trong sessionStorage; máy chủ so khớp bằng SHA-256.
import { adminApi, chatError, timeLabel, agoLabel, parseRoom } from './chat.js';
import { zoneById } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const SESSION = 'cauca-admin';

let code = null;
try { code = sessionStorage.getItem(SESSION); } catch { /* bị chặn */ }
let tab = 'overview';
let ov = null;
let msgFilter = 'flagged';
let search = '';

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
async function act(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok); return r; } catch (err) {
    toast(`⚠️ ${esc(chatError(err))}`);
    if (/not admin/.test(String(err.message))) logout();
    throw err;
  }
}

function roomLabel(r) {
  const p = parseRoom(r);
  if (p.kind === 'zone') return `🌊 Hồ ${esc(zoneById(p.id)?.name || p.id)}`;
  if (p.kind === 'class') return `🏫 Lớp ${esc(p.id)}`;
  if (p.kind === 'match') return `⚔️ Trận ${esc(p.id)}`;
  if (p.kind === 'dm') return `👤 Riêng (lớp ${esc(p.code)})`;
  return esc(r);
}

// ---------------------------------------------------------------- đăng nhập
async function login(c) {
  try {
    ov = await adminApi.overview(c);
    code = c;
    try { sessionStorage.setItem(SESSION, c); } catch { /* bị chặn */ }
    $('#logout').hidden = false;
    render();
  } catch (err) {
    $('#login-err') && ($('#login-err').textContent = chatError(err));
    code = null;
  }
}
function logout() {
  code = null; ov = null;
  try { sessionStorage.removeItem(SESSION); } catch { /* */ }
  location.reload();
}

// ---------------------------------------------------------------- hiển thị
const TABS = [['overview', '📈 Tổng quan'], ['reports', '⚑ Báo cáo'], ['messages', '💬 Tin nhắn'], ['users', '👥 Người chơi'], ['classes', '🏫 Lớp học'], ['scores', '🏆 Xếp hạng']];
function shell(inner) {
  $('#main').innerHTML = `<nav class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'reports' && ov?.open_reports ? ` <span class="pill red">${ov.open_reports}</span>` : ''}</button>`).join('')}</nav><div id="body">${inner}</div>`;
}
async function render() {
  if (!code) return;
  if (tab === 'overview') return renderOverview();
  if (tab === 'reports' || tab === 'messages') return renderMessages();
  if (tab === 'users') return renderUsers();
  if (tab === 'classes') return renderClasses();
  if (tab === 'scores') return renderScores();
}
async function renderOverview() {
  ov = await act(() => adminApi.overview(code)).catch(() => ov);
  const s = ov.settings || {};
  const on = (k) => s[k] !== false;
  shell(`
    <div class="stats">
      <div class="stat"><b>${fmt(ov.players)}</b><span>người chơi trên bảng xếp hạng</span></div>
      <div class="stat"><b style="color:var(--good)">${fmt(ov.online)}</b><span>đang trò chuyện (2 phút qua)</span></div>
      <div class="stat"><b>${fmt(ov.classes)}</b><span>lớp học · ${fmt(ov.students)} học sinh</span></div>
      <div class="stat"><b>${fmt(ov.matches)}</b><span>trận thi đấu</span></div>
      <div class="stat"><b>${fmt(ov.sets)}</b><span>bộ đề chia sẻ</span></div>
      <div class="stat"><b>${fmt(ov.messages_24h)}</b><span>tin nhắn 24 giờ qua</span></div>
      <div class="stat"><b style="color:var(--warn)">${fmt(ov.flagged_24h)}</b><span>tin bị lọc 24 giờ qua</span></div>
      <div class="stat"><b style="color:var(--bad)">${fmt(ov.open_reports)}</b><span>báo cáo chờ xử lý</span></div>
      <div class="stat"><b>${fmt(ov.banned)}</b><span>người đang bị khoá chat</span></div>
    </div>
    <div class="card">
      <h2>🎛️ Công tắc trò chuyện toàn hệ thống</h2>
      <label class="switch"><input type="checkbox" data-setting="chat_all" ${on('chat_all') ? 'checked' : ''}><div><b>💬 Toàn bộ trò chuyện</b><div class="muted small">Tắt = không ai gửi được tin nhắn (khẩn cấp).</div></div></label>
      <label class="switch"><input type="checkbox" data-setting="chat_public" ${on('chat_public') ? 'checked' : ''}><div><b>🌊 Chat ở hồ (công khai)</b><div class="muted small">Chat với mọi người cùng khu câu, kể cả người lạ.</div></div></label>
      <label class="switch"><input type="checkbox" data-setting="chat_dm" ${on('chat_dm') ? 'checked' : ''}><div><b>👤 Nhắn riêng</b><div class="muted small">Nhắn riêng giữa bạn cùng lớp (thầy cô từng lớp cũng bật/tắt được).</div></div></label>
      <p class="muted small">Cập nhật lúc ${timeLabel(ov.server_now)}.</p>
    </div>`);
}
function msgCard(m) {
  return `<div class="m ${m.flagged ? 'flagged' : ''} ${m.reports ? 'reported' : ''} ${m.hidden ? 'hidden' : ''}">
    <div class="head"><b>${esc(m.name)}</b><span class="pill" title="Mã công khai">${esc(m.pid)}</span><span>${roomLabel(m.room)}</span><span>${timeLabel(m.at)}</span>
      ${m.flagged ? '<span class="pill orange">bị lọc</span>' : ''}${m.reports ? `<span class="pill red">⚑ ${m.reports} báo cáo</span>` : ''}
      ${m.hidden ? `<span class="pill">đã ẩn${m.hidden_by ? ` (${esc(m.hidden_by)})` : ''}</span>` : ''}</div>
    <div class="body">${esc(m.body)}</div>
    <div class="acts">
      ${m.hidden ? `<button class="btn small" data-hide="0" data-id="${m.id}">👁 Hiện lại</button>` : `<button class="btn small danger" data-hide="1" data-id="${m.id}">🙈 Ẩn tin</button>`}
      ${m.reports ? `<button class="btn small" data-done="${m.id}">✔ Bỏ qua báo cáo</button>` : ''}
      <button class="btn small" data-ban="24" data-pid="${esc(m.pid)}" data-name="${esc(m.name)}">🔇 Khoá 1 ngày</button>
      <button class="btn small" data-find="${esc(m.pid)}">🔎 Xem người này</button>
    </div></div>`;
}
async function renderMessages() {
  const filter = tab === 'reports' ? 'reported' : msgFilter;
  shell(`<div class="row" style="margin-bottom:10px">
      ${tab === 'messages' ? `<select id="msg-filter">${[['flagged', 'Tin bị lọc'], ['all', 'Tất cả'], ['hidden', 'Đã ẩn'], ['reported', 'Bị báo cáo']].map(([k, l]) => `<option value="${k}" ${msgFilter === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <form id="search-form" class="row grow"><input id="search" class="grow" value="${esc(search)}" placeholder="Tìm theo nội dung, biệt danh, mã người chơi, mã lớp…"><button class="btn small">🔎 Tìm</button></form>` : '<span class="muted small grow">Tin nhắn bị học sinh báo cáo (mới nhất trước).</span>'}
      <button class="btn small" id="reload">🔄 Làm mới</button></div>
    <div class="msgs" id="msgs" style="max-height:none"><div class="empty">Đang tải…</div></div>`);
  const list = await act(() => adminApi.messages(code, filter, tab === 'messages' ? search : '')).catch(() => []);
  $('#msgs').innerHTML = list.length ? list.map(msgCard).join('') : `<div class="empty">${tab === 'reports' ? '✅ Không có báo cáo nào cần xử lý.' : 'Không có tin nhắn phù hợp.'}</div>`;
}
async function renderUsers() {
  shell(`<form id="search-form" class="row" style="margin-bottom:10px"><input id="search" class="grow" value="${esc(search)}" placeholder="Tìm theo biệt danh hoặc mã công khai"><button class="btn small">🔎 Tìm</button></form>
    <div class="table-wrap" id="users"><div class="empty">Đang tải…</div></div>`);
  const list = await act(() => adminApi.users(code, search)).catch(() => []);
  $('#users').innerHTML = list.length ? `<table><thead><tr><th>Biệt danh</th><th>Mã</th><th>Lớp</th><th>Hoạt động</th><th>Tin</th><th>Bị lọc</th><th>Bị báo cáo</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${list.map((u) => `<tr>
      <td><b>${esc(u.name)}</b></td><td class="muted">${esc(u.pid)}</td><td>${esc(u.classes || '–')}</td><td class="muted">${agoLabel(u.last_seen)}</td>
      <td>${u.messages}</td><td>${u.flagged ? `<span class="pill orange">${u.flagged}</span>` : 0}</td><td>${u.reported ? `<span class="pill red">${u.reported}</span>` : 0}</td>
      <td>${u.banned_until ? `<span class="pill red" title="${esc(u.ban_reason || '')}">🔇 đến ${timeLabel(u.banned_until)}</span>` : '<span class="pill green">bình thường</span>'}</td>
      <td><div class="row">${u.banned_until ? `<button class="btn small" data-ban="0" data-pid="${esc(u.pid)}" data-name="${esc(u.name)}">🔊 Bỏ khoá</button>` : `
        <button class="btn small" data-ban="1" data-pid="${esc(u.pid)}" data-name="${esc(u.name)}">1 giờ</button>
        <button class="btn small" data-ban="24" data-pid="${esc(u.pid)}" data-name="${esc(u.name)}">1 ngày</button>
        <button class="btn small danger" data-ban="168" data-pid="${esc(u.pid)}" data-name="${esc(u.name)}">7 ngày</button>`}
        <button class="btn small danger" data-purge="${esc(u.pid)}" data-name="${esc(u.name)}" title="Khoá 30 ngày và ẩn mọi tin">⛔ Khoá + ẩn tin</button>
        <button class="btn small" data-find="${esc(u.pid)}">💬</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Không có người chơi nào.</div>';
}
async function renderClasses() {
  shell('<div class="table-wrap" id="classes"><div class="empty">Đang tải…</div></div>');
  const list = await act(() => adminApi.classes(code)).catch(() => []);
  $('#classes').innerHTML = list.length ? `<table><thead><tr><th>Mã</th><th>Tên lớp</th><th>Học sinh</th><th>Tin nhắn</th><th>Chat lớp</th><th>Nhắn riêng</th><th>Tạo lúc</th><th></th></tr></thead><tbody>
    ${list.map((c) => `<tr><td><b>${c.code}</b></td><td>${esc(c.name)}</td><td>${c.members}</td><td>${c.messages}</td>
      <td>${c.chat_on ? '✅' : '⛔'}</td><td>${c.dm_on ? '✅' : '⛔'}</td><td class="muted">${timeLabel(c.created_at)}</td>
      <td><div class="row"><button class="btn small" data-find="${c.code}">💬 Xem tin</button><button class="btn small danger" data-delclass="${c.code}" data-name="${esc(c.name)}">🗑️ Xoá</button></div></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Chưa có lớp nào.</div>';
}
async function renderScores() {
  shell(`<form id="search-form" class="row" style="margin-bottom:10px"><input id="search" class="grow" value="${esc(search)}" placeholder="Tìm biệt danh trên bảng xếp hạng"><button class="btn small">🔎 Tìm</button></form>
    <p class="muted small">Biệt danh có từ không phù hợp được đánh dấu <span class="pill red">nghi vấn</span>. Xoá khỏi bảng xếp hạng = người chơi phải đặt lại biệt danh khi nộp điểm lần sau.</p>
    <div class="table-wrap" id="scores"><div class="empty">Đang tải…</div></div>`);
  const list = await act(() => adminApi.scores(code, search)).catch(() => []);
  $('#scores').innerHTML = list.length ? `<table><thead><tr><th>#</th><th>Biệt danh</th><th>Kinh nghiệm</th><th>Cấp</th><th>Loài</th><th>Đúng</th><th>Cập nhật</th><th></th></tr></thead><tbody>
    ${list.map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.name)}</b> ${s.suspicious ? '<span class="pill red">nghi vấn</span>' : ''}</td><td>${fmt(s.xp)}</td><td>${s.level}</td><td>${s.species}</td><td>${s.correct}</td>
      <td class="muted">${agoLabel(s.updated_at)}</td><td><button class="btn small danger" data-delscore="${s.handle}" data-name="${esc(s.name)}">🗑️ Xoá</button></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Không có ai.</div>';
}

// ---------------------------------------------------------------- sự kiện
document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'login') login($('#admin-code').value.trim());
  if (e.target.id === 'search-form') { search = $('#search').value.trim(); render(); }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'msg-filter') { msgFilter = e.target.value; render(); }
  const s = e.target.dataset?.setting;
  if (s) {
    const on = e.target.checked;
    if (!on && s === 'chat_all' && !confirm('Tắt TOÀN BỘ trò chuyện cho mọi người chơi?')) { e.target.checked = true; return; }
    await act(() => adminApi.setting(code, s, on), on ? 'Đã bật.' : 'Đã tắt.').catch(() => { e.target.checked = !on; });
  }
});
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; search = ''; render(); return; }
  if (e.target.id === 'logout') { logout(); return; }
  if (e.target.id === 'reload') { render(); return; }
  const h = e.target.closest('[data-hide]');
  if (h) { await act(() => adminApi.hide(code, Number(h.dataset.id), h.dataset.hide === '1'), h.dataset.hide === '1' ? '🙈 Đã ẩn.' : 'Đã hiện lại.').catch(() => {}); render(); return; }
  const d = e.target.closest('[data-done]');
  if (d) { await act(() => adminApi.reportDone(code, Number(d.dataset.done)), 'Đã bỏ qua báo cáo.').catch(() => {}); render(); return; }
  const b = e.target.closest('[data-ban]');
  if (b) {
    const hours = Number(b.dataset.ban);
    if (hours && !confirm(`Khoá chat "${b.dataset.name}" trong ${hours >= 24 ? `${hours / 24} ngày` : `${hours} giờ`}?`)) return;
    const reason = hours ? (prompt('Lý do (học sinh sẽ thấy):', 'Vi phạm quy định trò chuyện') ?? '') : '';
    await act(() => adminApi.ban(code, b.dataset.pid, hours, reason, false), hours ? '🔇 Đã khoá chat.' : '🔊 Đã bỏ khoá.').catch(() => {});
    render(); return;
  }
  const p = e.target.closest('[data-purge]');
  if (p) {
    if (!confirm(`Khoá chat "${p.dataset.name}" 30 ngày và ẩn TẤT CẢ tin nhắn của người này?`)) return;
    await act(() => adminApi.ban(code, p.dataset.purge, 24 * 30, 'Vi phạm nghiêm trọng quy định trò chuyện', true), '⛔ Đã khoá và ẩn tin.').catch(() => {});
    render(); return;
  }
  const f = e.target.closest('[data-find]');
  if (f) { tab = 'messages'; msgFilter = 'all'; search = f.dataset.find; render(); return; }
  const dc = e.target.closest('[data-delclass]');
  if (dc) {
    if (!confirm(`Xoá lớp "${dc.dataset.name}" (${dc.dataset.delclass}) cùng học sinh và tin nhắn?`)) return;
    await act(() => adminApi.removeClass(code, dc.dataset.delclass), 'Đã xoá lớp.').catch(() => {}); render(); return;
  }
  const ds = e.target.closest('[data-delscore]');
  if (ds) {
    if (!confirm(`Xoá "${ds.dataset.name}" khỏi bảng xếp hạng?`)) return;
    await act(() => adminApi.removeScore(code, ds.dataset.delscore), 'Đã xoá khỏi bảng xếp hạng.').catch(() => {}); render();
  }
});

if (code) login(code);
