// Giao diện thi đấu: 1vs1, Đội vs Đội (≤8 người/đội), Lớp học (2–6 đội).
// Trực tiếp (phòng chờ → Bắt đầu → đếm ngược) hoặc không cần cùng lúc (hạn chót).
// Câu hỏi trong trận do MÁY CHỦ chấm; trình duyệt chỉ nhận đáp án đúng sau khi đã trả lời.
import { matchApi, friendlyError, cleanCode, cleanNickname, validNickname } from './online.js';
import {
  MODES, TEAM_COLORS, TEAM_ICONS, teamStandings, mvp, matchClock, clockSkew, formatDuration, nextMatchIndex,
  summarizeReport, reportToCSV,
} from './match.js';
import { pickQuestion } from './questions.js';
import { GRADES } from './data.js';

export function initMatchUI({ getState, save, toast, esc, banner, beep, isIdle, onChange }) {
  const $ = (s) => document.querySelector(s);
  const body = $('#match-body');
  const hud = $('#match-hud');
  let tab = 'join';
  let view = null; // 'lobby' | 'board' | 'report' | null
  let found = null; // trận tìm theo mã (tab Tham gia)
  let active = null; // { code, info, board, skew, owner, player }
  let report = null;
  let pollTimer = null;
  let tickTimer = null;
  let busy = false;
  let lastPhase = null;

  const state = () => getState();
  const matches = () => (state().matches ||= {});
  const remember = (code, patch) => { matches()[code] = { ...(matches()[code] || {}), ...patch, at: Date.now() }; save(); };
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
  const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;

  async function call(fn, okMsg) {
    busy = true;
    try {
      const r = await fn();
      if (okMsg) toast(okMsg);
      return r;
    } catch (err) {
      toast(`⚠️ ${esc(friendlyError(err))}`);
      return null;
    } finally { busy = false; }
  }

  // ------------------------------------------------------------- trận đang chơi
  function setActive(info, { owner = false, player = false } = {}) {
    active = { code: info.code, info, board: null, skew: clockSkew(info.server_now), owner: owner || !!info.is_owner, player: player || !!info.me };
    remember(info.code, { title: info.title, mode: info.mode, owner: active.owner, player: active.player });
    startPolling();
  }

  function startPolling() {
    clearInterval(pollTimer);
    clearInterval(tickTimer);
    if (!active) return;
    const live = active.info.live;
    refresh();
    pollTimer = setInterval(refresh, live ? 2500 : 10000);
    tickTimer = setInterval(tick, 500);
  }

  function stopPolling() { clearInterval(pollTimer); clearInterval(tickTimer); }

  async function refresh() {
    if (!active) return;
    try {
      const board = await matchApi.board(active.code);
      active.board = board;
      active.skew = clockSkew(board.server_now);
      // Trận vừa chuyển từ phòng chờ sang chạy: tải câu hỏi.
      if (board.status !== 'lobby' && !active.info.questions) {
        active.info = await matchApi.info(state(), active.code);
      }
      active.info.status = board.status;
      active.info.starts_at = board.starts_at;
      active.info.ends_at = board.ends_at;
      renderHud();
      // Chỉ vẽ lại bảng khi dữ liệu đổi – tránh mất cú bấm và nhảy cuộn trang.
      const sig = JSON.stringify([board.status, board.players, board.ends_at]);
      if (sig !== active.sig) {
        active.sig = sig;
        if ($('#sheet-match').open && tab === 'play' && view !== 'report') render();
      }
    } catch { /* mất mạng tạm thời: thử lại lần sau */ }
  }

  function tick() {
    if (!active) return;
    const c = matchClock(active.info, active.skew);
    if (c.phase !== lastPhase) {
      // Rời phòng chờ (có thể bỏ qua bước đếm ngược nếu bảng điểm cập nhật chậm): đóng bảng để người chơi đi câu.
      const leftLobby = lastPhase === 'lobby' && (c.phase === 'countdown' || c.phase === 'running');
      if (leftLobby && $('#sheet-match').open && active.player) $('#sheet-match').close();
      if (c.phase === 'countdown') beep?.([[660, 0.1]]);
      if (c.phase === 'running' && (lastPhase === 'countdown' || lastPhase === 'lobby')) { banner('BẮT ĐẦU! 🎣', 'gold', 1500); beep?.([[523, 0.1], [784, 0.2]]); }
      if (c.phase === 'done' && lastPhase && lastPhase !== 'done') { finishView(); }
      lastPhase = c.phase;
    }
    if (c.phase === 'countdown') banner(`${c.left}`, 'gold', 900);
    renderHud();
  }

  function finishView() {
    beep?.([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]]);
    refresh().then(() => {
      if (!isIdle()) { toast('🏁 Trận đấu đã kết thúc – mở ⚔️ Thi đấu để xem kết quả.'); return; }
      view = 'board';
      tab = 'play';
      render();
      if (!$('#sheet-match').open) $('#sheet-match').showModal();
    });
  }

  // Câu tiếp theo của trận cho người chơi (null nếu không đang trong trận / đã làm hết).
  function nextQuestion() {
    if (!active?.player || !active.info.questions) return null;
    const c = matchClock(active.info, active.skew);
    if (c.phase !== 'running') return null;
    const answered = active.info.me?.answered || [];
    const i = nextMatchIndex(active.info.q_count, answered);
    if (i === null) return null;
    const mq = active.info.questions[i];
    const code = active.code;
    const q = {
      id: `match-${code}-${i}`, subject: 'match', difficulty: mq.d || 1, text: mq.q, choices: [...mq.options], answer: -1, explain: '',
      matchLabel: `⚔️ Trận ${code} · câu ${i + 1}/${active.info.q_count}`,
      async grade(choice, ms) {
        const picked = choice === null ? '' : q.choices[choice];
        try {
          const r = await matchApi.answer(state(), code, i, picked, ms);
          q.answer = q.choices.indexOf(r.answer);
          q.explain = r.explain || '';
          active.info.me = { ...(active.info.me || {}), answered: [...answered, i], score: r.score };
          if (r.points) toast(`⚔️ +${r.points} điểm trận`);
          renderHud();
          refresh();
          if (r.finished) setTimeout(() => toast('🏁 Bạn đã trả lời hết câu của trận! Chờ các bạn khác hoặc xem bảng điểm.'), 1500);
          return r;
        } catch (err) {
          // Hết giờ / mất mạng: câu này không tính điểm trận.
          q.answer = choice ?? 0;
          active.info.me = { ...(active.info.me || {}), answered: [...answered, i] };
          toast(`⚠️ ${esc(friendlyError(err))} – câu này không tính điểm trận.`);
          return { correct: true, voided: true };
        }
      },
    };
    return q;
  }

  async function onFish(tier) {
    if (!active?.player || matchClock(active.info, active.skew).phase !== 'running') return;
    try { await matchApi.fish(state(), active.code, tier); refresh(); } catch { /* bỏ qua */ }
  }

  // ------------------------------------------------------------- HUD nổi
  function renderHud() {
    if (!active) { hud.hidden = true; return; }
    const c = matchClock(active.info, active.skew);
    const b = active.board;
    const teams = b ? teamStandings(b) : [];
    const myTeam = active.info.me?.team;
    const answered = active.info.me?.answered?.length || 0;
    const qc = active.info.q_count;
    const phaseText = { lobby: '⏳ Phòng chờ', countdown: `🚦 ${c.left}`, running: `⏱ ${formatDuration(c.left)}`, done: '🏁 Kết thúc' }[c.phase];
    const max = Math.max(1, ...teams.map((t) => t.avg));
    hud.hidden = false;
    hud.classList.toggle('urgent', c.phase === 'running' && c.left !== null && c.left <= 30 && active.info.live);
    hud.innerHTML = `
      <div class="mh-top"><b>⚔️ ${esc(active.code)}</b><span>${phaseText}</span></div>
      ${active.player ? `<div class="mh-me">Câu ${Math.min(answered + (c.phase === 'running' && answered < qc ? 1 : 0), qc)}/${qc} · ⭐ ${fmt(active.info.me?.score)}</div>` : '<div class="mh-me">👀 Chủ trận</div>'}
      <div class="mh-teams">${teams.map((t) => `
        <div class="mh-team ${t.index === myTeam ? 'mine' : ''}" title="${esc(t.name)}: TB ${t.avg} · tổng ${t.total}">
          <span>${t.icon} ${esc(t.name)}</span><i style="width:${(t.avg / max) * 100}%;background:${t.color}"></i><b>${fmt(t.avg)}</b>
        </div>`).join('')}</div>`;
  }
  hud.addEventListener('click', () => { if (!isIdle()) return; tab = 'play'; view = 'board'; render(); $('#sheet-match').showModal(); });

  // ------------------------------------------------------------- render sheet
  function render() {
    document.querySelectorAll('#match-tabs [data-mtab]').forEach((b) => b.classList.toggle('active', b.dataset.mtab === tab));
    document.querySelector('#match-tabs [data-mtab="play"]').hidden = !active;
    if (tab === 'join') body.innerHTML = renderJoin();
    else if (tab === 'create') body.innerHTML = renderCreate();
    else if (tab === 'mine') body.innerHTML = renderMine();
    else body.innerHTML = view === 'report' ? renderReport() : renderPlay();
  }

  function teamPicker(info, chosen) {
    const counts = info.team_counts || [];
    return `<div class="team-pick">${info.team_names.map((n, i) => {
      const full = (counts[i] || 0) >= info.team_size && info.me?.team !== i;
      return `<button class="team-opt ${chosen === i ? 'sel' : ''}" data-act="pick-team" data-i="${i}" ${full ? 'disabled' : ''}
        style="--tc:${TEAM_COLORS[i % 6]}"><span class="ti">${TEAM_ICONS[i % 6]}</span><b>${esc(n)}</b><small>${counts[i] || 0}/${info.team_size}${full ? ' · đủ người' : ''}</small></button>`;
    }).join('')}</div>`;
  }

  function renderJoin() {
    const nick = state().online?.nickname || '';
    const f = found;
    let detail = '';
    if (f) {
      const mode = MODES[f.mode];
      const c = matchClock(f, clockSkew(f.server_now));
      detail = `<div class="card fetched">
        <div class="title">${mode.icon} ${esc(f.title)}</div>
        <div class="muted small">${mode.name} · ${f.q_count} câu · ${f.live ? `trực tiếp ${formatDuration(f.duration_sec)} phút` : `hạn chót còn ${formatDuration(c.left)}`} ·
          ${{ lobby: 'đang ở phòng chờ', running: 'đang diễn ra', done: 'đã kết thúc' }[f.status]}</div>
        ${f.status === 'done' ? `<div class="row"><button class="btn sea" data-act="view-result">🏆 Xem kết quả</button></div>` : `
        <h3>Chọn ${f.mode === 'duel' ? 'vị trí' : 'đội'}</h3>${teamPicker(f, f._team ?? f.me?.team ?? null)}
        <label class="fld">Biệt danh<input id="m-nick" maxlength="40" value="${esc(f.me?.nickname || nick)}" placeholder="VD: Mèo Câu Cá 4C"></label>
        <div class="row"><button class="btn gold big" data-act="do-join" ${busy ? 'disabled' : ''}>⚔️ Vào trận</button></div>`}
      </div>`;
    }
    return `<div class="card join-card">
        <h3>🔑 Nhập mã trận</h3>
        <p class="muted small">Bạn bè hoặc thầy cô tạo trận và gửi mã 6 ký tự. Mọi người trả lời cùng bộ câu hỏi – đúng nhiều, nhanh và câu được cá quý thì thắng.</p>
        <div class="row"><input id="m-code" class="nick-input code-input" maxlength="8" placeholder="K7M2QX" value="${esc(f?.code || '')}" autocomplete="off">
          <button class="btn gold" data-act="find" ${busy ? 'disabled' : ''}>Tìm trận</button></div>
      </div>${detail}`;
  }

  function renderCreate() {
    const st = state();
    const sets = (st.sets || []).filter((s) => s.questions.length >= 3);
    const d = createDraft;
    const nTeams = d.mode === 'class' ? d.teams.length : 2;
    return `
      <div class="mode-pick">${Object.entries(MODES).map(([k, m]) => `
        <button class="mode-opt ${d.mode === k ? 'sel' : ''}" data-act="mode" data-m="${k}"><span>${m.icon}</span><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div>
      <div class="card">
        <label class="fld">Tên trận<input data-d="title" value="${esc(d.title)}" placeholder="VD: Ôn tập Khoa học tuần 12"></label>
        ${d.mode === 'duel' ? '' : `
          <h3>Các đội</h3>
          <div class="team-names">${Array.from({ length: nTeams }, (_, i) => `
            <label class="fld" style="--tc:${TEAM_COLORS[i]}">${TEAM_ICONS[i]} Đội ${i + 1}<input data-team="${i}" value="${esc(d.teams[i] || '')}" placeholder="${['Cá Mập', 'Cá Heo', 'Rùa Biển', 'Bạch Tuộc', 'Cua Đỏ', 'Cá Voi'][i]}"></label>`).join('')}</div>
          ${d.mode === 'class' ? `<div class="row"><button class="btn small" data-act="team-add" ${nTeams >= 6 ? 'disabled' : ''}>➕ Thêm đội</button><button class="btn small" data-act="team-del" ${nTeams <= 2 ? 'disabled' : ''}>➖ Bớt đội</button></div>` : ''}
          <label class="fld">Số người tối đa mỗi đội<select data-d="teamSize">${[2, 3, 4, 5, 6, 7, 8].map((n) => opt(n, `${n} người`, d.teamSize)).join('')}</select></label>`}
        <h3>Câu hỏi</h3>
        <div class="fld-row">
          <label class="fld grow">Nguồn câu hỏi<select data-d="source">
            ${opt('game', '🎲 Câu hỏi có sẵn của trò chơi (theo môn đang bật)', d.source)}
            ${sets.map((s) => opt(s.id, `📝 Bộ đề: ${esc(s.name)} (${s.questions.length} câu)`, d.source)).join('')}
          </select></label>
          <label class="fld">Số câu<select data-d="count">${[5, 10, 15, 20, 30].map((n) => opt(n, n, d.count)).join('')}</select></label>
        </div>
        <h3>Cách chơi</h3>
        <div class="fld-row">
          <label class="fld">Kiểu<select data-d="live">${opt('1', '⚡ Trực tiếp – cùng lúc', d.live)}${opt('0', '📅 Không cần cùng lúc – có hạn chót', d.live)}</select></label>
          ${d.live === '1'
            ? `<label class="fld">Thời gian trận<select data-d="minutes">${[2, 3, 5, 10, 15, 20].map((n) => opt(n, `${n} phút`, d.minutes)).join('')}</select></label>`
            : `<label class="fld">Hạn chót<select data-d="deadline">${[[60, '1 giờ'], [360, '6 giờ'], [1440, '1 ngày'], [4320, '3 ngày'], [10080, '7 ngày']].map(([v, l]) => opt(v, l, d.deadline)).join('')}</select></label>`}
          <label class="check"><input type="checkbox" data-d="selfPlay" ${d.selfPlay ? 'checked' : ''}> Tôi cũng tham gia chơi</label>
        </div>
        <p class="muted small">Điểm mỗi câu đúng: 100 + 25 × (độ khó − 1) + tối đa 50 điểm trả lời nhanh. Câu được cá trong trận thưởng thêm 0–50 điểm (tối đa 300).
          Đội xếp hạng theo <b>điểm trung bình mỗi thành viên</b> nên đội ít người không bị thiệt.</p>
        <div class="row"><button class="btn gold big" data-act="create" ${busy ? 'disabled' : ''}>🚀 Tạo trận</button></div>
      </div>`;
  }

  function renderMine() {
    const list = Object.entries(matches()).sort((a, b) => b[1].at - a[1].at).slice(0, 30);
    return list.length ? `<div class="set-list">${list.map(([code, m]) => `
      <div class="set-card"><span class="ti">${MODES[m.mode]?.icon || '⚔️'}</span>
        <div class="set-main"><div class="title">${esc(m.title || code)}</div>
          <div class="muted small"><span class="code-pill">${esc(code)}</span> · ${m.owner ? 'Chủ trận' : ''}${m.owner && m.player ? ' + ' : ''}${m.player ? 'Người chơi' : ''} · ${new Date(m.at).toLocaleString('vi-VN')}</div></div>
        <div class="set-acts"><button class="btn small sea" data-act="open" data-code="${esc(code)}">Mở</button></div>
      </div>`).join('')}</div>` : '<p class="muted">Bạn chưa tạo hay tham gia trận nào.</p>';
  }

  function renderPlay() {
    if (!active) return '<p class="muted">Chưa vào trận nào.</p>';
    const info = active.info;
    const b = active.board || { players: [], team_names: info.team_names };
    const c = matchClock(info, active.skew);
    const teams = teamStandings(b);
    const best = mvp(b);
    const mode = MODES[info.mode];
    const done = c.phase === 'done';
    const head = `<div class="match-head">
      <div><div class="title">${mode.icon} ${esc(info.title)}</div><div class="muted small">${mode.name} · ${info.q_count} câu · ${info.live ? 'trực tiếp' : 'không cần cùng lúc'}</div></div>
      <div class="big-code" title="Mã trận">${esc(active.code)}</div>
    </div>`;
    if (c.phase === 'lobby') {
      return `${head}
        <p class="muted">Gửi mã <b>${esc(active.code)}</b> cho các bạn. ${active.owner ? 'Khi mọi người đã vào, bấm <b>Bắt đầu</b>.' : 'Chờ chủ trận bắt đầu…'}</p>
        <div class="lobby">${b.team_names.map((n, i) => `
          <div class="lobby-team" style="--tc:${TEAM_COLORS[i % 6]}"><div class="lt-head">${TEAM_ICONS[i % 6]} ${esc(n)} <small>${b.players.filter((p) => p.team === i).length}/${info.team_size}</small></div>
            ${b.players.filter((p) => p.team === i).map((p) => `<div class="lt-p">🙂 ${esc(p.nickname)}${p.nickname === info.me?.nickname ? ' (bạn)' : ''}</div>`).join('') || '<div class="muted small">Chưa có ai</div>'}</div>`).join('')}</div>
        <div class="row">${active.owner ? `<button class="btn gold big" data-act="start" ${b.players.length ? '' : 'disabled'}>▶️ Bắt đầu (${b.players.length} người)</button>` : ''}
          <button class="btn" data-act="copy">📋 Chép mã</button>${active.owner ? '<button class="btn danger" data-act="end">Huỷ trận</button>' : ''}</div>`;
    }
    const podium = teams.slice(0, 3);
    return `${head}
      <div class="row"><span class="phase-pill ${c.phase}">${{ countdown: `🚦 Bắt đầu sau ${c.left}s`, running: `⏱ Còn ${formatDuration(c.left)}`, done: '🏁 Đã kết thúc' }[c.phase]}</span>
        <span class="spacer"></span>
        ${active.owner && !done ? '<button class="btn small danger" data-act="end">⏹ Kết thúc sớm</button>' : ''}
        ${active.owner ? '<button class="btn small sea" data-act="report">📊 Báo cáo chi tiết</button>' : ''}
        <button class="btn small" data-act="copy">📋 Chép mã</button></div>
      ${done && teams.length ? `<div class="podium">${[1, 0, 2].map((k) => podium[k]).filter(Boolean).map((t) => `
        <div class="pod p${t.rank}" style="--tc:${t.color}"><div class="pod-ico">${t.rank === 1 ? '🏆' : t.rank === 2 ? '🥈' : '🥉'}</div>
          <b>${t.icon} ${esc(t.name)}</b><span>TB ${fmt(t.avg)}</span><div class="pod-bar"></div></div>`).join('')}</div>
        ${best ? `<div class="mvp">🌟 Xuất sắc nhất: <b>${esc(best.nickname)}</b> · ${fmt(best.score)} điểm · ${best.correct}/${best.answered} câu đúng</div>` : ''}` : ''}
      <div class="team-board">${teams.map((t) => `
        <div class="tb" style="--tc:${t.color}">
          <div class="tb-head"><span class="rank">#${t.rank}</span>${t.icon} <b>${esc(t.name)}</b><span class="spacer"></span>
            <span title="Điểm trung bình mỗi thành viên">TB <b>${fmt(t.avg)}</b></span><span class="muted small">tổng ${fmt(t.total)} · ${t.accuracy}% đúng</span></div>
          ${t.members.map((p) => `<div class="tb-p ${p.nickname === info.me?.nickname ? 'me' : ''}"><span>${esc(p.nickname)}${p.finished ? ' ✅' : ''}</span>
            <span class="muted small">${p.correct}/${p.answered} đúng</span><b>${fmt(p.score)}</b></div>`).join('') || '<div class="muted small">Chưa có ai</div>'}
        </div>`).join('')}</div>
      ${active.player && !done ? `<p class="muted small">Đóng bảng này rồi câu cá như bình thường – mỗi câu hỏi khi kéo cá sẽ là câu của trận. Còn ${info.q_count - (info.me?.answered?.length || 0)} câu.</p>` : ''}`;
  }

  function renderReport() {
    if (!report) return '<p>⏳ Đang tải báo cáo…</p>';
    const s = report;
    return `<div class="row"><button class="btn small" data-act="back-board">← Bảng điểm</button><span class="spacer"></span>
        <button class="btn small sea" data-act="report-csv">⬇️ Tải báo cáo (CSV / Excel)</button></div>
      <h3>📉 Câu khó nhất với học sinh</h3>
      <div class="rep-q">${s.perQ.map((q) => `<div class="rq"><span class="rq-n">${q.i + 1}</span><div class="rq-main"><b>${esc(q.q)}</b><div class="small ans-ok">✅ ${esc(q.a)}</div></div>
        <div class="rq-bar"><i style="width:${q.rate ?? 0}%;background:${q.rate === null ? '#64748b' : q.rate < 50 ? '#ef4444' : q.rate < 80 ? '#f59e0b' : '#22c55e'}"></i></div>
        <b>${q.rate === null ? '–' : `${q.rate}%`}</b><span class="muted small">${q.ok}/${q.total}</span></div>`).join('')}</div>
      <h3>👩‍🎓 Từng học sinh</h3>
      <table class="rep-t"><thead><tr><th>Học sinh</th><th>Đội</th><th>Điểm</th><th>Đúng</th><th>Câu sai</th><th>Giây/câu</th></tr></thead><tbody>
        ${s.students.map((p) => `<tr><td>${esc(p.nickname)}</td><td>${esc(p.team)}</td><td>${fmt(p.score)}</td><td>${p.correct}/${p.answered}</td><td>${p.wrong.join(', ') || '–'}</td><td>${p.avgSec ?? '–'}</td></tr>`).join('')}
      </tbody></table>`;
  }

  // ------------------------------------------------------------- tạo trận
  const createDraft = { mode: 'duel', title: '', teams: ['', ''], teamSize: 8, source: 'game', count: 10, live: '1', minutes: 5, deadline: 1440, selfPlay: true };

  function buildQuestions() {
    const st = state();
    const d = createDraft;
    if (d.source !== 'game') {
      const set = (st.sets || []).find((s) => s.id === d.source);
      const qs = [...(set?.questions || [])].sort(() => Math.random() - 0.5).slice(0, d.count);
      return qs.map(({ q, a, w, e, d: diff }) => ({ q, a, w, e, d: diff }));
    }
    const grade = GRADES.find((g) => g.id === st.settings.grade) || GRADES[0];
    const subjects = st.settings.subjects.filter((s) => s !== 'custom');
    const out = [];
    const seen = new Set();
    for (let tries = 0; out.length < d.count && tries < d.count * 10; tries++) {
      const diff = 1 + (out.length % 3);
      const q = pickQuestion(diff, { subjects: subjects.length ? subjects : ['math'], mathOffset: grade.mathOffset, recent: [...seen] });
      if (seen.has(q.text)) continue;
      seen.add(q.text);
      seen.add(q.id);
      const a = q.choices[q.answer];
      out.push({ q: q.text, a, w: q.choices.filter((c) => c !== a), e: q.explain || '', d: q.difficulty || diff });
    }
    return out;
  }

  async function createMatch() {
    const d = createDraft;
    const questions = buildQuestions();
    if (questions.length < 3) { toast('Cần ít nhất 3 câu hỏi.'); return; }
    const teams = d.mode === 'class' ? d.teams : d.mode === 'teams' ? d.teams.slice(0, 2) : [];
    const code = await call(() => matchApi.create(state(), {
      mode: d.mode, title: d.title || `${MODES[d.mode].name} ${new Date().toLocaleDateString('vi-VN')}`, teams,
      teamSize: d.teamSize, questions, live: d.live === '1', minutes: d.live === '1' ? Number(d.minutes) : Number(d.deadline),
    }));
    if (!code) { render(); return; }
    remember(code, { owner: true, mode: d.mode, title: d.title });
    const info = await call(() => matchApi.info(state(), code));
    if (!info) return;
    setActive(info, { owner: true });
    try { await navigator.clipboard?.writeText(code); } catch { /* bỏ qua */ }
    toast(`🚀 Đã tạo trận – mã <b style="font-size:1.4em;letter-spacing:2px">${esc(code)}</b> (đã chép). Gửi mã cho các bạn nhé!`);
    if (d.selfPlay) {
      found = { ...info, _team: 0 };
      tab = 'join';
    } else {
      tab = 'play';
      view = active.info.live ? 'lobby' : 'board';
    }
    render();
  }

  // ------------------------------------------------------------- sự kiện
  document.querySelector('#match-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mtab]');
    if (!b) return;
    tab = b.dataset.mtab;
    if (tab === 'play') view = 'board';
    render();
  });

  body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const act = t.dataset.act;
    if (act === 'find') {
      const code = cleanCode(body.querySelector('#m-code').value);
      if (code.length !== 6) { toast('Mã trận gồm 6 ký tự.'); return; }
      const info = await call(() => matchApi.info(state(), code));
      found = info;
      render();
    } else if (act === 'pick-team') { found._team = Number(t.dataset.i); render(); }
    else if (act === 'do-join') {
      const nick = cleanNickname(body.querySelector('#m-nick').value);
      const err = validNickname(nick);
      if (err) { toast(err); return; }
      const team = found._team ?? found.me?.team;
      if (team === undefined || team === null) { toast('Hãy chọn đội trước.'); return; }
      const info = await call(() => matchApi.join(state(), found.code, nick, team));
      if (!info) return;
      if (!state().online.nickname) state().online.nickname = nick;
      const wasOwner = matches()[info.code]?.owner;
      setActive(info, { owner: wasOwner, player: true });
      remember(info.code, { player: true, nickname: nick, team });
      onChange?.();
      found = null;
      tab = 'play';
      view = info.status === 'lobby' ? 'lobby' : 'board';
      if (info.status === 'running') {
        $('#sheet-match').close();
        banner(`⚔️ VÀO TRẬN!<small>Câu cá để trả lời ${info.q_count} câu của trận</small>`, 'gold', 2200);
      } else render();
    } else if (act === 'view-result') {
      setActive(found, {});
      found = null; tab = 'play'; view = 'board'; render();
    } else if (act === 'mode') {
      createDraft.mode = t.dataset.m;
      createDraft.selfPlay = createDraft.mode !== 'class';
      if (createDraft.mode === 'class' && createDraft.teams.length < 2) createDraft.teams = ['', ''];
      render();
    } else if (act === 'team-add') { createDraft.teams.push(''); render(); }
    else if (act === 'team-del') { createDraft.teams.pop(); render(); }
    else if (act === 'create') { busy = true; render(); busy = false; await createMatch(); }
    else if (act === 'open') {
      const code = t.dataset.code;
      const info = await call(() => matchApi.info(state(), code));
      if (!info) return;
      setActive(info, { owner: matches()[code]?.owner, player: !!info.me });
      tab = 'play';
      view = info.status === 'lobby' ? 'lobby' : 'board';
      render();
    } else if (act === 'start') {
      const info = await call(() => matchApi.start(state(), active.code), '🚦 Trận bắt đầu sau 5 giây!');
      if (info) { active.info = { ...active.info, ...info, me: active.info.me }; active.skew = clockSkew(info.server_now); refresh(); }
    } else if (act === 'end') {
      if (!confirm('Kết thúc trận ngay bây giờ?')) return;
      await call(() => matchApi.end(state(), active.code), '🏁 Đã kết thúc trận.');
      refresh();
    } else if (act === 'copy') {
      try { await navigator.clipboard.writeText(active.code); toast(`📋 Đã chép mã ${esc(active.code)}`); } catch { toast(`Mã trận: <b>${esc(active.code)}</b>`); }
    } else if (act === 'report') {
      view = 'report'; report = null; render();
      const r = await call(() => matchApi.report(state(), active.code));
      if (r) { report = summarizeReport(r, active.info.team_names); render(); }
    } else if (act === 'back-board') { view = 'board'; render(); }
    else if (act === 'report-csv' && report) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([reportToCSV(report)], { type: 'text/csv;charset=utf-8' }));
      a.download = `bao-cao-tran-${active.code}.csv`;
      a.click();
    }
  });

  body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.d) {
      createDraft[t.dataset.d] = t.type === 'checkbox' ? t.checked : t.value;
      if (['live', 'source'].includes(t.dataset.d)) render();
    } else if (t.dataset.team !== undefined) createDraft.teams[Number(t.dataset.team)] = t.value;
  });
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.d === 'title') createDraft.title = t.value;
    if (t.dataset.team !== undefined) createDraft.teams[Number(t.dataset.team)] = t.value;
  });
  $('#sheet-match').addEventListener('close', () => { if (view === 'report') view = 'board'; });

  // Mở lại trận đang dở khi tải trang (trận chưa kết thúc gần nhất).
  async function resume() {
    const recent = Object.entries(matches()).sort((a, b) => b[1].at - a[1].at)[0];
    if (!recent || Date.now() - recent[1].at > 7 * 86400000) return;
    try {
      const info = await matchApi.info(state(), recent[0]);
      if (info.status !== 'done' && (info.me || recent[1].owner)) setActive(info, { owner: recent[1].owner, player: !!info.me });
    } catch { /* không có mạng */ }
  }

  return {
    render,
    open(which) { if (which) tab = which; else if (active) { tab = 'play'; view = matchClock(active.info, active.skew).phase === 'lobby' ? 'lobby' : 'board'; } render(); },
    nextQuestion,
    onFish,
    resume,
    leave() { active = null; stopPolling(); renderHud(); },
    get code() { return active && matchClock(active.info, active.skew).phase !== 'done' ? active.code : null; },
  };
}
