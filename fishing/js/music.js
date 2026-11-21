// Nhạc nền tự tổng hợp bằng Web Audio (không cần tệp nhạc, không lo bản quyền).
// - "calm": hợp âm êm + giai điệu ngũ cung (kiểu dân gian) + tiếng nước – khi chờ cá, đi dạo.
// - "fight": nhanh hơn, thêm trống nhẹ và bass dồn – khi kéo cá / trả lời câu hỏi.
// Trình duyệt chỉ cho phát âm thanh sau khi người chơi chạm/bấm lần đầu → gọi unlock() trong sự kiện bấm.

// Âm giai ngũ cung (Đô – Rê – Mi – Son – La), tần số theo nốt MIDI.
const PENTA = [0, 2, 4, 7, 9];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Vòng hợp âm I – vi – IV – V (Đô trưởng), mỗi hợp âm: [bass, ...nốt]
const CHORDS = [
  [48, 60, 64, 67], // C
  [45, 57, 60, 64], // Am
  [41, 57, 60, 65], // F
  [43, 55, 59, 62], // G
];
const MOODS = {
  calm: { bpm: 76, melodyChance: 0.55, drums: false, padGain: 0.07, water: 0.05 },
  fight: { bpm: 128, melodyChance: 0.8, drums: true, padGain: 0.05, water: 0.02 },
};

export function createMusic() {
  let ctx = null;
  let master = null;
  let padBus = null;
  let fxBus = null;
  let water = null;
  let enabled = true;
  let volume = 0.5;
  let mood = 'calm';
  let timer = null;
  let nextTime = 0;   // thời điểm phách tiếp theo
  let step = 0;       // đếm phách (8 phách = 1 hợp âm ở nhịp calm)
  let lastNote = 2;   // vị trí giai điệu trong âm giai
  let playing = false;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // tiếng vang nhẹ cho cảm giác mặt hồ rộng
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
    fxBus = ctx.createGain();
    fxBus.connect(master);
    fxBus.connect(delay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    padBus = ctx.createGain();
    padBus.connect(lp).connect(master);
    water = makeWater();
    return true;
  }

  // Tiếng nước: nhiễu trắng lọc thấp, âm lượng lên xuống chậm như sóng.
  function makeWater() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(master);
    src.start();
    lfo.start();
    return g;
  }

  function tone(freq, t, dur, { type = 'triangle', gain = 0.08, bus = fxBus, attack = 0.01, release = 0.25, detune = 0 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function drum(t, kind) {
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.2);
    } else {
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.value = kind === 'snare' ? 0.12 : 0.05;
      s.connect(f).connect(g).connect(master);
      s.start(t);
    }
  }

  // Một phách (nốt móc đơn): hợp âm đổi mỗi 8 phách, giai điệu đi từng bậc trong âm giai ngũ cung.
  function scheduleBeat(t) {
    const m = MOODS[mood];
    const beat = 60 / m.bpm / 2;
    const bar = Math.floor(step / 8) % CHORDS.length;
    const chord = CHORDS[bar];
    const inBar = step % 8;
    if (inBar === 0) {
      const len = beat * 8;
      chord.slice(1).forEach((n, i) => tone(midi(n), t, len, { type: 'sine', gain: m.padGain, bus: padBus, attack: 0.6, release: 0.8, detune: i * 4 - 4 }));
      tone(midi(chord[0]), t, len * 0.9, { type: 'triangle', gain: 0.06, bus: padBus, attack: 0.05, release: 0.6 });
    }
    if (mood === 'fight' && inBar % 2 === 0) tone(midi(chord[0] + (inBar === 4 ? 7 : 0)), t, beat * 1.6, { type: 'triangle', gain: 0.07, bus: padBus, release: 0.1 });
    // giai điệu
    if (Math.random() < m.melodyChance && (mood === 'fight' || inBar % 2 === 0 || Math.random() < 0.3)) {
      lastNote = Math.max(0, Math.min(9, lastNote + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      const deg = PENTA[lastNote % 5] + 12 * Math.floor(lastNote / 5);
      const dur = beat * (mood === 'fight' ? 1.2 : 2 + Math.floor(Math.random() * 2));
      tone(midi(72 + deg), t, dur, { type: 'triangle', gain: mood === 'fight' ? 0.05 : 0.045, release: dur * 0.6 });
    }
    if (m.drums) {
      if (inBar % 4 === 0) drum(t, 'kick');
      if (inBar % 4 === 2) drum(t, 'snare');
      drum(t + beat / 2, 'hat');
    }
    step += 1;
    return beat;
  }

  function tick() {
    if (!ctx || !playing) return;
    while (nextTime < ctx.currentTime + 0.4) nextTime += scheduleBeat(nextTime);
  }

  function fadeTo(v, sec = 1.2) {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(v, now + sec);
  }

  function start() {
    if (!enabled || playing || !init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    playing = true;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 100);
    tick();
    water.gain.setTargetAtTime(MOODS[mood].water, ctx.currentTime, 1);
    fadeTo(volume * 0.9, 2);
  }
  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    fadeTo(0, 0.6);
    if (water) water.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (playing) ctx.resume().catch(() => {});
  });

  return {
    // Gọi trong sự kiện bấm/chạm đầu tiên (trình duyệt chặn tự phát nhạc).
    unlock() { if (enabled && !playing) start(); },
    setEnabled(on) { enabled = !!on; if (enabled) start(); else stop(); },
    setVolume(v) { volume = Math.max(0, Math.min(1, Number(v) || 0)); if (playing) fadeTo(volume * 0.9, 0.3); },
    setMood(m) {
      if (!MOODS[m] || m === mood) return;
      mood = m;
      if (playing) { step = Math.ceil(step / 8) * 8; water.gain.setTargetAtTime(MOODS[m].water, ctx.currentTime, 1); }
    },
    get playing() { return playing; },
    get mood() { return mood; },
  };
}
