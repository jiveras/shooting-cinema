// The overlay window that covers the chosen display.
//
// NOTE: everything is drawn in blue/cyan/green with a LOW red channel, and as
// thin lines/rings. That way the camera can never mistake the graphics for
// the laser dot.
//
// The language is sent from the main window as { type: 'lang', lang }.

(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  i18n.init(null);

  const CYAN = '#3fb6ff';
  const GREEN = '#2fd27a';
  const DIM = 'rgba(63, 182, 255, 0.35)';
  const SHOT_LIFETIME = 2500;
  const ZERO_HIT_LIFETIME = 2500; // ms a zeroing hit stays visible before the result

  const state = {
    mode: 'idle', // 'idle' | 'calibrate' | 'test' | 'zero'
    zero: null, // { target, hits, total, result }
    target: null, // { x, y, index, total, progress, waiting }
    captured: [], // points already captured
    pointer: null, // { x, y } normalized, or null
    shots: [],
    flashUntil: 0,
    zeroTimes: [], // when each zeroing hit arrived
    text: '',
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  window.overlayBridge.onMessage((msg) => {
    switch (msg.type) {
      case 'lang':
        i18n.set(msg.lang);
        break;
      case 'mode':
        state.mode = msg.mode;
        state.pointer = null;
        state.shots = [];
        if (msg.mode !== 'calibrate') state.target = null;
        break;
      case 'target':
        state.target = msg;
        state.captured = msg.captured || [];
        break;
      case 'flash':
        state.flashUntil = performance.now() + 250;
        break;
      case 'pointer':
        state.pointer = msg.found ? { x: msg.x, y: msg.y } : null;
        break;
      case 'shot':
        state.shots.push({ x: msg.x, y: msg.y, t: performance.now() });
        if (state.shots.length > 30) state.shots.shift();
        break;
      case 'text':
        state.text = msg.text;
        break;
      case 'zero':
        state.zero = msg;
        if (msg.hits.length < state.zeroTimes.length) state.zeroTimes = [];
        while (state.zeroTimes.length < msg.hits.length) state.zeroTimes.push(performance.now());
        if (msg.hits.length) state.flashUntil = performance.now() + 200;
        break;
    }
  });

  function ring(x, y, r, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function cross(x, y, inner, outer, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x - outer, y); ctx.lineTo(x - inner, y);
    ctx.moveTo(x + inner, y); ctx.lineTo(x + outer, y);
    ctx.moveTo(x, y - outer); ctx.lineTo(x, y - inner);
    ctx.moveTo(x, y + inner); ctx.lineTo(x, y + outer);
    ctx.stroke();
  }

  function label(text, x, y, size = 22, color = CYAN) {
    ctx.font = `500 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function drawCalibrate(W, H, now) {
    // Fully opaque so nothing behind (menu bar, desktop) shines through
    ctx.fillStyle = 'rgb(5, 8, 14)';
    ctx.fillRect(0, 0, W, H);

    for (const p of state.captured) {
      ring(p.x * W, p.y * H, 14, GREEN, 2);
      cross(p.x * W, p.y * H, 4, 10, GREEN, 2);
    }

    const tg = state.target;
    if (tg) {
      const x = tg.x * W;
      const y = tg.y * H;
      const flash = now < state.flashUntil;
      ring(x, y, 42, flash ? GREEN : CYAN, 3);
      ring(x, y, 14, flash ? GREEN : CYAN, 2);
      cross(x, y, 20, 70, flash ? GREEN : CYAN, 2);

      // Progress arc
      if (tg.progress > 0) {
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, 54, -Math.PI / 2, -Math.PI / 2 + tg.progress * Math.PI * 2);
        ctx.stroke();
      }

      // Text close to the point but towards the centre of the screen
      const ty = tg.y < 0.5 ? y + 110 : y - 110;
      const tx = Math.min(Math.max(x, 260), W - 260);
      label(t('overlay.point', { n: tg.index + 1, total: tg.total }), tx, ty, 24);
      label(t(tg.waiting ? 'overlay.move' : 'overlay.aim'), tx, ty + 32, 18, DIM);
    }
    if (state.text) label(state.text, W / 2, H / 2, 28);
  }

  function drawTest(W, H, now) {
    // Thin frame so you can see which display is active
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

    for (const s of state.shots) {
      const age = now - s.t;
      if (age > SHOT_LIFETIME) continue;
      const a = 1 - age / SHOT_LIFETIME;
      ring(s.x * W, s.y * H, 12 + (1 - a) * 30, `rgba(47, 210, 122, ${a})`, 3);
    }

    if (state.pointer) {
      const x = state.pointer.x * W;
      const y = state.pointer.y * H;
      ring(x, y, 22, CYAN, 2);
      cross(x, y, 8, 36, CYAN, 2);
    }
  }

  // Zeroing: a target in the centre with the hits marked. Afterwards it shows
  // both where the laser hit (grey) and where the hits land corrected (green).
  function drawZero(W, H, now) {
    ctx.fillStyle = 'rgba(5, 8, 14, 0.92)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    const z = state.zero;
    if (!z) return;
    const tx = z.target.x * W;
    const ty = z.target.y * H;
    const flash = now < state.flashUntil;
    const col = flash ? GREEN : CYAN;
    for (const r of [140, 90, 40]) ring(tx, ty, r, col, 2);
    cross(tx, ty, 12, 190, col, 1.5);

    const res = z.result;
    z.hits.forEach((h, i) => {
      const x = h.x * W;
      const y = h.y * H;
      // While shooting, a hit fades away so it cannot drown out the next one
      const a = res ? 1 : Math.max(0, 1 - (now - (state.zeroTimes[i] || now)) / ZERO_HIT_LIFETIME);
      ctx.globalAlpha = a;
      const c = res ? 'rgba(120, 140, 160, 0.6)' : CYAN;
      ring(x, y, 11, c, 2);
      label(String(i + 1), x + 20, y - 16, 16, c);
      ctx.globalAlpha = 1;
      if (res) {
        const cx = (h.x - res.dx) * W;
        const cy = (h.y - res.dy) * H;
        ring(cx, cy, 11, GREEN, 2.5);
      }
    });

    if (res) {
      label(t('overlay.zeroDone'), W / 2, H * 0.12, 34);
      label(res.text, W / 2, H * 0.12 + 44, 22, DIM);
      label(t('overlay.zeroLegend', { px: res.spreadPx }), W / 2, H * 0.88, 18, DIM);
    } else {
      label(t('overlay.zeroTitle'), W / 2, H * 0.12, 34);
      label(t('overlay.zeroAim', { n: z.hits.length, total: z.total }), W / 2, H * 0.12 + 44, 22, DIM);
    }
  }

  function frame() {
    const W = innerWidth;
    const H = innerHeight;
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    if (state.mode === 'calibrate') drawCalibrate(W, H, now);
    else if (state.mode === 'test') drawTest(W, H, now);
    else if (state.mode === 'zero') drawZero(W, H, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
