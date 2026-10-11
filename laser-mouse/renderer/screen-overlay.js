// Överläggsfönstret som täcker vald skärm.
//
// OBS: allt ritas i blå/cyan/grön ton med LÅG röd kanal, och som tunna
// linjer/ringar. Då kan kameran inte förväxla grafiken med laserpricken.

(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const CYAN = '#3fb6ff';
  const GREEN = '#2fd27a';
  const DIM = 'rgba(63, 182, 255, 0.35)';
  const SHOT_LIFETIME = 2500;

  const state = {
    mode: 'idle', // 'idle' | 'calibrate' | 'test' | 'zero'
    zero: null, // { target, hits, total, result }
    target: null, // { x, y, index, total, progress, waiting }
    captured: [], // redan registrerade punkter
    pointer: null, // { x, y } normaliserat, eller null
    shots: [],
    flashUntil: 0,
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
    ctx.fillStyle = 'rgba(5, 8, 14, 0.92)';
    ctx.fillRect(0, 0, W, H);
    // Ram som visar vilken skärm som kalibreras
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    for (const p of state.captured) {
      ring(p.x * W, p.y * H, 14, GREEN, 2);
      cross(p.x * W, p.y * H, 4, 10, GREEN, 2);
    }

    const t = state.target;
    if (t) {
      const x = t.x * W;
      const y = t.y * H;
      const flash = now < state.flashUntil;
      ring(x, y, 42, flash ? GREEN : CYAN, 3);
      ring(x, y, 14, flash ? GREEN : CYAN, 2);
      cross(x, y, 20, 70, flash ? GREEN : CYAN, 2);

      // Framstegsbåge
      if (t.progress > 0) {
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, 54, -Math.PI / 2, -Math.PI / 2 + t.progress * Math.PI * 2);
        ctx.stroke();
      }

      // Text nära punkten men in mot mitten
      const ty = t.y < 0.5 ? y + 110 : y - 110;
      const tx = Math.min(Math.max(x, 220), W - 220);
      label(`Punkt ${t.index + 1} av ${t.total}`, tx, ty, 24);
      label(
        t.waiting ? 'Flytta lasern till nästa punkt' : 'Sikta mitt i ringen och håll stilla',
        tx, ty + 32, 18, DIM
      );
    }
    if (state.text) label(state.text, W / 2, H / 2, 28);
  }

  function drawTest(W, H, now) {
    // Tunn ram så man ser vilken skärm som är aktiv
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

  // Inskjutning: mål i mitten, träffarna markeras. Efteråt visas både
  // var lasern träffade (grått) och var träffarna hamnar korrigerade (grönt).
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
      const c = res ? 'rgba(120, 140, 160, 0.6)' : CYAN;
      ring(x, y, 11, c, 2);
      label(String(i + 1), x + 20, y - 16, 16, c);
      if (res) {
        const cx = (h.x - res.dx) * W;
        const cy = (h.y - res.dy) * H;
        ring(cx, cy, 11, GREEN, 2.5);
      }
    });

    if (res) {
      label('Inskjutning klar', W / 2, H * 0.12, 34);
      label(res.text, W / 2, H * 0.12 + 44, 22, DIM);
      label(`Träffbild: ${res.spreadPx} px · grått = där lasern träffade, grönt = korrigerat`, W / 2, H * 0.88, 18, DIM);
    } else {
      label('Inskjutning', W / 2, H * 0.12, 34);
      label(`Sikta med kornet mitt på målet och skjut · skott ${z.hits.length} av ${z.total}`, W / 2, H * 0.12 + 44, 22, DIM);
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
