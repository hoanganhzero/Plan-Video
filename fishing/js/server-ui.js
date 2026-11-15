// Bảng "🌐 Server": xem thế giới đang chơi, chuyển server, vào server mới (mã + tên + PIN), bảng xếp hạng server.
import { chatError, cleanClassCode, CLASS_CODE_RE, agoLabel } from './chat.js';
import { serverApi, knownServers, rememberServer, forgetServer, setActiveWorld, applyServerIdentity, slotKey, SERVER_ERRORS } from './servers.js';

export function initServerUI({ getState, saveNow, toast, esc, normalizeState, newGame }) {
  const $ = (s) => document.querySelector(s);
  const body = $('#server-body');
  let found = null;   // thông tin server vừa tìm theo mã
  let top = null;
  let busy = false;
  const st = () => getState();
  const err = (e) => {
    const m = String(e?.message || e);
    for (const [k, v] of Object.entries(SERVER_ERRORS)) if (m.includes(k)) return v;
    return chatError(e);
  };

  function switchTo(code) {
    saveNow();
    setActiveWorld(localStorage, code);
    sessionStorage.setItem('cauca-flash', code ? '🌐 Đã vào server!' : '🏠 Đã về thế giới của em.');
    location.reload();
  }

  async function render() {
    const s = st();
    const list = knownServers(localStorage);
    const cur = s.server;
    body.innerHTML = `
      <div class="card world-now">
        <div class="muted small">Em đang chơi ở</div>
        <h3 style="margin:2px 0">${cur ? `🏫 ${esc(cur.name)} <span class="muted small">· mã ${cur.code}</span>` : '🏠 Thế giới của em (cá nhân)'}</h3>
        <p class="muted small" style="margin:0">${cur
          ? `Tên trong server: <b>${esc(s.online.nickname)}</b>. Tiến trình ở server này tự lưu lên mạng – đăng nhập lại bằng <b>mã server + tên + PIN</b> ở máy khác để chơi tiếp.`
          : 'Tiến trình cá nhân lưu trên máy này (hoặc bằng ☁️ mã lưu trong Cài đặt). Vào server của thầy cô để chơi cùng lớp – mỗi server có tiến trình riêng.'}</p>
        ${cur ? '<div class="row" style="margin-top:8px"><button class="btn" data-go="">🏠 Về thế giới của em</button></div>' : ''}
      </div>
      ${cur ? `<div class="card"><h3 style="margin-top:0">🏆 Bảng xếp hạng server</h3><div id="server-top">${top ? renderTop() : '<span class="muted small">Đang tải…</span>'}</div></div>` : ''}
      <div class="card">
        <h3 style="margin-top:0">🌐 Server của em</h3>
        <div class="server-list">
          ${cur ? '<button class="server-item" data-go=""><b>🏠 Thế giới của em</b><small>Cá nhân</small></button>' : ''}
          ${list.map((x) => `<div class="server-item ${cur?.code === x.code ? 'on' : ''}">
            <div><b>🏫 ${esc(x.name)}</b><small>Mã ${x.code} · tên ${esc(x.nick)} · ${agoLabel(x.at)}</small></div>
            ${cur?.code === x.code ? '<span class="pill">đang chơi</span>' : `<button class="btn small gold" data-go="${x.code}">Vào</button>`}
            <button class="btn small" data-forget="${x.code}" title="Quên server này trên máy (tiến trình vẫn còn trên mạng)">✕</button>
          </div>`).join('') || '<p class="muted small">Chưa vào server nào trên máy này.</p>'}
        </div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">➕ Vào server mới</h3>
        <form id="srv-find" class="row"><input id="srv-code" maxlength="6" placeholder="Mã server (6 ký tự)" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px;width:170px">
          <button class="btn sea" ${busy ? 'disabled' : ''}>🔎 Tìm</button></form>
        ${found ? `<div class="server-found">
          <h3 style="margin:8px 0 2px">🏫 ${esc(found.name)}</h3>
          ${found.description ? `<p class="muted small" style="margin:0">${esc(found.description)}</p>` : ''}
          <p class="muted small">${found.members} học sinh · ${found.online} đang chơi${found.set_code ? ' · có bộ đề của thầy cô' : ''}</p>
          <form id="srv-enter" class="enter-grid">
            <label>Tên của em<input id="srv-name" maxlength="16" required value="${esc(s.online?.nickname || '')}" autocomplete="off"></label>
            <label>Mã PIN (4–6 số)<input id="srv-pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required type="password" autocomplete="off"></label>
            <button class="btn gold" ${busy ? 'disabled' : ''}>🚪 Vào server</button>
          </form>
          <p class="muted small">• <b>Lần đầu</b>: ${found.allow_join ? 'chọn tên và tự đặt PIN – <b>nhớ kỹ PIN</b> để vào lại ở máy khác.' : 'server này chỉ cho tài khoản thầy cô đã tạo – nhập đúng tên và PIN thầy cô phát.'}<br>
          • <b>Đã có tài khoản</b> (thầy cô phát, hoặc đã chơi ở máy khác): nhập đúng tên + PIN để chơi tiếp.<br>
          • Quên PIN? Nhờ thầy cô bấm “Đặt lại PIN”.</p>
        </div>` : ''}
      </div>`;
    if (cur && !top) loadTop();
  }
  function renderTop() {
    if (!top.length) return '<span class="muted small">Chưa có ai.</span>';
    return `<ol class="server-top">${top.slice(0, 30).map((r) => `<li class="${r.me ? 'me' : ''}"><span class="dot ${r.online ? 'on' : ''}"></span><b>${esc(r.name)}</b>
      <span class="muted small">Cấp ${r.level} · ⭐ ${r.xp} · 🐟 ${r.fish} · ✅ ${r.correct}</span></li>`).join('')}</ol>`;
  }
  async function loadTop() {
    const s = st();
    try { top = await serverApi.top(s.online.key, s.server.code); } catch (e) { top = []; console.warn(e); }
    const el = $('#server-top');
    if (el) el.innerHTML = renderTop();
  }

  async function find(e) {
    e.preventDefault();
    const code = cleanClassCode($('#srv-code').value);
    if (!CLASS_CODE_RE.test(code)) { toast('Mã server gồm 6 ký tự (chữ in hoa và số).'); return; }
    busy = true;
    try { found = await serverApi.info(code); } catch (er) { found = null; toast(`⚠️ ${esc(err(er))}`); }
    busy = false;
    await render();
    $('#srv-code').value = code;
    if (found) $('#srv-pin')?.focus();
  }
  async function enter(e) {
    e.preventDefault();
    if (!found || busy) return;
    const name = $('#srv-name').value.replace(/\s+/g, ' ').trim();
    const pin = $('#srv-pin').value.trim();
    if (name.length < 2) { toast('Tên cần ít nhất 2 ký tự.'); return; }
    if (!/^\d{4,6}$/.test(pin)) { toast('PIN gồm 4–6 chữ số.'); return; }
    busy = true;
    try {
      const r = await serverApi.enter(found.code, name, pin);
      if (r.error) {
        toast(`⚠️ ${esc(err(new Error(r.error)))}${r.error === 'wrong pin' && r.tries_left != null ? ` Còn ${r.tries_left} lần thử.` : ''}`);
        busy = false;
        return;
      }
      const entry = { code: found.code, name: r.server?.name || found.name, nick: r.name, key: r.key, pid: r.pid };
      saveNow(); // lưu thế giới đang chơi TRƯỚC khi ghi bản lưu của server mới
      rememberServer(localStorage, entry);
      // Bản lưu của server (nếu đã chơi ở máy khác) hoặc thế giới mới tinh.
      const world = applyServerIdentity(normalizeState(r.save || newGame()), entry);
      world.serverSavedAt = r.save_at || null;
      localStorage.setItem(slotKey(found.code), JSON.stringify(world));
      setActiveWorld(localStorage, found.code);
      sessionStorage.setItem('cauca-flash', r.created
        ? `🎉 Chào mừng <b>${esc(r.name)}</b> đến server <b>${esc(entry.name)}</b>! Nhớ PIN để vào lại ở máy khác nhé.`
        : `👋 Chào mừng trở lại, <b>${esc(r.name)}</b>!${r.save ? ' Đã tải tiến trình của em.' : ''}`);
      location.reload();
    } catch (er) {
      toast(`⚠️ ${esc(err(er))}`);
      busy = false;
    }
  }

  body.addEventListener('submit', (e) => {
    if (e.target.id === 'srv-find') find(e);
    else if (e.target.id === 'srv-enter') enter(e);
  });
  body.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { switchTo(g.dataset.go || null); return; }
    const f = e.target.closest('[data-forget]');
    if (f) {
      const code = f.dataset.forget;
      if (!confirm(`Quên server ${code} trên máy này? Tiến trình vẫn lưu trên mạng – vào lại bằng mã server + tên + PIN.`)) return;
      const leaving = st().server?.code === code;
      forgetServer(localStorage, code);
      if (leaving) { sessionStorage.setItem('cauca-flash', '🏠 Đã về thế giới của em.'); location.reload(); } else render();
    }
  });

  return { open() { top = null; found = null; render(); } };
}
