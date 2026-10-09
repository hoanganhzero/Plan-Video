// Tab "Ghép phim": ghép các clip từ Flow, thêm tiêu đề, phụ đề, nhạc nền, chuyển cảnh và xuất video.

import {
  outputSize, computeTimeline, subtitlesFromProject, parseSrt, toSrtFromCaptions,
  activeCaption, fadeAlpha, titleAlpha, coverRect, wrapText,
} from './montage.js';
import {
  $, escapeHtml, toast, setStatus, download, slugify, pickRecorderType, recorderExtension, formatDuration,
} from './ui-utils.js';

const TITLE_SECONDS = 3.5;
const FADE_SECONDS = 0.35;
const FPS = 30;

function waitEvent(target, name) {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Không đọc được clip này, hãy thử file MP4/WebM khác.')); };
    const cleanup = () => { target.removeEventListener(name, ok); target.removeEventListener('error', fail); };
    target.addEventListener(name, ok, { once: true });
    target.addEventListener('error', fail, { once: true });
  });
}

async function readMetadata(url) {
  const v = document.createElement('video');
  v.preload = 'metadata';
  v.muted = true;
  v.src = url;
  await waitEvent(v, 'loadedmetadata');
  return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
}

export function initMontage({ getProject }) {
  const state = {
    clips: [],
    musicFile: null,
    musicBuffer: null,
    srtCaptions: [],
    running: null, // { stop, recording }
    aspectTouched: false,
    titleTouched: false,
  };
  const canvas = $('#edit-canvas');
  const ctx = canvas.getContext('2d');
  const status = (msg, isError) => setStatus($('#edit-status'), msg, isError);

  // ---------- Danh sách clip ----------
  $('#edit-files').addEventListener('change', async (e) => {
    const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    e.target.value = '';
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const meta = await readMetadata(url);
        state.clips.push({ file, url, name: file.name, trimStart: 0, trimEnd: 0, ...meta });
      } catch (err) {
        URL.revokeObjectURL(url);
        toast(`${file.name}: ${err.message}`);
      }
    }
    render();
    drawPoster();
  });

  function render() {
    const project = getProject();
    const timeline = computeTimeline(state.clips);
    $('#edit-options').hidden = state.clips.length === 0;
    $('#edit-total').textContent = state.clips.length
      ? `${state.clips.length} clip · tổng ${formatDuration(timeline.total)}`
      : 'Tải các clip đẹp nhất từ Flow về máy rồi chọn tất cả cùng lúc.';
    $('#edit-clips').innerHTML = state.clips.map((clip, i) => {
      const scene = project.scenes[i];
      return `
        <div class="clip" data-index="${i}">
          <span class="badge">${i + 1}</span>
          <div class="clip-info">
            <strong>${escapeHtml(clip.name)}</strong>
            <span class="muted small">${formatDuration(clip.duration)}${scene ? ` · Cảnh ${i + 1}: ${escapeHtml(scene.title)}` : ''}</span>
          </div>
          <label class="inline small">Cắt đầu <input data-key="trimStart" type="number" min="0" step="0.1" value="${clip.trimStart}"> s</label>
          <label class="inline small">Cắt cuối <input data-key="trimEnd" type="number" min="0" step="0.1" value="${clip.trimEnd}"> s</label>
          <span class="clip-actions">
            <button class="icon-btn" data-act="up" title="Lên" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-act="down" title="Xuống" ${i === state.clips.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn" data-act="delete" title="Bỏ clip">🗑</button>
          </span>
        </div>`;
    }).join('');

    const mismatch = $('#edit-subs').value === 'script' && state.clips.length !== project.scenes.length;
    if (mismatch && state.clips.length) status(`Lưu ý: có ${state.clips.length} clip nhưng kịch bản có ${project.scenes.length} cảnh. Phụ đề ghép theo thứ tự clip ↔ cảnh.`);
  }

  $('#edit-clips').addEventListener('change', (e) => {
    const key = e.target.dataset.key;
    const row = e.target.closest('.clip');
    if (!key || !row) return;
    state.clips[Number(row.dataset.index)][key] = Math.max(0, Number(e.target.value) || 0);
    render();
  });

  $('#edit-clips').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    const row = e.target.closest('.clip');
    if (!act || !row || state.running) return;
    const i = Number(row.dataset.index);
    if (act === 'delete') {
      URL.revokeObjectURL(state.clips[i].url);
      state.clips.splice(i, 1);
    } else {
      const j = act === 'up' ? i - 1 : i + 1;
      [state.clips[i], state.clips[j]] = [state.clips[j], state.clips[i]];
    }
    render();
    drawPoster();
  });

  // ---------- Tuỳ chọn ----------
  $('#edit-aspect').addEventListener('input', () => { state.aspectTouched = true; drawPoster(); });
  $('#edit-title').addEventListener('input', () => { state.titleTouched = true; drawPoster(); });
  $('#edit-subs').addEventListener('input', (e) => {
    $('#edit-srt-label').hidden = e.target.value !== 'srt';
    render();
  });
  $('#edit-srt').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    state.srtCaptions = file ? parseSrt(await file.text()) : [];
    toast(file ? `Đã đọc ${state.srtCaptions.length} dòng phụ đề` : 'Đã bỏ file phụ đề');
  });
  $('#edit-music').addEventListener('change', (e) => {
    state.musicFile = e.target.files[0] || null;
    state.musicBuffer = null;
  });
  const bindRange = (input, label) => $(input).addEventListener('input', (e) => { $(label).textContent = `${e.target.value}%`; });
  bindRange('#edit-clip-volume', '#edit-clip-vol-value');
  bindRange('#edit-music-volume', '#edit-music-vol-value');

  function captions(timeline) {
    const mode = $('#edit-subs').value;
    if (mode === 'script') return subtitlesFromProject(getProject(), timeline);
    if (mode === 'srt') return state.srtCaptions;
    return [];
  }

  // ---------- Vẽ khung hình ----------
  function setupCanvas() {
    const { width, height } = outputSize($('#edit-aspect').value);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  }

  function drawText(lines, { size, y, weight = 700 }) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => {
      const ly = y + i * size * 1.25;
      ctx.strokeText(line, canvas.width / 2, ly);
      ctx.fillText(line, canvas.width / 2, ly);
    });
  }

  function measureWith(size, weight = 700) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    return (text) => ctx.measureText(text).width;
  }

  function drawOverlays(t, item, caps) {
    const { width, height } = canvas;
    const base = Math.min(width, height);

    if ($('#edit-fade').checked && item) {
      const a = fadeAlpha(t, item, FADE_SECONDS);
      if (a > 0) {
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    const title = $('#edit-title').value.trim();
    const ta = title ? titleAlpha(t, TITLE_SECONDS) : 0;
    if (ta > 0) {
      const size = Math.round(base * 0.09);
      const lines = wrapText(title, width * 0.85, measureWith(size, 800));
      const blockH = lines.length * size * 1.25;
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, height / 2 - blockH / 2 - size * 0.6, width, blockH + size * 0.9);
      drawText(lines, { size, y: height / 2 - blockH / 2 + size * 0.9, weight: 800 });
      ctx.restore();
    }

    const cap = activeCaption(caps, t);
    if (cap) {
      const size = Math.round(base * 0.055);
      const lines = wrapText(cap.text, width * 0.88, measureWith(size));
      const bottom = height - height * 0.07;
      drawText(lines, { size, y: bottom - (lines.length - 1) * size * 1.25 });
    }
  }

  function drawVideoFrame(video) {
    if (video.readyState < 2 || !video.videoWidth) return;
    const r = coverRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
    ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
  }

  function drawPlaceholder(message) {
    setupCanvas();
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const size = Math.round(Math.min(canvas.width, canvas.height) * 0.045);
    ctx.font = `500 ${size}px system-ui, sans-serif`;
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  // Ảnh xem trước: khung hình đầu của clip 1 kèm tiêu đề.
  async function drawPoster() {
    if (state.running) return;
    if (!state.clips.length) return drawPlaceholder('Chọn các clip để bắt đầu');
    setupCanvas();
    const clip = state.clips[0];
    const v = document.createElement('video');
    v.muted = true;
    v.src = clip.url;
    try {
      await waitEvent(v, 'loadeddata');
      v.currentTime = Math.min(clip.duration, clip.trimStart + 0.1);
      await waitEvent(v, 'seeked');
      if (state.running) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawVideoFrame(v);
      const timeline = computeTimeline(state.clips);
      drawOverlays(1, null, captions(timeline));
    } catch {
      drawPlaceholder('Không xem trước được clip đầu');
    }
  }

  // ---------- Phát / ghi ----------
  async function loadMusic(audioCtx) {
    if (!state.musicFile) return null;
    if (!state.musicBuffer) {
      try {
        state.musicBuffer = await audioCtx.decodeAudioData(await state.musicFile.arrayBuffer());
      } catch {
        toast('Không đọc được file nhạc nền, sẽ bỏ qua nhạc.');
        state.musicFile = null;
        return null;
      }
    }
    return state.musicBuffer;
  }

  async function run({ record }) {
    if (!state.clips.length) return status('Hãy chọn các clip trước nhé.', true);
    const timeline = computeTimeline(state.clips);
    if (timeline.total <= 0) return status('Các clip bị cắt hết, hãy giảm "Cắt đầu/Cắt cuối".', true);

    let mimeType = '';
    if (record) {
      mimeType = pickRecorderType();
      if (!mimeType || !canvas.captureStream) {
        return status('Trình duyệt này chưa xuất video được. Hãy dùng Chrome hoặc Edge trên máy tính.', true);
      }
    }

    setupCanvas();
    const caps = captions(timeline);
    const audioCtx = new AudioContext();
    await audioCtx.resume();
    const mix = audioCtx.createGain();
    mix.connect(audioCtx.destination);
    const dest = audioCtx.createMediaStreamDestination();
    mix.connect(dest);

    // Hai trình phát luân phiên: một cái đang chiếu, cái kia nạp sẵn clip kế tiếp.
    const clipVolume = Number($('#edit-clip-volume').value) / 100;
    const players = [0, 1].map(() => {
      const video = document.createElement('video');
      video.playsInline = true;
      video.preload = 'auto';
      const gain = audioCtx.createGain();
      gain.gain.value = clipVolume;
      audioCtx.createMediaElementSource(video).connect(gain).connect(mix);
      return video;
    });

    async function prepare(video, index) {
      const clip = state.clips[index];
      const item = timeline.items[index];
      video.src = clip.url;
      await waitEvent(video, 'loadeddata');
      video.currentTime = item.inPoint;
      await waitEvent(video, 'seeked');
    }

    let stopped = false;
    let recorder = null;
    let chunks = [];
    const stop = () => { stopped = true; };
    state.running = { stop, record };
    updateButtons();

    try {
      status('Đang chuẩn bị…');
      const musicBuffer = await loadMusic(audioCtx);
      let musicSource = null;

      const items = timeline.items.map((item, i) => ({ item, i })).filter(({ item }) => item.length > 0);
      let pending = prepare(players[0], items[0].i);
      await pending;

      if (record) {
        const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
        recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
        recorder.start(1000);
      }

      if (musicBuffer) {
        const musicGainNode = audioCtx.createGain();
        const volume = Number($('#edit-music-volume').value) / 100;
        const now = audioCtx.currentTime;
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.loop = true;
        musicGainNode.gain.setValueAtTime(volume, now);
        musicGainNode.gain.setValueAtTime(volume, now + Math.max(0, timeline.total - 2));
        musicGainNode.gain.linearRampToValueAtTime(0, now + timeline.total);
        musicSource.connect(musicGainNode).connect(mix);
        musicSource.start(now);
      }

      for (let k = 0; k < items.length && !stopped; k++) {
        const { item, i } = items[k];
        const video = players[k % 2];
        if (k > 0) await pending;
        const next = items[k + 1];
        pending = next ? prepare(players[(k + 1) % 2], next.i) : null;

        await video.play();
        await new Promise((resolve) => {
          const tick = () => {
            const t = item.start + (video.currentTime - item.inPoint);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawVideoFrame(video);
            drawOverlays(t, item, caps);
            status(`${record ? 'Đang xuất' : 'Đang phát'} ${formatDuration(t)} / ${formatDuration(timeline.total)}${record ? ' (giữ tab này mở)' : ''}`);
            if (stopped || video.ended || video.currentTime >= item.outPoint) return resolve();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        video.pause();
      }

      if (pending) await pending.catch(() => {});
      musicSource?.stop();

      if (recorder) {
        const done = new Promise((r) => { recorder.onstop = r; });
        recorder.stop();
        await done;
        if (!stopped) {
          const ext = recorderExtension(mimeType);
          const name = `${slugify($('#edit-title').value || getProject().title || 'phim')}.${ext}`;
          download(name, new Blob(chunks, { type: mimeType.split(';')[0] }));
          status(`Đã xuất video (.${ext}). Bạn có thể đăng lên mạng hoặc lồng tiếng ở tab 5.`);
        } else {
          status('Đã huỷ xuất video.');
        }
      } else {
        status(stopped ? '' : 'Xem trước xong.');
      }
    } catch (err) {
      if (recorder?.state === 'recording') recorder.stop();
      status(err.message, true);
    } finally {
      players.forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
      audioCtx.close();
      chunks = [];
      state.running = null;
      updateButtons();
    }
  }

  function updateButtons() {
    const r = state.running;
    $('#btn-edit-preview').textContent = r && !r.record ? '⏹ Dừng' : '▶ Xem trước';
    $('#btn-edit-export').textContent = r && r.record ? '⏹ Huỷ xuất' : '🎞️ Xuất video';
    $('#btn-edit-preview').disabled = Boolean(r && r.record);
    $('#btn-edit-export').disabled = Boolean(r && !r.record);
  }

  $('#btn-edit-preview').addEventListener('click', () => (state.running ? state.running.stop() : run({ record: false })));
  $('#btn-edit-export').addEventListener('click', () => (state.running ? state.running.stop() : run({ record: true })));

  $('#btn-edit-srt').addEventListener('click', () => {
    const caps = captions(computeTimeline(state.clips));
    if (!caps.length) return toast('Chưa có phụ đề. Chọn “Lời thoại / lời hát từ kịch bản”.');
    download(`${slugify(getProject().title || 'phim')}-vi.srt`, toSrtFromCaptions(caps), 'application/x-subrip;charset=utf-8');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.running?.record) toast('Hãy giữ tab này mở để video xuất đúng!');
  });

  drawPlaceholder('Chọn các clip để bắt đầu');

  return {
    // Gọi khi mở tab: lấy khung hình & tiêu đề mặc định từ dự án đang mở.
    refresh() {
      const project = getProject();
      if (!state.aspectTouched) $('#edit-aspect').value = project.aspectRatio;
      if (!state.titleTouched) $('#edit-title').value = project.title || '';
      render();
      drawPoster();
    },
  };
}
