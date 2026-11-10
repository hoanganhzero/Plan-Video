// Cảnh câu cá vẽ bằng canvas: bầu trời, mặt nước, cầu gỗ, người câu, dây, phao và bóng cá.
// Các pha: idle → cast → wait → bite → reel (kéo được) | escape (cá thoát) → idle

const CAST_MS = 700;
const REEL_MS = 1000;

export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let zone = null;
  let phase = 'idle';
  let phaseStart = 0;
  let catchEmoji = '🐟';
  let catchColor = '#fff';
  const shadows = Array.from({ length: 6 }, (_, i) => ({
    x: Math.random(), y: 0.25 + Math.random() * 0.65, size: 0.6 + Math.random() * 0.8,
    speed: (0.02 + Math.random() * 0.04) * (i % 2 ? 1 : -1),
  }));
  const ripples = [];
  const sparkles = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6 }));

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const geo = () => {
    const sea = H * 0.38;
    const dockW = Math.max(90, W * 0.2);
    return {
      sea, dockW,
      hand: { x: dockW * 0.62, y: sea - 38 },
      tip: { x: dockW + Math.min(110, W * 0.14), y: Math.max(14, sea - 95) },
      target: { x: W * 0.64, y: sea + (H - sea) * 0.28 },
    };
  };

  function setPhase(p) { phase = p; phaseStart = performance.now(); }

  function addRipple(x, y, strength = 1) { ripples.push({ x, y, t: performance.now(), strength }); }

  function drawBackground(t, g) {
    const [s1, s2] = zone?.sky || ['#bfe6ff', '#e9f7ff'];
    const [w1, w2] = zone?.water || ['#4fa3c7', '#1f5f7a'];
    let grad = ctx.createLinearGradient(0, 0, 0, g.sea);
    grad.addColorStop(0, s1); grad.addColorStop(1, s2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, g.sea);

    if (zone?.id === 'abyss') {
      for (const s of sparkles) {
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t / 600 + s.p);
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x * W, s.y * g.sea, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
      ctx.beginPath(); ctx.arc(W * 0.86, g.sea * 0.32, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const cx = ((t / 80) % (W + 200)) - 100;
      for (const [dx, dy, r] of [[0, 0, 16], [18, -6, 20], [38, 0, 15]]) {
        ctx.beginPath(); ctx.arc(cx + dx, g.sea * 0.25 + dy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (zone?.id === 'lake' || zone?.id === 'river') {
      ctx.fillStyle = zone.id === 'lake' ? 'rgba(80, 90, 140, 0.45)' : 'rgba(90, 140, 70, 0.45)';
      ctx.beginPath(); ctx.moveTo(W * 0.3, g.sea);
      ctx.lineTo(W * 0.5, g.sea * (zone.id === 'lake' ? 0.35 : 0.75));
      ctx.lineTo(W * 0.7, g.sea * (zone.id === 'lake' ? 0.55 : 0.85));
      ctx.lineTo(W * 0.85, g.sea * (zone.id === 'lake' ? 0.3 : 0.7));
      ctx.lineTo(W, g.sea); ctx.closePath(); ctx.fill();
    }

    grad = ctx.createLinearGradient(0, g.sea, 0, H);
    grad.addColorStop(0, w1); grad.addColorStop(1, w2);
    ctx.fillStyle = grad; ctx.fillRect(0, g.sea, W, H - g.sea);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = g.sea + 14 + i * ((H - g.sea) / 5);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin(x / 40 + t / 700 + i) * 3;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    for (const s of shadows) {
      s.x += s.speed / 60;
      if (s.x > 1.15) s.x = -0.15;
      if (s.x < -0.15) s.x = 1.15;
      const x = s.x * W;
      const y = g.sea + s.y * (H - g.sea);
      const r = 14 * s.size;
      ctx.fillStyle = 'rgba(0, 20, 40, 0.28)';
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      const dir = Math.sign(s.speed);
      ctx.beginPath();
      ctx.moveTo(x - dir * r * 1.4, y);
      ctx.lineTo(x - dir * r * 2.3, y - r * 0.6);
      ctx.lineTo(x - dir * r * 2.3, y + r * 0.6);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawDock(g) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, g.sea - 12, g.dockW, 14);
    ctx.fillStyle = '#6b4220';
    for (let x = 10; x < g.dockW; x += 34) ctx.fillRect(x, g.sea, 8, 40);
    ctx.font = '44px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('🧑', g.dockW * 0.45, g.sea - 10);
    ctx.strokeStyle = '#5b3a1a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.hand.x, g.hand.y); ctx.lineTo(g.tip.x, g.tip.y); ctx.stroke();
  }

  function bobberPos(t, g) {
    const k = Math.min(1, (t - phaseStart) / (phase === 'cast' ? CAST_MS : REEL_MS));
    switch (phase) {
      case 'cast': {
        const x = g.tip.x + (g.target.x - g.tip.x) * k;
        const y = g.tip.y + (g.target.y - g.tip.y) * k - Math.sin(k * Math.PI) * 70;
        return { x, y, inWater: k >= 1 };
      }
      case 'wait':
        return { x: g.target.x, y: g.target.y + Math.sin(t / 300) * 2, inWater: true };
      case 'bite':
        return { x: g.target.x + Math.sin(t / 25) * 2, y: g.target.y + 7 + Math.sin(t / 40) * 4, inWater: true };
      case 'reel':
      case 'escape': {
        const e = 1 - (1 - k) ** 2;
        return { x: g.target.x + (g.tip.x - g.target.x) * e, y: g.target.y + (g.tip.y + 20 - g.target.y) * e, inWater: false, k };
      }
      default:
        return null;
    }
  }

  function drawLine(t, g) {
    const b = bobberPos(t, g);
    if (!b) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.tip.x, g.tip.y); ctx.lineTo(g.tip.x, g.tip.y + 40); ctx.stroke();
      drawBobber(g.tip.x, g.tip.y + 44);
      return;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.tip.x, g.tip.y);
    const sag = phase === 'bite' ? 0 : 18;
    ctx.quadraticCurveTo((g.tip.x + b.x) / 2, (g.tip.y + b.y) / 2 + sag, b.x, b.y);
    ctx.stroke();

    if (phase === 'reel') {
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.save();
      ctx.translate(b.x, b.y + 6);
      ctx.rotate(Math.sin(t / 60) * 0.3);
      ctx.shadowColor = catchColor; ctx.shadowBlur = 18;
      ctx.fillText(catchEmoji, 0, 0);
      ctx.restore();
    } else {
      drawBobber(b.x, b.y);
    }
    if (phase === 'escape' && b.k < 0.6) {
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText('💨', g.target.x + 30, g.target.y - 10 - b.k * 40);
    }
    if (phase === 'bite') {
      ctx.font = 'bold 30px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffdd00';
      ctx.fillText('!', b.x, b.y - 26 + Math.sin(t / 80) * 3);
      if (Math.random() < 0.15) addRipple(b.x, b.y + 4, 1.4);
    }
    if (phase === 'wait' && Math.random() < 0.01) addRipple(b.x, b.y + 4, 0.6);
  }

  function drawBobber(x, y) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(x, y, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
  }

  function drawRipples(t) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const age = (t - r.t) / 1000;
      if (age > 1.2) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 1.2) * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 8 + age * 40 * r.strength, 3 + age * 12 * r.strength, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  let lastPhase = phase;
  function frame(t) {
    if (!W || canvas.width === 0) resize();
    const g = geo();
    ctx.clearRect(0, 0, W, H);
    drawBackground(t, g);
    drawRipples(t);
    drawDock(g);
    drawLine(t, g);
    if (phase === 'cast' && t - phaseStart >= CAST_MS) {
      addRipple(g.target.x, g.target.y + 4, 1.2);
      setPhase('wait');
    }
    if ((phase === 'reel' || phase === 'escape') && t - phaseStart >= REEL_MS + 200) setPhase('idle');
    if (phase !== lastPhase && phase === 'bite') addRipple(g.target.x, g.target.y + 4, 2);
    lastPhase = phase;
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setZone(z) { zone = z; },
    cast() { setPhase('cast'); },
    bite() { setPhase('bite'); },
    reel(emoji, color) { catchEmoji = emoji; catchColor = color; setPhase('reel'); },
    escape() { const g = geo(); addRipple(g.target.x, g.target.y + 4, 2.5); setPhase('escape'); },
    get phase() { return phase; },
  };
}
