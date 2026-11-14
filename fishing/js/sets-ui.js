// Giao diện "Bộ đề": giáo viên / phụ huynh cấu hình nội dung học tập.
// - Bộ đề của tôi: bật/tắt, soạn thủ công, dán nhanh, nhập/xuất CSV, chia sẻ bằng mã.
// - Tạo từ tài liệu: PDF / Word / ảnh / văn bản → tìm câu trắc nghiệm có sẵn, tạo câu điền khuyết,
//   hoặc AI (Gemini) soạn câu hỏi → duyệt, sửa từng câu → lưu vào bộ đề.
// - Nhập mã: học sinh nhập mã 6 ký tự để tải bộ đề thầy cô chia sẻ.
import {
  newSet, normalizeQuestion, reviewToQuestion, questionToReview, parseQuizText, makeClozeQuestions,
  parseCSV, setToCSV, parsePipeLines, addToSet, MAX_QUESTIONS_PER_SET,
} from './content.js';
import { extractText, fileKind, fileToBase64 } from './extract.js';
import { generateQuestionsAI, loadKey, saveKey, MAX_FILE_BYTES } from './ai.js';
import { publishSet, fetchSet, cleanCode } from './online.js';

const DIFF = { 1: 'Dễ', 2: 'Vừa', 3: 'Khó' };

export function initSetsUI({ getState, save, toast, esc, beep, onChange }) {
  const $ = (s) => document.querySelector(s);
  const body = $('#sets-body');
  let tab = 'mine';
  let editingId = null; // bộ đề đang sửa
  let editingQ = null; // câu đang sửa trong bộ đề
  let review = []; // câu đang duyệt (tạo từ tài liệu)
  let doc = { text: '', file: null, kind: '', note: '', name: '' };
  let fetched = null; // bộ đề tải theo mã
  let busy = '';

  const state = () => getState();
  const sets = () => (state().sets ||= []);
  const findSet = (id) => sets().find((s) => s.id === id);
  const commit = () => { save(); onChange?.(); };
  const onlySets = () => state().settings.subjects.length === 1 && state().settings.subjects[0] === 'custom';
  const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ------------------------------------------------------------------ render
  function render() {
    document.querySelectorAll('#sets-tabs [data-stab]').forEach((b) => b.classList.toggle('active', b.dataset.stab === tab));
    if (tab === 'mine') body.innerHTML = editingId ? renderEditor() : renderList();
    else if (tab === 'import') body.innerHTML = renderImport();
    else body.innerHTML = renderJoin();
  }

  function renderList() {
    const list = sets();
    const total = list.filter((s) => s.enabled !== false).reduce((a, s) => a + s.questions.length, 0);
    return `
      <div class="row">
        <button class="btn gold" data-act="new-set">➕ Tạo bộ đề</button>
        <label class="btn">⬆️ Nhập CSV / JSON<input type="file" data-act="import-file" accept=".csv,.tsv,.json,text/csv,application/json" hidden></label>
        <span class="spacer"></span>
        <label class="check switch"><input type="checkbox" data-act="only-sets" ${onlySets() ? 'checked' : ''} ${total ? '' : 'disabled'}> Chỉ hỏi câu trong bộ đề</label>
      </div>
      <p class="muted small">Đang bật ${list.filter((s) => s.enabled !== false).length}/${list.length} bộ đề · ${total} câu hỏi.
        ${state().settings.subjects.includes('custom') ? '' : '⚠️ Môn "Bộ đề của thầy cô" đang tắt trong Cài đặt – bật lên để học sinh gặp các câu này.'}</p>
      ${list.length ? `<div class="set-list">${list.map((s) => `
        <div class="set-card ${s.enabled === false ? 'off' : ''}">
          <label class="toggle" title="Bật/tắt bộ đề"><input type="checkbox" data-act="toggle" data-id="${s.id}" ${s.enabled === false ? '' : 'checked'}><i></i></label>
          <div class="set-main">
            <div class="title">${esc(s.name)}</div>
            <div class="muted small">${s.questions.length} câu${s.subject ? ` · ${esc(s.subject)}` : ''}${s.grade ? ` · ${esc(s.grade)}` : ''}
              ${s.code ? ` · <span class="code-pill" title="Mã chia sẻ">🔑 ${esc(s.code)}</span>` : ''}${s.fromCode ? ` · tải từ mã ${esc(s.fromCode)}` : ''}</div>
          </div>
          <div class="set-acts">
            <button class="btn small" data-act="edit" data-id="${s.id}">✏️ Sửa</button>
            <button class="btn small sea" data-act="share" data-id="${s.id}" ${s.questions.length ? '' : 'disabled'}>🔗 Chia sẻ</button>
            <button class="btn small" data-act="csv" data-id="${s.id}" ${s.questions.length ? '' : 'disabled'}>⬇️ CSV</button>
            <button class="btn small danger" data-act="del-set" data-id="${s.id}">🗑️</button>
          </div>
        </div>`).join('')}</div>` : `<div class="card empty-sets">
          <h3>Chưa có bộ đề nào</h3>
          <p class="muted">Tạo bộ đề để học sinh trả lời đúng bài đang học trên lớp:</p>
          <ul class="muted small">
            <li>✍️ <b>Soạn tay</b>: bấm "Tạo bộ đề" rồi thêm từng câu.</li>
            <li>🪄 <b>Từ tài liệu</b>: tải PDF, Word, ảnh chụp trang SGK hoặc dán nội dung bài học ở tab "Tạo từ tài liệu".</li>
            <li>📊 <b>Từ Excel</b>: lưu bảng thành CSV (cột: Câu hỏi, Đáp án đúng, Sai 1, Sai 2, Sai 3, Giải thích, Độ khó) rồi "Nhập CSV".</li>
            <li>🔑 <b>Từ thầy cô</b>: nhập mã bộ đề ở tab "Nhập mã".</li>
          </ul></div>`}`;
  }

  function questionForm(q) {
    const v = q || { q: '', a: '', w: ['', '', ''], e: '', d: 1 };
    return `<div class="q-form card" id="q-form">
      <h3>${q ? '✏️ Sửa câu hỏi' : '➕ Thêm câu hỏi'}</h3>
      <label class="fld">Câu hỏi<textarea data-f="q" rows="2" placeholder="VD: Thủ đô của Việt Nam là thành phố nào?">${esc(v.q)}</textarea></label>
      <div class="fld-row">
        <label class="fld ok">✅ Đáp án đúng<input data-f="a" value="${esc(v.a)}" placeholder="Hà Nội"></label>
        ${[0, 1, 2].map((i) => `<label class="fld bad">❌ Đáp án sai ${i + 1}<input data-f="w${i}" value="${esc(v.w[i] || '')}" placeholder="${['Huế', 'Đà Nẵng', 'TP. Hồ Chí Minh'][i]}"></label>`).join('')}
      </div>
      <div class="fld-row">
        <label class="fld grow">💡 Giải thích (hiện sau khi trả lời – không bắt buộc)<input data-f="e" value="${esc(v.e || '')}"></label>
        <label class="fld">Độ khó<select data-f="d">${[1, 2, 3].map((d) => opt(d, DIFF[d], v.d || 1)).join('')}</select></label>
      </div>
      <p class="muted small">Độ khó quyết định loại cá: câu Dễ cho cá Thường/Khá, Vừa cho cá Hiếm/Quý, Khó cho cá Huyền thoại/Thần thoại.</p>
      <div class="row"><button class="btn gold" data-act="save-q">${q ? '💾 Lưu câu' : '➕ Thêm vào bộ đề'}</button>
        ${q ? '<button class="btn" data-act="cancel-q">Huỷ</button>' : ''}<span class="small" id="q-form-err"></span></div>
    </div>`;
  }

  function renderEditor() {
    const s = findSet(editingId);
    if (!s) { editingId = null; return renderList(); }
    const editQ = editingQ ? s.questions.find((q) => q.id === editingQ) : null;
    return `
      <div class="row"><button class="btn small" data-act="back">← Danh sách bộ đề</button><span class="spacer"></span>
        <span class="muted small">${s.questions.length}/${MAX_QUESTIONS_PER_SET} câu</span></div>
      <div class="fld-row">
        <label class="fld grow">Tên bộ đề<input data-set="name" value="${esc(s.name)}"></label>
        <label class="fld">Môn<input data-set="subject" value="${esc(s.subject || '')}" placeholder="Toán, Tiếng Việt…"></label>
        <label class="fld">Lớp<input data-set="grade" value="${esc(s.grade || '')}" placeholder="Lớp 3"></label>
      </div>
      ${questionForm(editQ)}
      <details class="card"><summary><b>⚡ Dán nhanh nhiều câu</b> <span class="muted small">(mỗi dòng: Câu hỏi | Đáp án đúng | Sai 1 | Sai 2 | Sai 3)</span></summary>
        <textarea id="quick-text" rows="5" placeholder="7 × 8 bằng bao nhiêu? | 56 | 54 | 48 | 64&#10;&quot;Dog&quot; nghĩa là gì? | Con chó | Con mèo | Con gà | Con vịt"></textarea>
        <div class="row"><button class="btn sea" data-act="quick-add">Thêm các câu này</button>
          <button class="btn" data-act="goto-import">🪄 Tạo từ tài liệu cho bộ đề này</button></div>
      </details>
      <ol class="q-list">${s.questions.map((q) => `
        <li class="${q.id === editingQ ? 'editing' : ''}">
          <div class="q-main"><b>${esc(q.q)}</b>
            <div class="small"><span class="ans-ok">✅ ${esc(q.a)}</span> ${q.w.map((w) => `<span class="ans-bad">❌ ${esc(w)}</span>`).join(' ')}</div>
            ${q.e ? `<div class="muted small">💡 ${esc(q.e)}</div>` : ''}</div>
          <span class="diff d${q.d || 1}">${DIFF[q.d || 1]}</span>
          <div class="q-acts"><button class="btn small" data-act="edit-q" data-id="${q.id}">✏️</button><button class="btn small danger" data-act="del-q" data-id="${q.id}">🗑️</button></div>
        </li>`).join('')}</ol>
      ${s.questions.length ? '' : '<p class="muted">Chưa có câu hỏi – thêm bằng biểu mẫu ở trên, dán nhanh, hoặc tạo từ tài liệu.</p>'}`;
  }

  function renderImport() {
    const key = loadKey();
    const sendable = doc.file && (doc.kind === 'pdf' || doc.kind === 'image') && doc.file.size <= MAX_FILE_BYTES;
    const selected = review.filter((r) => r.keep !== false);
    const ready = selected.filter((r) => r.correct !== null).length;
    return `
      <div class="card">
        <h3>1️⃣ Đưa tài liệu vào</h3>
        <label class="drop" id="drop">
          <input type="file" data-act="doc-file" accept=".pdf,.docx,.doc,.txt,.md,.csv,image/*" hidden>
          <span class="drop-ico">📄</span>
          <span><b>Chọn hoặc kéo thả tệp</b> PDF, Word (.docx), ảnh chụp trang SGK, .txt</span>
          ${doc.name ? `<span class="small">Đã chọn: <b>${esc(doc.name)}</b></span>` : ''}
        </label>
        ${doc.note ? `<p class="small warn">ℹ️ ${esc(doc.note)}</p>` : ''}
        <label class="fld">…hoặc dán / sửa nội dung bài học (đề kiểm tra, đoạn SGK, ghi chú)
          <textarea id="doc-text" rows="7" placeholder="Dán nội dung tại đây. Chữ đọc được từ tệp cũng hiện ở đây để bạn sửa trước khi tạo câu hỏi.">${esc(doc.text)}</textarea></label>
        <p class="muted small">Nội dung được xử lý ngay trong trình duyệt. Chỉ khi bấm "AI tạo câu hỏi", nội dung mới được gửi tới Google Gemini.</p>
      </div>
      <div class="card">
        <h3>2️⃣ Tạo câu hỏi</h3>
        <div class="gen-grid">
          <div class="gen">
            <div class="title">🔍 Tìm câu trắc nghiệm có sẵn</div>
            <div class="muted small">Dành cho đề / phiếu bài tập dạng "Câu 1… A. B. C. D." – nhận cả đáp án "Đáp án: B", dấu *, (đúng) hoặc bảng đáp án cuối đề. Không cần mạng.</div>
            <button class="btn sea" data-act="gen-quiz" ${busy ? 'disabled' : ''}>Tìm câu hỏi</button>
          </div>
          <div class="gen">
            <div class="title">✂️ Câu điền khuyết tự động</div>
            <div class="muted small">Từ nội dung bài học: che năm, số liệu, tên riêng hoặc khái niệm "… là …". Không cần mạng – nên duyệt lại.</div>
            <button class="btn sea" data-act="gen-cloze" ${busy ? 'disabled' : ''}>Tạo câu điền khuyết</button>
          </div>
          <div class="gen ai">
            <div class="title">✨ AI soạn câu hỏi (Gemini)</div>
            <div class="muted small">Đọc hiểu nội dung, cả ảnh chụp trang sách và PDF scan, rồi soạn câu hỏi kèm giải thích.</div>
            <div class="fld-row">
              <label class="fld">Số câu<select id="ai-count">${[5, 10, 15, 20, 30].map((n) => opt(n, n, 10)).join('')}</select></label>
              <label class="fld">Độ khó<select id="ai-diff">${opt('mix', 'Trộn', 'mix')}${[1, 2, 3].map((d) => opt(d, DIFF[d], 'mix')).join('')}</select></label>
              <label class="fld">Lớp<input id="ai-grade" placeholder="Lớp 4"></label>
              <label class="fld">Môn<input id="ai-subject" placeholder="Khoa học"></label>
            </div>
            <label class="fld">Trọng tâm (không bắt buộc)<input id="ai-focus" placeholder="VD: các mốc thời gian, từ vựng Unit 3"></label>
            ${sendable ? `<label class="check small"><input type="checkbox" id="ai-sendfile" ${doc.kind === 'image' || doc.note ? 'checked' : ''}> Gửi cả tệp gốc cho AI (đọc được ảnh / PDF scan)</label>` : ''}
            <label class="fld">Gemini API key <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">lấy miễn phí</a>
              <input id="ai-key" type="password" value="${esc(key)}" placeholder="Dán key – chỉ lưu trong trình duyệt này" autocomplete="off"></label>
            <button class="btn gold" data-act="gen-ai" ${busy ? 'disabled' : ''}>${busy === 'ai' ? '⏳ AI đang soạn…' : '✨ AI tạo câu hỏi'}</button>
          </div>
        </div>
        ${busy && busy !== 'ai' ? `<p class="small">⏳ ${esc(busy)}</p>` : ''}
      </div>
      ${review.length ? `<div class="card">
        <h3>3️⃣ Duyệt câu hỏi (${selected.length} câu được chọn)</h3>
        <p class="muted small">Kiểm tra lại từng câu: sửa chữ, bấm ⭕ để chọn đáp án đúng, bỏ chọn câu không dùng. Câu thiếu đáp án đúng sẽ không được lưu.</p>
        <div class="review-gen">${review.map((r, i) => `
          <div class="rv ${r.keep === false ? 'off' : ''} ${r.correct === null ? 'need' : ''}">
            <div class="rv-head"><label class="check"><input type="checkbox" data-rv="keep" data-i="${i}" ${r.keep === false ? '' : 'checked'}> Câu ${i + 1}</label>
              <span class="src">${{ quiz: '🔍 có sẵn', cloze: '✂️ điền khuyết', ai: '✨ AI' }[r.source] || ''}</span>
              <select data-rv="d" data-i="${i}">${[1, 2, 3].map((d) => opt(d, DIFF[d], r.d)).join('')}</select></div>
            <textarea data-rv="q" data-i="${i}" rows="2">${esc(r.q)}</textarea>
            <div class="rv-opts">${r.options.map((o, j) => `
              <label class="rv-opt ${r.correct === j ? 'right' : ''}"><input type="radio" name="rv${i}" data-rv="correct" data-i="${i}" data-j="${j}" ${r.correct === j ? 'checked' : ''}>
                <input data-rv="opt" data-i="${i}" data-j="${j}" value="${esc(o)}"></label>`).join('')}</div>
            ${r.correct === null ? '<div class="small warn">⚠️ Chưa có đáp án đúng – hãy chọn ⭕ một phương án.</div>' : ''}
            <input class="rv-e" data-rv="e" data-i="${i}" value="${esc(r.e || '')}" placeholder="💡 Giải thích (không bắt buộc)">
          </div>`).join('')}</div>
        <div class="row save-row">
          <label class="fld">Lưu vào<select id="rv-target">${opt('__new', '➕ Bộ đề mới', editingId || '__new')}${sets().map((s) => opt(s.id, esc(s.name), editingId || '__new')).join('')}</select></label>
          <label class="fld grow">Tên bộ đề mới<input id="rv-name" value="${esc(doc.name ? doc.name.replace(/\.[^.]+$/, '') : 'Bộ đề mới')}"></label>
          <button class="btn gold big" data-act="save-review" ${ready ? '' : 'disabled'}>💾 Lưu ${ready} câu</button>
          <button class="btn" data-act="clear-review">Xoá danh sách</button>
        </div>
      </div>` : ''}`;
  }

  function renderJoin() {
    return `
      <div class="card join-card">
        <h3>🔑 Nhập mã bộ đề của thầy cô</h3>
        <p class="muted small">Thầy cô tạo bộ đề rồi bấm "Chia sẻ" để có mã 6 ký tự. Nhập mã để tải các câu hỏi đó về máy này.</p>
        <div class="row"><input id="join-code" class="nick-input code-input" maxlength="8" placeholder="VD: K7M2QX" autocomplete="off" value="${esc(fetched?.code || '')}">
          <button class="btn gold" data-act="join-find" ${busy ? 'disabled' : ''}>${busy === 'join' ? '⏳…' : 'Tìm bộ đề'}</button></div>
        ${fetched ? `<div class="card fetched">
          <div class="title">📝 ${esc(fetched.name)}</div>
          <div class="muted small">${fetched.question_count} câu hỏi · cập nhật ${new Date(fetched.updated_at).toLocaleString('vi-VN')}</div>
          <ol class="small">${fetched.payload.slice(0, 3).map((q) => `<li>${esc(q.q)}</li>`).join('')}${fetched.payload.length > 3 ? '<li>…</li>' : ''}</ol>
          <div class="row"><button class="btn gold" data-act="join-add">⬇️ Thêm vào bộ đề của tôi</button>
            <label class="check small"><input type="checkbox" id="join-only" checked> Chỉ hỏi câu trong bộ đề này</label></div>
        </div>` : ''}
      </div>`;
  }

  // ------------------------------------------------------------------ actions
  function readForm() {
    const f = (k) => body.querySelector(`#q-form [data-f="${k}"]`)?.value || '';
    return { q: f('q'), a: f('a'), w: [f('w0'), f('w1'), f('w2')], e: f('e'), d: Number(f('d')) || 1 };
  }

  async function loadFile(file) {
    if (!file) return;
    doc = { text: '', file, kind: fileKind(file), note: '', name: file.name };
    busy = 'Đang đọc tệp…';
    render();
    try {
      const r = await extractText(file, (i, n) => { busy = `Đang đọc trang ${i}/${n}…`; const p = body.querySelector('.card + .card p.small'); if (p) p.textContent = `⏳ ${busy}`; });
      doc.text = r.text || '';
      doc.note = r.note || '';
      toast(r.text ? `📄 Đã đọc ${r.pages ? `${r.pages} trang, ` : ''}${r.text.length.toLocaleString('vi-VN')} ký tự.` : '📷 Đã nhận tệp – dùng AI để đọc nội dung.');
    } catch (err) {
      doc.note = err.message;
      toast(`⚠️ ${err.message}`);
    }
    busy = '';
    render();
  }

  function setReview(list, label) {
    if (!list.length) { toast(`Không tìm thấy câu nào bằng cách "${label}". Thử cách khác nhé.`); return; }
    review = [...review.filter((r) => r.keep !== false), ...list.map((r) => ({ ...r, keep: true }))];
    beep?.([[523, 0.08], [784, 0.12]]);
    toast(`✅ ${label}: được ${list.length} câu – kiểm tra lại rồi bấm Lưu.`);
    render();
    body.querySelector('.review-gen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncDocText() {
    const t = body.querySelector('#doc-text');
    if (t) doc.text = t.value;
  }

  async function genAI() {
    syncDocText();
    const apiKey = body.querySelector('#ai-key').value.trim();
    if (!apiKey) { toast('Cần Gemini API key – bấm "lấy miễn phí" để tạo.'); return; }
    saveKey(apiKey);
    const useFile = body.querySelector('#ai-sendfile')?.checked && doc.file;
    if (!useFile && doc.text.trim().length < 50) { toast('Nội dung còn quá ngắn – hãy tải tệp hoặc dán bài học.'); return; }
    const options = {
      count: Number(body.querySelector('#ai-count').value), difficulty: body.querySelector('#ai-diff').value,
      grade: body.querySelector('#ai-grade').value.trim(), subject: body.querySelector('#ai-subject').value.trim(),
      focus: body.querySelector('#ai-focus').value.trim(),
    };
    busy = 'ai';
    render();
    try {
      const source = useFile
        ? { file: { mimeType: doc.file.type || (doc.kind === 'pdf' ? 'application/pdf' : 'image/jpeg'), base64: await fileToBase64(doc.file) } }
        : { text: doc.text };
      const list = await generateQuestionsAI({ apiKey, source, options });
      busy = '';
      setReview(list, 'AI soạn câu hỏi');
    } catch (err) {
      busy = '';
      render();
      toast(`⚠️ ${err.message}`);
    }
  }

  function saveReview() {
    const qs = review.filter((r) => r.keep !== false).map(reviewToQuestion).filter(Boolean);
    if (!qs.length) return;
    const target = body.querySelector('#rv-target').value;
    let set = findSet(target);
    if (!set) {
      set = newSet(body.querySelector('#rv-name').value || 'Bộ đề mới');
      sets().push(set);
    }
    const added = addToSet(set, qs);
    review = [];
    if (!state().settings.subjects.includes('custom')) state().settings.subjects.push('custom');
    commit();
    toast(`💾 Đã lưu ${added} câu vào "${set.name}"${added < qs.length ? ` (bỏ ${qs.length - added} câu trùng)` : ''}.`);
    tab = 'mine';
    editingId = set.id;
    render();
  }

  async function share(id) {
    const s = findSet(id);
    if (!s?.questions.length) return;
    try {
      const code = await publishSet(state(), s);
      commit();
      render();
      try { await navigator.clipboard?.writeText(code); } catch { /* không có quyền clipboard */ }
      toast(`🔑 Mã bộ đề: <b style="font-size:1.4em;letter-spacing:2px">${esc(code)}</b> – đã chép. Học sinh nhập mã này ở Bộ đề → Nhập mã. Sửa xong bấm Chia sẻ lại, mã giữ nguyên.`);
    } catch (err) {
      toast(`⚠️ Chưa chia sẻ được: ${esc(err.message)} (cần kết nối mạng)`);
    }
  }

  async function join() {
    const code = cleanCode(body.querySelector('#join-code').value);
    busy = 'join';
    render();
    try {
      fetched = await fetchSet(code);
    } catch (err) {
      fetched = null;
      toast(`⚠️ ${esc(err.message)}`);
    }
    busy = '';
    render();
  }

  function joinAdd() {
    if (!fetched) return;
    let set = sets().find((s) => s.fromCode === fetched.code);
    if (set) set.questions = [];
    else { set = newSet(fetched.name, { fromCode: fetched.code }); sets().push(set); }
    set.name = fetched.name;
    const added = addToSet(set, fetched.payload);
    const st = state();
    if (body.querySelector('#join-only')?.checked) {
      st.settings.subjects = ['custom'];
      sets().forEach((s) => { s.enabled = s.id === set.id; });
    } else if (!st.settings.subjects.includes('custom')) st.settings.subjects.push('custom');
    commit();
    toast(`📝 Đã thêm "${esc(set.name)}" (${added} câu). Đi câu thôi!`);
    fetched = null;
    tab = 'mine';
    render();
  }

  // ------------------------------------------------------------------ events
  document.querySelector('#sets-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stab]');
    if (!b) return;
    syncDocText();
    tab = b.dataset.stab;
    render();
  });

  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT') return;
    const id = t.dataset.id;
    const act = t.dataset.act;
    const s = findSet(editingId);
    if (act === 'new-set') {
      const set = newSet(`Bộ đề ${sets().length + 1}`);
      sets().push(set);
      editingId = set.id; editingQ = null;
      commit(); render();
    } else if (act === 'edit') { editingId = id; editingQ = null; render(); }
    else if (act === 'back') { editingId = null; editingQ = null; render(); }
    else if (act === 'del-set') {
      const set = findSet(id);
      if (set && confirm(`Xoá bộ đề "${set.name}" (${set.questions.length} câu)?`)) {
        state().sets = sets().filter((x) => x.id !== id);
        commit(); render();
      }
    } else if (act === 'csv') {
      const set = findSet(id);
      download(`${set.name}.csv`, setToCSV(set), 'text/csv;charset=utf-8');
    } else if (act === 'share') share(id);
    else if (act === 'save-q' && s) {
      const raw = readForm();
      const q = normalizeQuestion({ ...raw, id: editingQ || undefined });
      const err = body.querySelector('#q-form-err');
      if (!q) { err.textContent = '⚠️ Cần câu hỏi, đáp án đúng và ít nhất 1 đáp án sai (khác đáp án đúng).'; return; }
      if (editingQ) s.questions = s.questions.map((x) => (x.id === editingQ ? q : x));
      else if (!addToSet(s, [q])) { err.textContent = '⚠️ Câu này đã có trong bộ đề.'; return; }
      editingQ = null;
      commit(); render();
      toast('💾 Đã lưu câu hỏi.');
    } else if (act === 'cancel-q') { editingQ = null; render(); }
    else if (act === 'edit-q') { editingQ = id; render(); body.querySelector('#q-form')?.scrollIntoView({ behavior: 'smooth' }); }
    else if (act === 'del-q' && s) { s.questions = s.questions.filter((q) => q.id !== id); commit(); render(); }
    else if (act === 'quick-add' && s) {
      const { questions, errors } = parsePipeLines(body.querySelector('#quick-text').value);
      const added = addToSet(s, questions);
      commit(); render();
      toast(`➕ Thêm ${added} câu.${errors.length ? ` Bỏ qua dòng ${errors.join(', ')}.` : ''}`);
    } else if (act === 'goto-import') { tab = 'import'; render(); }
    else if (act === 'gen-quiz') { syncDocText(); setReview(parseQuizText(doc.text), 'Tìm câu trắc nghiệm'); }
    else if (act === 'gen-cloze') { syncDocText(); setReview(makeClozeQuestions(doc.text, { max: 15 }), 'Câu điền khuyết'); }
    else if (act === 'gen-ai') genAI();
    else if (act === 'save-review') saveReview();
    else if (act === 'clear-review') { review = []; render(); }
    else if (act === 'join-find') join();
    else if (act === 'join-add') joinAdd();
  });

  body.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.act === 'toggle') { const set = findSet(t.dataset.id); set.enabled = t.checked; commit(); render(); return; }
    if (t.dataset.act === 'only-sets') {
      state().settings.subjects = t.checked ? ['custom'] : ['math', 'vi', 'en', 'sci', 'his', 'custom'];
      commit(); render();
      toast(t.checked ? '📝 Học sinh chỉ gặp câu trong các bộ đề đang bật.' : 'Học sinh gặp cả câu có sẵn của trò chơi và bộ đề.');
      return;
    }
    if (t.dataset.act === 'doc-file') { await loadFile(t.files[0]); t.value = ''; return; }
    if (t.dataset.act === 'import-file') {
      const file = t.files[0];
      t.value = '';
      if (!file) return;
      const text = await file.text();
      let set;
      if (/\.json$/i.test(file.name)) {
        try {
          const data = JSON.parse(text);
          set = newSet(data.name || file.name.replace(/\.json$/i, ''));
          addToSet(set, data.questions || data);
        } catch { toast('⚠️ Tệp JSON không hợp lệ.'); return; }
      } else {
        const { questions, errors } = parseCSV(text);
        set = newSet(file.name.replace(/\.(csv|tsv)$/i, ''));
        addToSet(set, questions);
        if (errors.length) toast(`Bỏ qua dòng ${errors.slice(0, 10).join(', ')}${errors.length > 10 ? '…' : ''} (thiếu dữ liệu).`);
      }
      if (!set.questions.length) { toast('⚠️ Không đọc được câu hỏi nào. Kiểm tra các cột: Câu hỏi, Đáp án đúng, Sai 1…'); return; }
      sets().push(set);
      commit(); render();
      toast(`⬆️ Đã nhập "${esc(set.name)}" – ${set.questions.length} câu.`);
      return;
    }
    if (t.dataset.set) {
      const s = findSet(editingId);
      s[t.dataset.set] = t.value.trim() || (t.dataset.set === 'name' ? 'Bộ đề' : '');
      commit();
      return;
    }
    if (t.dataset.rv) {
      const r = review[Number(t.dataset.i)];
      const k = t.dataset.rv;
      if (k === 'keep') r.keep = t.checked;
      else if (k === 'correct') r.correct = Number(t.dataset.j);
      else if (k === 'd') r.d = Number(t.value);
      if (k === 'keep' || k === 'correct') render();
    }
  });
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset.rv) return;
    const r = review[Number(t.dataset.i)];
    if (t.dataset.rv === 'q') r.q = t.value;
    else if (t.dataset.rv === 'opt') r.options[Number(t.dataset.j)] = t.value;
    else if (t.dataset.rv === 'e') r.e = t.value;
  });
  // Kéo thả tệp
  body.addEventListener('dragover', (e) => { if (e.target.closest('#drop')) { e.preventDefault(); e.target.closest('#drop').classList.add('over'); } });
  body.addEventListener('dragleave', (e) => e.target.closest('#drop')?.classList.remove('over'));
  body.addEventListener('drop', (e) => {
    const d = e.target.closest('#drop');
    if (!d) return;
    e.preventDefault();
    d.classList.remove('over');
    loadFile(e.dataTransfer.files[0]);
  });

  return {
    render,
    open(which = 'mine') { tab = which; editingQ = null; render(); },
  };
}

export { questionToReview };
