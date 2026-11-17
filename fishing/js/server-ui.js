// Bảng "🌐 Server": tài khoản chung (đăng nhập / tạo), thế giới đang chơi, các server của em,
// vào server mới theo cách thầy cô chọn (tự do / cần mã PIN server / chỉ tài khoản thầy cô tạo), bảng xếp hạng server.
import { chatError, cleanClassCode, CLASS_CODE_RE, agoLabel } from './chat.js';
import {
  serverApi, accountApi, knownServers, rememberServer, forgetServer, setActiveWorld, applyServerIdentity, slotKey,
  SERVER_ERRORS, getAccount, setAccount, logoutAccount, USERNAME_RE, cleanUsername, ACCESS_LABEL,
} from './servers.js';

export function initServerUI({ getState, saveNow, toast, esc, normalizeState, newGame, onLogin }) {
  const $ = (s) => document.querySelector(s);
  const body = $('#server-body');
  let found = null;       // server vừa tìm theo mã
  let top = null;
  let me = null;          // thông tin tài khoản từ máy chủ (danh sách server đã vào)
  let authTab = 'login';
  let showLegacy = false; // form "tên + PIN thầy cô phát"
  let busy = false;
  const st = () => getState();
  const err = (e) => {
    const m = String(e?.message || e);
    for (const [k, v] of Object.entries(SERVER_ERRORS)) if (m.includes(k)) return v;
    return chatError(e);
  };
  const fail = (r) => toast(`⚠️ ${esc(err(new Error(r.error)))}${/wrong/.test(r.error) && r.tries_left != null ? ` Còn ${r.tries_left} lần thử.` : ''}`);

  function switchTo(code) {
    saveNow();
    setActiveWorld(localStorage, code);
    sessionStorage.setItem('cauca-flash', code ? '🌐 Đã vào server!' : '🏠 Đã về thế giới của em.');
    location.reload();
  }
  // Ghi bản lưu server vừa nhận và chuyển vào server đó.
  function enterWith(r, code, fallbackName, account) {
    const entry = { code, name: r.server?.name || fallbackName, nick: r.name, key: r.key, pid: r.pid, account: account || null };
    saveNow();
    rememberServer(localStorage, entry);
    const world = applyServerIdentity(normalizeState(r.save || newGame()), entry);
    world.serverSavedAt = r.save_at || null;
    localStorage.setItem(slotKey(code), JSON.stringify(world));
    setActiveWorld(localStorage, code);
    sessionStorage.setItem('cauca-flash', r.created
      ? `🎉 Chào mừng <b>${esc(r.name)}</b> đến server <b>${esc(entry.name)}</b>!`
      : `👋 Chào mừng trở lại server <b>${esc(entry.name)}</b>!${r.save ? ' Đã tải tiến trình của em.' : ''}`);
    location.reload();
  }

  // ---------------------------------------------------------------- hiển thị
  function accountCard() {
    const acc = getAccount(localStorage);
    if (acc) {
      return `<div class="card account-card">
        <div class="row"><div class="grow"><div class="muted small">Tài khoản của em</div>
          <h3 style="margin:2px 0">👤 ${esc(acc.nickname)} <span class="muted small">@${esc(acc.username)}</span></h3></div>
          <button class="btn small" id="acc-pin">🔑 Đổi PIN</button><button class="btn small" id="acc-logout">🚪 Đăng xuất</button></div>
        <p class="muted small" style="margin:4px 0 0">Một tài khoản dùng cho <b>mọi server</b>. Tiến trình thế giới cá nhân và từng server đều lưu trên mạng –
          máy khác chỉ cần đăng nhập <b>@${esc(acc.username)}</b> + PIN. Dùng máy chung ở trường? Nhớ <b>Đăng xuất</b> khi chơi xong.</p>
      </div>`;
    }
    return `<div class="card account-card">
      <h3 style="margin-top:0">👤 Tài khoản học sinh</h3>
      <p class="muted small" style="margin:0 0 8px">Một tài khoản để vào <b>bất kỳ server nào</b> của thầy cô và chơi tiếp ở mọi máy.</p>
      <nav class="auth-tabs"><button data-auth="login" class="${authTab === 'login' ? 'on' : ''}">Đăng nhập</button><button data-auth="register" class="${authTab === 'register' ? 'on' : ''}">Tạo tài khoản</button></nav>
      ${authTab === 'login' ? `<form id="acc-login" class="enter-grid">
          <label>Tên đăng nhập<input id="acc-user" autocomplete="username" autocapitalize="none" placeholder="vd: an.5a" required></label>
          <label>PIN<input id="acc-pin-in" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required></label>
          <button class="btn gold">Đăng nhập</button></form>`
      : `<form id="acc-register" class="enter-grid four">
          <label>Tên đăng nhập<input id="reg-user" autocomplete="username" autocapitalize="none" maxlength="20" placeholder="vd: an.5a" required></label>
          <label>Tên hiển thị<input id="reg-nick" maxlength="16" value="${esc(st().online?.nickname || '')}" required></label>
          <label>PIN (4–6 số)<input id="reg-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></label>
          <label>Nhập lại PIN<input id="reg-pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></label>
          <button class="btn gold">Tạo tài khoản</button></form>
        <p class="muted small">Tên đăng nhập: chữ thường không dấu, số, dấu chấm, gạch dưới. <b>Nhớ kỹ tên đăng nhập và PIN.</b>
          Tiến trình thế giới cá nhân trên máy này sẽ được lưu vào tài khoản.</p>`}
    </div>`;
  }
  function serverList() {
    const cur = st().server;
    const acc = getAccount(localStorage);
    const local = knownServers(localStorage);
    const rows = new Map();
    for (const x of (acc ? me?.servers || [] : [])) rows.set(x.code, { code: x.code, name: x.name, nick: x.nick, at: x.last_seen, account: true });
    for (const x of local) rows.set(x.code, { ...(rows.get(x.code) || {}), code: x.code, name: x.name, nick: x.nick, at: x.at, local: true });
    const list = [...rows.values()];
    return `<div class="card" id="srv-list">
      <h3 style="margin-top:0">🌐 Server của em</h3>
      <div class="server-list">
        ${cur ? '<button class="server-item" data-go=""><b>🏠 Thế giới của em</b><small>Cá nhân</small></button>' : ''}
        ${list.map((x) => `<div class="server-item ${cur?.code === x.code ? 'on' : ''}">
          <div><b>🏫 ${esc(x.name)}</b><small>Mã ${x.code} · tên ${esc(x.nick || '')}${x.at ? ` · ${agoLabel(x.at)}` : ''}</small></div>
          ${cur?.code === x.code ? '<span class="pill">đang chơi</span>' : `<button class="btn small gold" data-enter="${x.code}" data-name="${esc(x.name)}">Vào</button>`}
          ${x.local && !x.account ? `<button class="btn small" data-forget="${x.code}" title="Quên server này trên máy (tiến trình vẫn còn trên mạng)">✕</button>` : ''}
        </div>`).join('') || `<p class="muted small">${acc ? 'Tài khoản chưa vào server nào – nhập mã server bên dưới.' : 'Chưa vào server nào trên máy này.'}</p>`}
      </div></div>`;
  }
  function joinCard() {
    const acc = getAccount(localStorage);
    let action = '';
    if (found) {
      const access = found.access || (found.allow_join ? 'open' : 'list');
      const legacy = `<form id="srv-enter" class="enter-grid">
          <label>Tên thầy cô phát<input id="srv-name" maxlength="16" required autocomplete="off"></label>
          <label>PIN của em<input id="srv-pin" inputmode="numeric" maxlength="6" required type="password" autocomplete="off"></label>
          <button class="btn sea">🚪 Vào bằng tên + PIN</button></form>`;
      if (access === 'list') {
        action = `<p class="small">📋 Server này <b>chỉ dành cho tài khoản thầy cô đã tạo</b>. Nhập đúng tên và PIN trên phiếu thầy cô phát:</p>${legacy}`;
      } else if (!acc) {
        action = `<p class="small">${access === 'open' ? '🚪 Server này cho <b>vào tự do</b>.' : '🔢 Server này <b>cần mã PIN của server</b> (hỏi thầy cô).'}
          Hãy <b>đăng nhập hoặc tạo tài khoản</b> ở trên để vào.</p>`;
      } else if (access === 'open') {
        action = `<p class="small">🚪 Server này cho <b>vào tự do</b> – em vào với tên <b>${esc(acc.nickname)}</b>.</p>
          <button class="btn gold" id="srv-join">🚪 Vào server</button>`;
      } else {
        action = `<p class="small">🔢 Server này <b>cần mã PIN của server</b> (thầy cô cho cả lớp). Chỉ cần nhập một lần.</p>
          <form id="srv-join-pin" class="row"><input id="srv-spin" inputmode="numeric" maxlength="6" type="password" placeholder="PIN server" required style="width:140px">
          <button class="btn gold">🚪 Vào server</button></form>`;
      }
      if (access !== 'list') {
        action += showLegacy ? `<p class="muted small">Tài khoản thầy cô phát riêng cho server này:</p>${legacy}`
          : '<p><button class="link small" id="srv-legacy">Em có tên + PIN thầy cô phát riêng cho server này?</button></p>';
      }
    }
    return `<div class="card">
      <h3 style="margin-top:0">➕ Vào server mới</h3>
      <form id="srv-find" class="row"><input id="srv-code" maxlength="6" placeholder="Mã server (6 ký tự)" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px;width:170px">
        <button class="btn sea">🔎 Tìm</button></form>
      ${found ? `<div class="server-found">
        <h3 style="margin:8px 0 2px">🏫 ${esc(found.name)} <span class="pill">${ACCESS_LABEL[found.access] || ''}</span></h3>
        ${found.description ? `<p class="muted small" style="margin:0">${esc(found.description)}</p>` : ''}
        <p class="muted small">${found.members} học sinh · ${found.online} đang chơi${found.set_code ? ' · có bộ đề của thầy cô' : ''}</p>
        ${action}</div>` : ''}
    </div>`;
  }
  function render() {
    const s = st();
    const cur = s.server;
    body.innerHTML = `${accountCard()}
      <div class="card world-now">
        <div class="muted small">Em đang chơi ở</div>
        <h3 style="margin:2px 0">${cur ? `🏫 ${esc(cur.name)} <span class="muted small">· mã ${cur.code}</span>` : '🏠 Thế giới của em (cá nhân)'}</h3>
        <p class="muted small" style="margin:0">${cur ? `Tên trong server: <b>${esc(s.online.nickname)}</b>. Tiến trình ở server này tự lưu lên mạng.`
          : 'Mỗi server của thầy cô có tiến trình riêng; thế giới cá nhân vẫn giữ nguyên khi em vào server.'}</p>
        ${cur ? '<div class="row" style="margin-top:8px"><button class="btn" data-go="">🏠 Về thế giới của em</button></div>' : ''}
      </div>
      ${cur ? `<div class="card"><h3 style="margin-top:0">🏆 Bảng xếp hạng server</h3><div id="server-top">${top ? renderTop() : '<span class="muted small">Đang tải…</span>'}</div></div>` : ''}
      ${serverList()}
      ${joinCard()}`;
    const code = found?.code;
    if (code && $('#srv-code')) $('#srv-code').value = code;
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
  async function loadMe() {
    const acc = getAccount(localStorage);
    if (!acc) { me = null; return; }
    try { me = await accountApi.me(acc.key); } catch (e) {
      if (/account not found/.test(String(e.message))) { logoutAccount(localStorage); toast('Tài khoản không còn tồn tại – đã đăng xuất.'); }
      me = null;
    }
    // Chỉ vẽ lại danh sách server (không làm mất chữ em đang gõ ở các ô khác).
    const box = $('#srv-list');
    if (box) box.outerHTML = serverList();
  }

  // ---------------------------------------------------------------- hành động
  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { toast(`⚠️ ${esc(err(e))}`); }
    busy = false;
  }
  const actions = {
    async find() {
      const code = cleanClassCode($('#srv-code').value);
      if (!CLASS_CODE_RE.test(code)) { toast('Mã server gồm 6 ký tự (chữ in hoa và số).'); return; }
      found = null; showLegacy = false;
      found = await serverApi.info(code);
      render();
      ($('#srv-spin') || $('#srv-name') || $('#srv-join'))?.focus();
    },
    async join(pin) {
      const acc = getAccount(localStorage);
      const r = await serverApi.join(acc.key, found.code, pin);
      if (r.error) { fail(r); return; }
      enterWith(r, found.code, found.name, acc.username);
    },
    async legacy() {
      const name = $('#srv-name').value.replace(/\s+/g, ' ').trim();
      const pin = $('#srv-pin').value.trim();
      if (name.length < 2 || !/^\d{4,6}$/.test(pin)) { toast('Nhập tên (ít nhất 2 ký tự) và PIN 4–6 số.'); return; }
      const r = await serverApi.enter(found.code, name, pin);
      if (r.error) { fail(r); return; }
      enterWith(r, found.code, found.name, null);
    },
    async enterKnown(code, name) {
      const local = knownServers(localStorage).find((x) => x.code === code);
      if (local) { switchTo(code); return; }
      const acc = getAccount(localStorage);
      if (!acc) return;
      const r = await serverApi.join(acc.key, code, null); // đã là thành viên → không cần PIN server
      if (r.error) { fail(r); return; }
      enterWith(r, code, name, acc.username);
    },
    async login() {
      const u = cleanUsername($('#acc-user').value);
      const pin = $('#acc-pin-in').value.trim();
      if (!USERNAME_RE.test(u) || !/^\d{4,6}$/.test(pin)) { toast('Nhập tên đăng nhập và PIN 4–6 số.'); return; }
      const r = await accountApi.login(u, pin);
      if (r.error) { fail(r); return; }
      setAccount(localStorage, r);
      onLogin(r, false);
    },
    async register() {
      const u = cleanUsername($('#reg-user').value);
      const nick = $('#reg-nick').value.replace(/\s+/g, ' ').trim();
      const pin = $('#reg-pin').value.trim();
      if (!USERNAME_RE.test(u)) { toast(esc(SERVER_ERRORS['bad username'])); return; }
      if (nick.length < 2) { toast('Tên hiển thị cần ít nhất 2 ký tự.'); return; }
      if (!/^\d{4,6}$/.test(pin)) { toast('PIN gồm 4–6 chữ số.'); return; }
      if (pin !== $('#reg-pin2').value.trim()) { toast('Hai lần nhập PIN chưa giống nhau.'); return; }
      const r = await accountApi.register(u, nick, pin);
      setAccount(localStorage, r);
      onLogin(r, true);
    },
    async changePin() {
      const acc = getAccount(localStorage);
      const oldPin = prompt('PIN hiện tại:');
      if (!oldPin) return;
      const newPin = prompt('PIN mới (4–6 số):');
      if (!newPin) return;
      if (!/^\d{4,6}$/.test(newPin)) { toast('PIN gồm 4–6 chữ số.'); return; }
      await accountApi.changePin(acc.key, oldPin.trim(), newPin.trim());
      toast('🔑 Đã đổi PIN.');
    },
    logout() {
      const acc = getAccount(localStorage);
      if (!confirm(`Đăng xuất @${acc.username}? Tiến trình đã lưu trên mạng; máy này sẽ xoá dữ liệu của tài khoản (thích hợp cho máy dùng chung).`)) return;
      saveNow();
      setTimeout(() => {
        logoutAccount(localStorage);
        sessionStorage.setItem('cauca-flash', '👋 Đã đăng xuất.');
        location.reload();
      }, 700); // chờ lưu xong lần cuối
    },
  };

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'srv-find') run(actions.find);
    else if (id === 'srv-join-pin') run(() => actions.join($('#srv-spin').value.trim()));
    else if (id === 'srv-enter') run(actions.legacy);
    else if (id === 'acc-login') run(actions.login);
    else if (id === 'acc-register') run(actions.register);
  });
  body.addEventListener('click', (e) => {
    const t = e.target;
    const g = t.closest('[data-go]');
    if (g) { switchTo(g.dataset.go || null); return; }
    const en = t.closest('[data-enter]');
    if (en) { run(() => actions.enterKnown(en.dataset.enter, en.dataset.name)); return; }
    const a = t.closest('[data-auth]');
    if (a) { authTab = a.dataset.auth; render(); return; }
    if (t.id === 'srv-join') { run(() => actions.join(null)); return; }
    if (t.id === 'srv-legacy') { showLegacy = true; render(); return; }
    if (t.id === 'acc-logout') { actions.logout(); return; }
    if (t.id === 'acc-pin') { run(actions.changePin); return; }
    const f = t.closest('[data-forget]');
    if (f) {
      const code = f.dataset.forget;
      if (!confirm(`Quên server ${code} trên máy này? Tiến trình vẫn lưu trên mạng.`)) return;
      const leaving = st().server?.code === code;
      forgetServer(localStorage, code);
      if (leaving) { sessionStorage.setItem('cauca-flash', '🏠 Đã về thế giới của em.'); location.reload(); } else render();
    }
  });

  return {
    open() {
      top = null; found = null; showLegacy = false;
      render();
      if (st().server) loadTop();
      loadMe();
    },
  };
}
