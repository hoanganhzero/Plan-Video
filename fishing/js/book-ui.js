// Giao diện "📖 Sách giáo khoa" (trang thầy cô): đưa cả cuốn SGK vào → tự chia bài →
// chọn dạng câu hỏi → tạo câu hỏi + nội dung trọng tâm cho từng bài → bật "bài đang học" → chia sẻ / giao cho lớp.
// Khi học sinh trả lời sai, trò chơi hiện "📖 Xem lại" với tên bài và đoạn nội dung liên quan.
import { newSet, reviewToQuestion, addToSet, newId } from './content.js';
import { extractText, fileKind } from './extract.js';
import { generateLessonAI, findLessonsAI, uploadBookFile, loadKey, saveKey, loadFallback, fallbackFieldsHtml, bindFallbackFields } from './ai.js';
import { publishSet } from './online.js';
import {
  QTYPES, HEADING_KINDS, splitLessons, singleLesson, keyPoints, offlineQuestions, tagWithLesson,
  activeQuestions, lessonStats, MAX_BOOK_QUESTIONS,
} from './textbook.js';
import { GRADE_LIST, subjectsForGrade, subjectInfo } from './curriculum.js';

const FILE_TTL = 46 * 3600 * 1000; // tệp trên Gemini giữ 48 giờ

export function initBookUI({ root, getState, save, toast, esc, openEditor }) {
  let view = 'list';
  let bookId = null; // bộ đề sách đang mở
  let showLesson = null; // bài đang xem câu hỏi
  let busy = '';
  let stop = false;
  let progress = null; // { done, total, log: [] }
  const texts = new Map(); // lessonId → nội dung bài (chỉ giữ trong phiên làm việc)
  let draft = null;
  const opts = { types: ['mcq', 'tf', 'cloze'], count: 10, difficulty: 'mix', method: loadKey() || loadFallback() ? 'ai' : 'auto' };

  const sets = () => (getState().sets ||= []);
  const books = () => sets().filter((s) => s.book);
  const findSet = (id) => sets().find((s) => s.id === id);
  const opt = (v, label, cur) => `<option value="${esc(String(v))}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  const subjName = (id) => subjectInfo(id)?.name || id || '';
  const commit = () => save();
  const $r = (s) => root.querySelector(s);

  function newDraft() {
    return { name: '', grade: 5, subject: 'math', fileName: '', file: null, pages: [], text: '', kind: '', lessons: [], note: '', scanned: false, fileRef: null };
  }

  // ------------------------------------------------------------------ render
  function render() {
    if (view === 'new') root.innerHTML = renderNew();
    else if (view === 'book') root.innerHTML = renderBook();
    else root.innerHTML = renderList();
  }

  function renderList() {
    const list = books();
    return `<div class="card book-intro">
        <h3>📖 Sách giáo khoa → câu hỏi theo từng bài</h3>
        <p class="muted small">Tải cả cuốn SGK (PDF / Word). Hệ thống tự chia thành từng bài, rút <b>nội dung trọng tâm</b>, rồi tạo câu hỏi theo các dạng thầy cô chọn
          (trắc nghiệm, đúng/sai, điền khuyết, chọn ý không đúng, vận dụng). Bật <b>bài đang học</b> rồi chia sẻ / giao cho lớp.
          Khi học sinh trả lời sai, trò chơi hiện <b>📖 Xem lại</b> kèm đoạn nội dung liên quan trong bài.</p>
        <button class="btn gold" data-b="new">➕ Thêm sách</button>
      </div>
      ${list.length ? `<div class="set-list">${list.map((s) => {
        const on = s.book.lessons.filter((l) => l.on !== false).length;
        return `<div class="set-card">
          <div class="set-main"><div class="title">📖 ${esc(s.name)}</div>
            <div class="muted small">${s.book.lessons.length} bài · ${s.questions.length} câu · đang bật ${on} bài (${activeQuestions(s).length} câu)
              ${s.code ? ` · <span class="code-pill">🔑 ${esc(s.code)}</span>` : ''}</div></div>
          <div class="set-acts"><button class="btn small gold" data-b="open" data-id="${s.id}">📚 Quản lý bài</button>
            <button class="btn small danger" data-b="del-book" data-id="${s.id}">🗑️</button></div>
        </div>`;
      }).join('')}</div>` : ''}`;
  }

  function optionsPanel() {
    const key = loadKey();
    return `<div class="book-opts">
      <div class="fld"><span>Dạng câu hỏi</span><div class="qtype-grid">${Object.entries(QTYPES).map(([id, t]) => `
        <label class="qtype ${opts.types.includes(id) ? 'on' : ''} ${t.ai && opts.method !== 'ai' ? 'dis' : ''}">
          <input type="checkbox" data-o="type" value="${id}" ${opts.types.includes(id) ? 'checked' : ''} ${t.ai && opts.method !== 'ai' ? 'disabled' : ''}>
          ${t.icon} ${t.name}${t.ai ? ' <small>(AI)</small>' : ''}</label>`).join('')}</div></div>
      <div class="fld-row">
        <label class="fld">Số câu mỗi bài<select data-o="count">${[5, 8, 10, 15, 20].map((n) => opt(n, n, opts.count)).join('')}</select></label>
        <label class="fld">Độ khó<select data-o="difficulty">${opt('mix', 'Trộn các mức', opts.difficulty)}${opt(1, 'Nhận biết', opts.difficulty)}${opt(2, 'Thông hiểu', opts.difficulty)}${opt(3, 'Vận dụng', opts.difficulty)}</select></label>
        <label class="fld">Cách tạo<select data-o="method">${opt('ai', '✨ AI (Gemini) – hay nhất', opts.method)}${opt('auto', '⚙️ Tự động, không cần mạng', opts.method)}</select></label>
      </div>
      ${opts.method === 'ai' ? `<label class="fld">Gemini API key <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">lấy miễn phí</a>
        <input id="bk-key" type="password" value="${esc(key)}" placeholder="Dán key – chỉ lưu trong trình duyệt này" autocomplete="off"></label>
        ${fallbackFieldsHtml(esc)}
        <p class="muted small">AI đọc từng bài, viết ý trọng tâm và câu hỏi đúng dạng đã chọn. Gemini miễn phí giới hạn số lượt mỗi phút – hệ thống tự chờ rồi làm tiếp, hoặc chuyển sang AI dự phòng nếu đã cài.</p>`
        : '<p class="muted small">Chế độ tự động tạo câu Đúng/Sai, điền khuyết và "phát biểu nào đúng / không đúng" từ các câu định nghĩa, số liệu, tên riêng trong bài. Nên xem lại câu hỏi.</p>'}
    </div>`;
  }

  function progressBox() {
    if (!progress) return '';
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return `<div class="card book-progress">
      <div class="row"><b>${busy ? '⏳' : '✅'} ${progress.done}/${progress.total} bài</b><span class="spacer"></span>
        ${busy ? '<button class="btn small danger" data-b="stop">⏹ Dừng</button>' : ''}</div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="small plog">${progress.log.slice(-6).map((l) => `<div>${l}</div>`).join('')}</div>
    </div>`;
  }

  function renderNew() {
    const d = draft;
    const grades = GRADE_LIST.map((g) => opt(g, `Lớp ${g}`, d.grade)).join('');
    const subs = subjectsForGrade(d.grade).map((s) => opt(s, subjName(s), d.subject)).join('');
    const chosen = d.lessons.filter((l) => l.pick !== false);
    return `<div class="row"><button class="btn small" data-b="back">← Danh sách sách</button></div>
      <div class="card">
        <h3>1️⃣ Chọn sách</h3>
        <div class="fld-row">
          <label class="fld grow">Tên<input data-d="name" value="${esc(d.name)}" placeholder="VD: Toán 5 – Kết nối tri thức, tập 1"></label>
          <label class="fld">Khối<select data-d="grade">${grades}</select></label>
          <label class="fld">Môn<select data-d="subject">${subs}</select></label>
        </div>
        <label class="drop" id="bk-drop">
          <input type="file" data-b="file" accept=".pdf,.docx,.txt,.md" hidden>
          <span class="drop-ico">📚</span>
          <span><b>Chọn hoặc kéo thả cả cuốn sách</b> PDF, Word (.docx) hoặc .txt</span>
          ${d.fileName ? `<span class="small">Đã chọn: <b>${esc(d.fileName)}</b>${d.pages.length ? ` · ${d.pages.length} trang` : ''}</span>` : ''}
        </label>
        <details ${d.fileName ? '' : 'open'}><summary class="small">…hoặc dán nội dung (một hoặc nhiều bài, mỗi bài bắt đầu bằng "Bài 1…", "Bài 2…")</summary>
          <textarea id="bk-paste" rows="5" placeholder="Bài 1. …&#10;Nội dung bài 1…&#10;Bài 2. …">${esc(d.fileName ? '' : d.text)}</textarea>
          <button class="btn small sea" data-b="paste">Dùng nội dung này</button></details>
        ${d.note ? `<p class="small warn">ℹ️ ${esc(d.note)}</p>` : ''}
        ${busy && !progress ? `<p class="small">⏳ ${esc(busy)}</p>` : ''}
      </div>
      ${d.text || d.scanned ? `<div class="card">
        <h3>2️⃣ Các bài trong sách (${chosen.length}/${d.lessons.length} bài được chọn)</h3>
        <div class="row small">
          ${d.scanned ? '' : `<label>Chia theo tiêu đề <select data-d="kind">${opt('', 'Tự nhận', d.kind)}${Object.entries(HEADING_KINDS).map(([k, h]) => opt(k, `"${h.label} 1, 2…"`, d.kind)).join('')}</select></label>
          <button class="btn small" data-b="one">Cả tài liệu là 1 bài</button>`}
          <button class="btn small sea" data-b="ai-find" ${busy ? 'disabled' : ''}>✨ AI tìm bài${d.scanned ? ' trong sách scan' : ''}</button>
          <span class="spacer"></span>
          <button class="btn small" data-b="pick-all">Chọn tất cả</button><button class="btn small" data-b="pick-none">Bỏ chọn</button>
        </div>
        ${d.lessons.length ? `<div class="lesson-list">${d.lessons.map((l, i) => `
          <div class="lesson-row ${l.pick === false ? 'off' : ''}">
            <input type="checkbox" data-l="pick" data-i="${i}" ${l.pick === false ? '' : 'checked'}>
            <input class="grow" data-l="title" data-i="${i}" value="${esc(l.title)}">
            <span class="muted small">tr. ${l.from}${l.to > l.from ? `–${l.to}` : ''}${l.text ? ` · ${l.text.length.toLocaleString('vi-VN')} chữ` : ''}</span>
            ${i ? `<button class="btn small" data-b="merge" data-i="${i}" title="Gộp vào bài phía trên">⤴ Gộp</button>` : ''}
          </div>`).join('')}</div>`
          : `<p class="muted small">${d.scanned ? 'Sách scan (ảnh chụp): bấm "✨ AI tìm bài" để Gemini đọc sách và liệt kê các bài.' : 'Chưa nhận ra bài nào – thử đổi "Chia theo tiêu đề", bấm "✨ AI tìm bài" hoặc "Cả tài liệu là 1 bài".'}</p>`}
      </div>
      <div class="card">
        <h3>3️⃣ Dạng câu hỏi</h3>
        ${optionsPanel()}
        <div class="row"><button class="btn gold big" data-b="create" ${busy || !chosen.length || !opts.types.length ? 'disabled' : ''}>
          🚀 Tạo câu hỏi cho ${chosen.length} bài</button>
          <span class="muted small">≈ ${chosen.length * opts.count} câu${opts.method === 'ai' ? ` · khoảng ${Math.ceil(chosen.length * 8 / 60)} phút` : ''}</span></div>
      </div>` : ''}
      ${progressBox()}`;
  }

  function renderBook() {
    const s = findSet(bookId);
    if (!s) { view = 'list'; return renderList(); }
    const stats = lessonStats(s);
    const active = activeQuestions(s);
    const canMore = (l) => texts.has(l.id) || (s.book.fileRef && Date.now() - s.book.fileRef.at < FILE_TTL) || !!(draft?.scanned && draft.file);
    const lessonQs = showLesson ? s.questions.filter((q) => q.lid === showLesson) : [];
    return `<div class="row"><button class="btn small" data-b="back">← Danh sách sách</button><span class="spacer"></span>
        <button class="btn small" data-b="edit-all">✏️ Sửa từng câu</button>
        <button class="btn small sea" data-b="share">🔗 Chia sẻ bài đang bật</button></div>
      <div class="card">
        <div class="fld-row"><label class="fld grow">Tên<input data-s="name" value="${esc(s.name)}"></label>
          <div class="fld"><span>Khối / môn</span><b>Lớp ${esc(String(s.book.grade))} · ${esc(subjName(s.book.subject))}</b></div></div>
        <p class="small">Đang bật <b>${s.book.lessons.filter((l) => l.on !== false).length}</b>/${s.book.lessons.length} bài →
          <b>${active.length}</b> câu sẽ đến với học sinh${s.code ? ` (mã <span class="code-pill">🔑 ${esc(s.code)}</span> – bấm "Chia sẻ" lại sau khi đổi bài, mã giữ nguyên; lớp được giao mã này tự cập nhật)` : ''}.</p>
        <div class="row small"><button class="btn small" data-b="on-all">Bật tất cả</button><button class="btn small" data-b="on-none">Tắt tất cả</button>
          <span class="muted">Mẹo: chỉ bật bài đang học + vài bài trước để ôn.</span></div>
      </div>
      <div class="lesson-cards">${s.book.lessons.map((l) => `
        <div class="lesson-card ${l.on === false ? 'off' : ''}">
          <div class="lc-head">
            <label class="toggle" title="Bật = bài đang học"><input type="checkbox" data-lc="on" data-id="${l.id}" ${l.on === false ? '' : 'checked'}><i></i></label>
            <div class="grow"><b>${esc(l.title)}</b><div class="muted small">${stats[l.id] || 0} câu · tr. ${l.from}${l.to > l.from ? `–${l.to}` : ''}</div></div>
            <button class="btn small" data-b="view-q" data-id="${l.id}">${showLesson === l.id ? '▲ Ẩn câu' : '👁 Xem câu'}</button>
            ${canMore(l) ? `<button class="btn small sea" data-b="more" data-id="${l.id}" ${busy ? 'disabled' : ''}>➕ Tạo thêm</button>` : ''}
          </div>
          <details><summary class="small">🎯 Nội dung trọng tâm (${(l.key || []).length} ý) – hiện cho học sinh khi ôn</summary>
            <textarea data-lc="key" data-id="${l.id}" rows="${Math.max(3, (l.key || []).length + 1)}">${esc((l.key || []).join('\n'))}</textarea></details>
          ${showLesson === l.id ? `<ol class="q-list small">${lessonQs.map((q) => `<li><div class="q-main"><span class="qt">${QTYPES[q.t]?.icon || ''}</span> <b>${esc(q.q)}</b>
              <div><span class="ans-ok">✅ ${esc(q.a)}</span> ${q.w.map((w) => `<span class="ans-bad">❌ ${esc(w)}</span>`).join(' ')}</div>
              ${q.r ? `<div class="muted">📖 ${esc(q.r)}</div>` : ''}</div>
              <div class="q-acts"><button class="btn small danger" data-b="del-q" data-id="${q.id}">🗑️</button></div></li>`).join('') || '<li class="muted">Chưa có câu.</li>'}</ol>` : ''}
        </div>`).join('')}</div>
      ${s.book.lessons.some((l) => !canMore(l)) ? `<div class="card small muted">Muốn <b>tạo thêm câu</b> cho bài cũ? Mở lại tệp sách:
        <label class="btn small">📂 Mở lại tệp sách<input type="file" data-b="reopen" accept=".pdf,.docx,.txt,.md" hidden></label></div>` : ''}
      <div class="card"><h3>➕ Tạo thêm câu hỏi</h3>${optionsPanel()}</div>
      ${progressBox()}`;
  }

  // ------------------------------------------------------------------ đọc sách
  function rebuildLessons() {
    const d = draft;
    if (d.scanned) return;
    const list = d.pages.length ? splitLessons(d.pages, { kind: d.kind || null }) : splitLessons(d.text, { kind: d.kind || null });
    d.lessons = list;
  }

  async function loadBookFile(file) {
    if (!file) return;
    const kind = fileKind(file);
    draft = { ...draft, fileName: file.name, file, pages: [], text: '', lessons: [], note: '', scanned: false, fileRef: null };
    if (!draft.name) draft.name = file.name.replace(/\.[^.]+$/, '').slice(0, 70);
    busy = 'Đang đọc sách…';
    render();
    try {
      const r = await extractText(file, (i, n) => { const p = $r('.card p.small:last-child'); if (p && i % 5 === 0) p.textContent = `⏳ Đang đọc trang ${i}/${n}…`; });
      draft.text = r.text || '';
      draft.pages = r.pageTexts || [];
      if (r.note && kind === 'pdf') { draft.scanned = true; draft.note = 'Sách này là bản scan (ảnh chụp trang). Dùng "✨ AI tìm bài" – Gemini sẽ đọc trực tiếp các trang sách.'; }
      rebuildLessons();
      toast(draft.scanned ? '📷 Sách scan – dùng AI để đọc.' : `📚 Đã đọc ${draft.pages.length || 1} trang, nhận ra ${draft.lessons.length} bài.`);
    } catch (err) { draft.note = err.message; toast(`⚠️ ${esc(err.message)}`); }
    busy = '';
    render();
  }

  function apiKey() {
    const input = $r('#bk-key');
    const k = (input ? input.value : loadKey()).trim();
    if (k) saveKey(k);
    return k;
  }

  async function ensureUploaded(target) {
    // target: draft hoặc set.book – tải tệp sách scan lên Gemini một lần, dùng lại trong 46 giờ.
    if (target.fileRef && Date.now() - target.fileRef.at < FILE_TTL) return target.fileRef;
    if (!draft?.file) throw new Error('Cần chọn lại tệp sách.');
    const ref = await uploadBookFile({ apiKey: apiKey(), file: draft.file, onState: (st) => { busy = st === 'upload' ? 'Đang tải sách lên Gemini…' : 'Gemini đang đọc sách…'; render(); } });
    target.fileRef = { ...ref, at: Date.now() };
    return target.fileRef;
  }

  async function aiFind() {
    const key = apiKey();
    if (!key && (draft.scanned || !loadFallback())) { opts.method = 'ai'; render(); toast('Cần Gemini API key ở mục 3️⃣ – bấm "lấy miễn phí"' + (draft.scanned ? ' (sách scan chỉ Gemini đọc được).' : ' hoặc cài AI dự phòng.')); return; }
    busy = 'AI đang tìm các bài trong sách…';
    render();
    try {
      let list;
      if (draft.scanned) {
        const file = await ensureUploaded(draft);
        busy = 'AI đang tìm các bài trong sách…'; render();
        list = await findLessonsAI({ apiKey: key, file });
      } else {
        const pages = draft.pages.length ? draft.pages : [draft.text];
        const cand = pages.flatMap((p, i) => p.split('\n').map((l) => l.trim()).filter((l) => l.length >= 4 && l.length <= 90).map((l) => `p${i + 1}| ${l}`)).join('\n');
        list = await findLessonsAI({ apiKey: key, candidates: cand });
      }
      draft.lessons = list.map((l) => ({
        id: newId('ls'), title: l.title, from: l.from, to: l.to, on: true,
        text: draft.scanned ? '' : (draft.pages.length ? draft.pages.slice(l.from - 1, l.to).join('\n') : draft.text),
      }));
      toast(`✨ AI tìm thấy ${list.length} bài.`);
    } catch (err) { toast(`⚠️ ${esc(err.message)}`); }
    busy = '';
    render();
  }

  // ------------------------------------------------------------------ tạo câu hỏi
  async function makeFor(lesson, { set, file, key }) {
    const grade = `lớp ${set.book.grade}`;
    const subject = subjName(set.book.subject);
    const text = lesson.text || texts.get(lesson.id) || '';
    let qs;
    let keyList;
    if (opts.method === 'ai') {
      const r = await generateLessonAI({ apiKey: key, lesson: { ...lesson, text }, file: text ? null : file, options: { types: opts.types, count: opts.count, grade, subject, difficulty: opts.difficulty } });
      qs = r.questions;
      keyList = r.key.length ? r.key : keyPoints(text);
    } else {
      keyList = lesson.key?.length ? lesson.key : keyPoints(text);
      qs = offlineQuestions({ ...lesson, text, key: keyList }, { types: opts.types, count: opts.count });
    }
    return { qs, keyList };
  }

  async function runGeneration(set, lessons) {
    const key = opts.method === 'ai' ? apiKey() : '';
    if (opts.method === 'ai' && !key && !loadFallback()) { toast('Cần Gemini API key hoặc AI dự phòng – hoặc chọn "Tự động, không cần mạng".'); return; }
    stop = false;
    progress = { done: 0, total: lessons.length, log: [] };
    busy = 'gen';
    render();
    let file = null;
    let added = 0;
    for (const lesson of lessons) {
      if (stop) { progress.log.push('⏹ Đã dừng.'); break; }
      try {
        if (opts.method === 'ai' && !(lesson.text || texts.get(lesson.id)) && !file) file = await ensureUploaded(set.book);
        const { qs, keyList } = await makeFor(lesson, { set, file, key });
        const target = set.book.lessons.find((l) => l.id === lesson.id);
        if (keyList.length && !(target.key || []).length) target.key = keyList.slice(0, 8);
        const n = addToSet(set, tagWithLesson(qs, target).map(reviewToQuestion).filter(Boolean), MAX_BOOK_QUESTIONS);
        added += n;
        progress.log.push(`✅ ${esc(target.title)}: ${n} câu`);
      } catch (err) {
        progress.log.push(`⚠️ ${esc(lesson.title)}: ${esc(err.message)}`);
        if (/API key|key không đúng|hết lượt/i.test(err.message)) { stop = true; }
      }
      progress.done++;
      commit();
      render();
    }
    busy = '';
    commit();
    render();
    toast(`📚 Xong: thêm ${added} câu hỏi vào "${esc(set.name)}".`);
  }

  async function create() {
    const d = draft;
    const chosen = d.lessons.filter((l) => l.pick !== false);
    if (!chosen.length) return;
    const set = newSet(d.name || `SGK ${subjName(d.subject)} ${d.grade}`, {
      subject: subjName(d.subject), grade: `Lớp ${d.grade}`,
      book: { grade: d.grade, subject: d.subject, fileRef: d.fileRef, lessons: chosen.map((l) => ({ id: l.id, title: l.title, from: l.from, to: l.to, key: [], on: true })) },
    });
    chosen.forEach((l) => { if (l.text) texts.set(l.id, l.text); });
    sets().push(set);
    const st = getState();
    if (!st.settings.subjects.includes('custom')) st.settings.subjects.push('custom');
    commit();
    bookId = set.id;
    view = 'book';
    await runGeneration(set, chosen.map((l) => ({ ...l, text: l.text })));
    set.book.fileRef ||= d.fileRef;
    commit();
  }

  async function reopen(file) {
    const s = findSet(bookId);
    if (!s || !file) return;
    busy = 'Đang đọc lại sách…'; render();
    try {
      draft = { ...newDraft(), file, fileName: file.name };
      const r = await extractText(file);
      const lessons = r.note && fileKind(file) === 'pdf' ? [] : splitLessons(r.pageTexts || r.text);
      let matched = 0;
      for (const l of s.book.lessons) {
        const m = lessons.find((x) => x.title.toLowerCase() === l.title.toLowerCase())
          || (r.pageTexts ? { text: r.pageTexts.slice(l.from - 1, l.to).join('\n') } : null);
        if (m?.text) { texts.set(l.id, m.text); matched++; }
      }
      if (!matched && r.note) { draft.scanned = true; toast('Sách scan: bấm "➕ Tạo thêm" – hệ thống sẽ tải sách lên Gemini.'); s.book.fileRef = null; }
      else toast(`📂 Đã mở lại ${matched} bài.`);
    } catch (err) { toast(`⚠️ ${esc(err.message)}`); }
    busy = ''; render();
  }

  async function share() {
    const s = findSet(bookId);
    try {
      const code = await publishSet(getState(), s);
      commit(); render();
      try { await navigator.clipboard?.writeText(code); } catch { /* bỏ qua */ }
      toast(`🔑 Mã bộ đề: <b style="font-size:1.4em;letter-spacing:2px">${esc(code)}</b> – đã chép. Giao cho lớp ở 🏫 Server lớp học → ⚙️ Cài đặt. Đổi bài đang học thì bấm Chia sẻ lại (mã giữ nguyên).`);
    } catch (err) { toast(`⚠️ ${esc(err.message)}`); }
  }

  // ------------------------------------------------------------------ sự kiện
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-b]');
    if (!t || t.tagName === 'INPUT') return;
    const b = t.dataset.b;
    const s = findSet(bookId);
    if (b === 'new') { draft = newDraft(); progress = null; view = 'new'; render(); }
    else if (b === 'back') { if (busy === 'gen') { toast('Đang tạo câu hỏi – bấm Dừng trước.'); return; } view = 'list'; progress = null; showLesson = null; render(); }
    else if (b === 'open') { bookId = t.dataset.id; view = 'book'; progress = null; showLesson = null; render(); }
    else if (b === 'del-book') {
      const set = findSet(t.dataset.id);
      if (set && confirm(`Xoá "${set.name}" (${set.questions.length} câu)?`)) { getState().sets = sets().filter((x) => x.id !== set.id); commit(); render(); }
    } else if (b === 'paste') {
      const text = $r('#bk-paste').value.trim();
      if (text.length < 50) { toast('Nội dung còn quá ngắn.'); return; }
      draft = { ...draft, text, pages: [], fileName: '', file: null, scanned: false, note: '' };
      rebuildLessons();
      if (!draft.lessons.length) draft.lessons = [singleLesson(text, draft.name || 'Bài học')];
      render();
    } else if (b === 'one') { draft.lessons = [singleLesson(draft.text, draft.name || 'Bài học')]; render(); }
    else if (b === 'ai-find') aiFind();
    else if (b === 'pick-all' || b === 'pick-none') { draft.lessons.forEach((l) => { l.pick = b === 'pick-all'; }); render(); }
    else if (b === 'merge') {
      const i = Number(t.dataset.i);
      const [cur] = draft.lessons.splice(i, 1);
      const prev = draft.lessons[i - 1];
      prev.text = `${prev.text}\n${cur.text}`; prev.to = Math.max(prev.to, cur.to);
      render();
    } else if (b === 'create') create();
    else if (b === 'stop') { stop = true; toast('Sẽ dừng sau bài đang làm.'); }
    else if (b === 'share') share();
    else if (b === 'edit-all') openEditor?.(bookId);
    else if (b === 'on-all' || b === 'on-none') { s.book.lessons.forEach((l) => { l.on = b === 'on-all'; }); commit(); render(); }
    else if (b === 'view-q') { showLesson = showLesson === t.dataset.id ? null : t.dataset.id; render(); }
    else if (b === 'del-q') { s.questions = s.questions.filter((q) => q.id !== t.dataset.id); commit(); render(); }
    else if (b === 'more') {
      const l = s.book.lessons.find((x) => x.id === t.dataset.id);
      if (l) runGeneration(s, [{ ...l, text: texts.get(l.id) || '' }]);
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.b === 'file') { loadBookFile(t.files[0]); t.value = ''; return; }
    if (t.dataset.b === 'reopen') { reopen(t.files[0]); t.value = ''; return; }
    if (t.dataset.o === 'type') {
      opts.types = [...root.querySelectorAll('[data-o="type"]:checked')].map((x) => x.value);
      render(); return;
    }
    if (t.dataset.o) {
      opts[t.dataset.o] = t.dataset.o === 'count' ? Number(t.value) : t.value;
      if (opts.method !== 'ai') opts.types = opts.types.filter((x) => !QTYPES[x].ai);
      render(); return;
    }
    if (t.dataset.d && draft) {
      const k = t.dataset.d;
      if (k === 'grade') { draft.grade = Number(t.value); if (!subjectsForGrade(draft.grade).includes(draft.subject)) draft.subject = subjectsForGrade(draft.grade)[0]; render(); }
      else if (k === 'subject') draft.subject = t.value;
      else if (k === 'name') draft.name = t.value.trim();
      else if (k === 'kind') { draft.kind = t.value; rebuildLessons(); render(); }
      return;
    }
    if (t.dataset.l && draft) {
      const l = draft.lessons[Number(t.dataset.i)];
      if (t.dataset.l === 'pick') { l.pick = t.checked; render(); } else if (t.dataset.l === 'title') l.title = t.value.trim() || l.title;
      return;
    }
    const s = findSet(bookId);
    if (t.dataset.s === 'name' && s) { s.name = t.value.trim() || s.name; commit(); return; }
    if (t.dataset.lc && s) {
      const l = s.book.lessons.find((x) => x.id === t.dataset.id);
      if (t.dataset.lc === 'on') { l.on = t.checked; commit(); render(); } else if (t.dataset.lc === 'key') { l.key = t.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10); commit(); }
    }
  });

  root.addEventListener('input', (e) => { if (e.target.id === 'bk-key') saveKey(e.target.value); });
  bindFallbackFields(root);

  root.addEventListener('dragover', (e) => { const d = e.target.closest('#bk-drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  root.addEventListener('dragleave', (e) => e.target.closest('#bk-drop')?.classList.remove('over'));
  root.addEventListener('drop', (e) => {
    const d = e.target.closest('#bk-drop');
    if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    loadBookFile(e.dataTransfer.files[0]);
  });

  return {
    render,
    openBook(id) { bookId = id; view = 'book'; render(); },
    show() { root.hidden = false; render(); },
    hide() { root.hidden = true; },
  };
}
