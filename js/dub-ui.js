// Tab "Lồng tiếng Việt": nhận dạng + dịch video, tạo giọng đọc tiếng Việt, ghép và xuất.

import { VOICE_LANGUAGES } from './templates.js';
import { VOICES, normalizeSegments, assignVoices, segmentsFromProject, toSrt, layoutClips, encodeWav, ffmpegCommand } from './dubbing.js';
import { transcribeAndTranslate, synthesizeSpeech, DEFAULT_MODEL, DEFAULT_TTS_MODEL } from './gemini.js';
import { $, storage, STORAGE_KEYS, escapeHtml, toast, setStatus, fillOptions, download, slugify, getApiKey, pickRecorderType, recorderExtension } from './ui-utils.js';

const DUB_STORAGE = 'plan-video:dub';
const MIX_RATE = 48000;

export function initDubbing({ getVoiceLanguage }) {
  const state = {
    file: null,
    videoUrl: '',
    sourceLanguage: '',
    segments: [],
    voices: {},
    clips: new Map(), // khoá: nội dung + giọng → { samples, sampleRate }
    background: undefined, // AudioBuffer tiếng gốc (null nếu video không có tiếng)
    previewing: null,
    busy: false,
  };

  const status = (msg, isError) => setStatus($('#dub-status'), msg, isError);

  // ---------- Lưu/khôi phục ----------
  function persist() {
    storage.set(DUB_STORAGE, JSON.stringify({ segments: state.segments, voices: state.voices, sourceLanguage: state.sourceLanguage }));
  }

  try {
    const saved = JSON.parse(storage.get(DUB_STORAGE));
    if (saved?.segments?.length) {
      state.segments = normalizeSegments(saved.segments);
      state.voices = saved.voices || {};
      state.sourceLanguage = saved.sourceLanguage || '';
    }
  } catch { /* bỏ qua dữ liệu hỏng */ }

  // ---------- Cài đặt ----------
  fillOptions($('#dub-voice-language'), VOICE_LANGUAGES, storage.get(STORAGE_KEYS.dubLanguage) || getVoiceLanguage());
  $('#dub-voice-language').addEventListener('input', (e) => storage.set(STORAGE_KEYS.dubLanguage, e.target.value));
  $('#dub-model').value = storage.get(STORAGE_KEYS.model) || '';
  $('#dub-tts-model').value = storage.get(STORAGE_KEYS.ttsModel) || '';
  $('#dub-model').addEventListener('input', (e) => storage.set(STORAGE_KEYS.model, e.target.value.trim()));
  $('#dub-tts-model').addEventListener('input', (e) => storage.set(STORAGE_KEYS.ttsModel, e.target.value.trim()));
  $('#dub-bg-volume').addEventListener('input', (e) => { $('#dub-bg-value').textContent = `${e.target.value}%`; });

  const voiceLanguage = () => $('#dub-voice-language').value;
  const ttsModel = () => $('#dub-tts-model').value.trim() || DEFAULT_TTS_MODEL;

  function requireKey() {
    if (getApiKey()) return getApiKey();
    $('#dub-settings').open = true;
    status('Hãy nhập Gemini API key (miễn phí) trước nhé.', true);
    $('#dub-api-key').focus();
    return '';
  }

  // ---------- Chọn video ----------
  $('#dub-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.file = file;
    state.videoUrl = URL.createObjectURL(file);
    state.background = undefined;
    const video = $('#dub-video');
    video.src = state.videoUrl;
    video.hidden = false;
    $('#dub-file-name').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    status('');
    render();
  });

  // ---------- Nhận dạng & dịch ----------
  $('#btn-transcribe').addEventListener('click', async () => {
    if (!state.file) return status('Hãy chọn video trước nhé.', true);
    const apiKey = requireKey();
    if (!apiKey || state.busy) return;
    if (state.segments.length && !confirm('Thay thế bản dịch hiện tại bằng bản dịch mới?')) return;

    await runBusy($('#btn-transcribe'), async () => {
      status('Đang chuẩn bị video…');
      const result = await transcribeAndTranslate({
        apiKey,
        model: $('#dub-model').value.trim() || DEFAULT_MODEL,
        file: state.file,
        onProgress: (msg) => status(msg),
      });
      state.segments = normalizeSegments(result.segments);
      state.sourceLanguage = result.sourceLanguage;
      state.voices = assignVoices(state.segments);
      state.clips.clear();
      persist();
      render();
      status(state.segments.length
        ? `Đã dịch ${state.segments.length} câu. Kiểm tra lại rồi bấm "Tạo giọng lồng tiếng".`
        : 'Không tìm thấy lời nói nào trong video.', !state.segments.length);
    });
  });

  $('#btn-add-segment').addEventListener('click', () => {
    const last = state.segments[state.segments.length - 1];
    const start = last ? Math.round((last.end + 0.5) * 10) / 10 : 0;
    state.segments.push({ start, end: start + 3, speaker: last?.speaker || 'Người nói 1', gender: last?.gender || 'female', original: '', vietnamese: '' });
    state.voices = assignVoices(state.segments, state.voices);
    persist();
    render();
  });

  // ---------- Bảng câu thoại ----------
  const clipKey = (seg) => `${voiceLanguage()}|${state.voices[seg.speaker]}|${seg.speaker}|${seg.vietnamese}`;

  function timeline() {
    const items = state.segments.map((seg) => {
      const clip = state.clips.get(clipKey(seg));
      return { seg, clip, start: seg.start, duration: clip ? clip.samples.length / clip.sampleRate : 0 };
    });
    const placed = layoutClips(items);
    return items.map((item, i) => ({ ...item, ...placed[i] }));
  }

  function render() {
    const hasContent = state.segments.length > 0;
    $('#dub-editor').hidden = !hasContent;
    if (!hasContent) return;

    $('#dub-source').textContent = state.sourceLanguage ? `Ngôn ngữ gốc: ${state.sourceLanguage}.` : '';

    const speakers = [...new Set(state.segments.map((s) => s.speaker))];
    $('#dub-voices').innerHTML = speakers.map((sp) => `
      <label>Giọng cho “${escapeHtml(sp)}”
        <select data-speaker="${escapeHtml(sp)}">
          ${VOICES.map((v) => `<option value="${v.id}" ${state.voices[sp] === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
        </select>
      </label>`).join('');

    const rows = timeline();
    $('#dub-segments').innerHTML = rows.map(({ seg, clip, delay }, i) => {
      const fit = seg.end - seg.start;
      const len = clip ? clip.samples.length / clip.sampleRate : 0;
      let note = '';
      if (clip && delay > 0.3) note = `<span class="warn">⚠ Lệch ${delay.toFixed(1)}s – nên rút gọn câu trước</span>`;
      else if (clip && len > fit + 0.5) note = `<span class="warn">⚠ Đọc ${len.toFixed(1)}s, dài hơn ${fit.toFixed(1)}s</span>`;
      else if (clip) note = `<span class="ok">✓ ${len.toFixed(1)}s</span>`;
      return `
        <div class="segment" data-index="${i}">
          <div class="segment-head">
            <span class="badge">${i + 1}</span>
            <label class="inline">Từ <input data-key="start" type="number" step="0.1" min="0" value="${seg.start}"></label>
            <label class="inline">đến <input data-key="end" type="number" step="0.1" min="0" value="${seg.end}"> giây</label>
            <input data-key="speaker" class="speaker" value="${escapeHtml(seg.speaker)}" aria-label="Người nói">
            <span class="segment-actions">
              ${note}
              <button class="icon-btn" data-act="play" title="Nghe thử câu này">▶</button>
              <button class="icon-btn" data-act="delete" title="Xoá câu">🗑</button>
            </span>
          </div>
          ${seg.original ? `<p class="original">${escapeHtml(seg.original)}</p>` : ''}
          <textarea data-key="vietnamese" rows="2" placeholder="Câu tiếng Việt sẽ được đọc">${escapeHtml(seg.vietnamese)}</textarea>
        </div>`;
    }).join('');

    const name = state.file?.name || 'video.mp4';
    $('#dub-ffmpeg').textContent = ffmpegCommand(name, `${slugify(name)}-long-tieng.wav`, `${slugify(name)}-vi.srt`);
    $('#btn-export-video').hidden = !state.file;
    $('#btn-preview-dub').textContent = state.previewing ? '⏹ Dừng' : (state.file ? '▶ Nghe thử với video' : '▶ Nghe thử');
  }

  $('#dub-voices').addEventListener('input', (e) => {
    const sp = e.target.dataset.speaker;
    if (!sp) return;
    state.voices[sp] = e.target.value;
    persist();
    render();
  });

  $('#dub-segments').addEventListener('change', (e) => {
    const key = e.target.dataset.key;
    const row = e.target.closest('.segment');
    if (!key || !row) return;
    const seg = state.segments[Number(row.dataset.index)];
    if (key === 'start' || key === 'end') {
      seg[key] = Math.max(0, Number(e.target.value) || 0);
      if (seg.end <= seg.start) seg.end = seg.start + 0.5;
      state.segments.sort((a, b) => a.start - b.start);
    } else {
      seg[key] = e.target.value.trim();
      if (key === 'speaker') state.voices = assignVoices(state.segments, state.voices);
    }
    persist();
    render();
  });

  $('#dub-segments').addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    const row = e.target.closest('.segment');
    if (!act || !row) return;
    const index = Number(row.dataset.index);
    if (act === 'delete') {
      state.segments.splice(index, 1);
      persist();
      render();
      return;
    }
    const seg = state.segments[index];
    if (!seg.vietnamese) return toast('Câu này chưa có nội dung tiếng Việt');
    const apiKey = requireKey();
    if (!apiKey) return;
    await runBusy(e.target, async () => {
      const clip = await ensureClip(seg, apiKey);
      render();
      playSamples(clip);
    });
  });

  // ---------- Tạo giọng ----------
  async function ensureClip(seg, apiKey) {
    const key = clipKey(seg);
    if (!state.clips.has(key)) {
      state.clips.set(key, await synthesizeSpeech({
        apiKey,
        model: ttsModel(),
        text: seg.vietnamese,
        voice: state.voices[seg.speaker] || 'Kore',
        voiceLanguage: voiceLanguage(),
      }));
    }
    return state.clips.get(key);
  }

  async function generateAll() {
    const apiKey = requireKey();
    if (!apiKey) return false;
    const todo = state.segments.filter((s) => s.vietnamese && !state.clips.has(clipKey(s)));
    for (let i = 0; i < todo.length; i++) {
      status(`Đang tạo giọng ${i + 1}/${todo.length}…`);
      await ensureClip(todo[i], apiKey);
    }
    render();
    const late = timeline().filter((r) => r.delay > 0.3).length;
    status(late
      ? `Xong! Có ${late} câu bị lệch thời gian, hãy rút gọn các câu có ⚠ rồi tạo lại.`
      : 'Xong! Bấm "Nghe thử" hoặc xuất video.');
    return true;
  }

  $('#btn-tts').addEventListener('click', () => runBusy($('#btn-tts'), generateAll));

  async function runBusy(button, task) {
    if (state.busy) return;
    state.busy = true;
    button.disabled = true;
    try {
      await task();
    } catch (err) {
      status(err.message, true);
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  }

  // ---------- Ghép âm thanh ----------
  async function decodeBackground() {
    if (state.background !== undefined) return state.background;
    try {
      const ctx = new OfflineAudioContext(2, 1, MIX_RATE);
      state.background = await ctx.decodeAudioData(await state.file.arrayBuffer());
    } catch {
      state.background = null; // video không có tiếng hoặc trình duyệt không đọc được
    }
    return state.background;
  }

  async function renderMix() {
    const missing = state.segments.some((s) => s.vietnamese && !state.clips.has(clipKey(s)));
    if (missing && !(await generateAll())) return null;

    const rows = timeline().filter((r) => r.clip);
    if (!rows.length) {
      status('Chưa có câu tiếng Việt nào để đọc.', true);
      return null;
    }
    const video = $('#dub-video');
    const bgVolume = Number($('#dub-bg-volume').value) / 100;
    const background = state.file && bgVolume > 0 ? await decodeBackground() : null;
    const speechEnd = Math.max(...rows.map((r) => r.at + r.duration));
    const duration = Math.max(speechEnd, state.file && Number.isFinite(video.duration) ? video.duration : 0) + 0.2;

    const ctx = new OfflineAudioContext(2, Math.ceil(duration * MIX_RATE), MIX_RATE);
    if (background) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = background;
      gain.gain.value = bgVolume;
      src.connect(gain).connect(ctx.destination);
      src.start(0);
    }
    for (const { clip, at } of rows) {
      const buffer = ctx.createBuffer(1, clip.samples.length, clip.sampleRate);
      buffer.copyToChannel(clip.samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(at);
    }
    return ctx.startRendering();
  }

  function playSamples(clip) {
    const ctx = new AudioContext();
    const buffer = ctx.createBuffer(1, clip.samples.length, clip.sampleRate);
    buffer.copyToChannel(clip.samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => ctx.close();
    src.start();
  }

  function stopPreview() {
    if (!state.previewing) return;
    const { ctx, video } = state.previewing;
    state.previewing = null;
    ctx.close();
    if (video) {
      video.pause();
      video.muted = false;
    }
    render();
  }

  $('#btn-preview-dub').addEventListener('click', () => {
    if (state.previewing) return stopPreview();
    runBusy($('#btn-preview-dub'), async () => {
      const mixed = await renderMix();
      if (!mixed) return;
      const ctx = new AudioContext();
      const src = ctx.createBufferSource();
      src.buffer = mixed;
      src.connect(ctx.destination);
      const video = state.file ? $('#dub-video') : null;
      state.previewing = { ctx, video };
      src.onended = stopPreview;
      if (video) {
        video.muted = true;
        video.currentTime = 0;
        video.onpause = stopPreview;
        await video.play();
      }
      src.start();
      render();
      status('');
    });
  });

  // ---------- Xuất ----------
  const baseName = () => slugify(state.file?.name?.replace(/\.[^.]+$/, '') || 'giong-doc');

  $('#btn-export-wav').addEventListener('click', () => runBusy($('#btn-export-wav'), async () => {
    const mixed = await renderMix();
    if (!mixed) return;
    const channels = Array.from({ length: mixed.numberOfChannels }, (_, c) => mixed.getChannelData(c));
    download(`${baseName()}-long-tieng.wav`, new Blob([encodeWav(channels, mixed.sampleRate)], { type: 'audio/wav' }));
    status('Đã tải file giọng lồng tiếng.');
  }));

  $('#btn-export-srt').addEventListener('click', () => {
    if (!state.segments.some((s) => s.vietnamese)) return toast('Chưa có câu tiếng Việt nào');
    download(`${baseName()}-vi.srt`, toSrt(state.segments), 'application/x-subrip;charset=utf-8');
  });

  // Phát video (tắt tiếng) cùng giọng lồng tiếng và ghi lại thành file mới, ngay trong trình duyệt.
  $('#btn-export-video').addEventListener('click', () => runBusy($('#btn-export-video'), async () => {
    stopPreview();
    const video = $('#dub-video');
    const capture = video.captureStream || video.mozCaptureStream;
    const mimeType = pickRecorderType();
    if (!capture || !mimeType) {
      status('Trình duyệt này không xuất video được. Hãy dùng Chrome, hoặc tải .wav rồi ghép bằng CapCut/ffmpeg.', true);
      return;
    }
    const mixed = await renderMix();
    if (!mixed) return;

    video.pause();
    video.muted = true;
    video.currentTime = 0;
    await new Promise((r) => (video.readyState >= 2 && !video.seeking ? r() : video.addEventListener('seeked', r, { once: true })));

    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = mixed;
    src.connect(dest);
    const videoStream = capture.call(video);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const stopped = new Promise((r) => { recorder.onstop = r; });

    const onTime = () => status(`Đang xuất video… ${Math.round((video.currentTime / video.duration) * 100)}% (giữ tab này mở)`);
    video.addEventListener('timeupdate', onTime);
    recorder.start(1000);
    await video.play();
    src.start();
    await new Promise((r) => video.addEventListener('ended', r, { once: true }));
    recorder.stop();
    await stopped;
    video.removeEventListener('timeupdate', onTime);
    src.stop();
    ctx.close();
    video.muted = false;

    const ext = recorderExtension(mimeType);
    download(`${baseName()}-long-tieng-viet.${ext}`, new Blob(chunks, { type: mimeType.split(';')[0] }));
    status(`Đã xuất video lồng tiếng (.${ext}).`);
  }));

  render();

  return {
    // Nạp lời thoại/thuyết minh từ kịch bản Flow để tạo giọng đọc tiếng Việt chuẩn.
    loadFromProject(project) {
      const segments = segmentsFromProject(project);
      if (!segments.length) return false;
      if (state.segments.length && !confirm('Thay thế các câu đang có trong tab Lồng tiếng bằng lời thoại từ kịch bản?')) return true;
      state.segments = segments;
      state.sourceLanguage = '';
      state.voices = assignVoices(segments);
      $('#dub-voice-language').value = project.voiceLanguage;
      storage.set(STORAGE_KEYS.dubLanguage, project.voiceLanguage);
      persist();
      render();
      status(state.file
        ? 'Đã nạp lời thoại từ kịch bản. Bấm "Tạo giọng lồng tiếng".'
        : 'Đã nạp lời thoại từ kịch bản. Bấm "Tạo giọng lồng tiếng"; chọn video đã làm bằng Flow nếu muốn ghép luôn.');
      return true;
    },
  };
}
