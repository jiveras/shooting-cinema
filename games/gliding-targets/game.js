// Glidande mål – skjut på måltavlor som glider över skärmen.
//
// Spelet reagerar på vanliga musklick, så det fungerar med mus, och med
// laser-mouse (lasern blir ett klick).
//
// Designregler för projektor + webbkamera:
//  - mörk bakgrund, dova mål i blågrå toner med LÅG röd kanal
//  - inga små ljusa prickar (kulhål ritas mörka) – annars kan kameran
//    förväxla grafiken med laserpricken.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ROUND_SECONDS = 60;

  const C = {
    bg: '#06080b',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    // Måltavlans band, utifrån och in
    bands: ['#182a37', '#213849', '#182a37', '#213849', '#2a4a60', '#386582'],
    ring: '#355c74',
    hit: [70, 170, 120], // dov grön
    miss: [110, 122, 134],
    hole: '#05080a',
  };

  // Ringvärden: radie som andel av måltavlan → poäng
  const RINGS = [
    [0.15, 10],
    [0.3, 9],
    [0.45, 8],
    [0.6, 7],
    [0.8, 6],
    [1.0, 5],
  ];

  const MODES = {
    easy: { label: 'Lätt', sub: 'Långsamma, stora mål', kind: 'glide', speed: [110, 170], radius: 95, max: 2, spawn: [1.3, 2.1], wobble: 0 },
    medium: { label: 'Medel', sub: 'Snabbare och mindre', kind: 'glide', speed: [180, 260], radius: 72, max: 3, spawn: [0.9, 1.5], wobble: 0 },
    hard: { label: 'Svår', sub: 'Små mål som slingrar', kind: 'glide', speed: [260, 380], radius: 52, max: 4, spawn: [0.6, 1.1], wobble: 70 },
    popup: { label: 'Fasta mål', sub: 'Dyker upp – försvinner', kind: 'popup', radius: 70, life: [1.5, 2.5], max: 2, spawn: [0.6, 1.2] },
  };
  const MODE_ORDER = ['easy', 'medium', 'hard', 'popup'];

  // ---------- Hjälpare ----------

  let W = 0, H = 0, S = 1;
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H) / 1080;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignorera */ } },
  };
  const bestKey = (m) => `gliding-targets:best:${m}`;
  const getBest = (m) => Number(store.get(bestKey(m)) || 0);

  function font(size, weight = 500) {
    return `${weight} ${Math.round(size * S)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  function text(str, x, y, size, color, align = 'center', weight = 500) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

  // ---------- Ljud ----------

  let audio = null;
  function ac() {
    if (!audio) audio = new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  function beep(freq, dur, { type = 'sine', gain = 0.15, at = 0 } = {}) {
    try {
      const a = ac();
      const t = a.currentTime + at;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* inget ljud */ }
  }
  const sfx = {
    hit: (pts) => { beep(380 + pts * 55, 0.12, { type: 'triangle', gain: 0.2 }); if (pts === 10) beep(1500, 0.18, { at: 0.06, gain: 0.12 }); },
    miss: () => beep(110, 0.1, { type: 'square', gain: 0.05 }),
    escape: () => beep(200, 0.15, { type: 'sine', gain: 0.06 }),
    tick: () => beep(520, 0.1),
    go: () => beep(880, 0.25, { gain: 0.2 }),
    end: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { at: i * 0.11 })),
    select: () => beep(660, 0.1),
  };

  // ---------- Spelets tillstånd ----------

  const game = {
    scene: 'menu', // 'menu' | 'countdown' | 'play' | 'results'
    mode: 'easy',
    targets: [],
    effects: [],
    holes: [], // missade skott (mörka märken på bakgrunden)
    stats: null,
    timeLeft: ROUND_SECONDS,
    spawnIn: 0,
    countdown: 0,
    lastTick: 0,
    buttons: [],
    newBest: false,
    hover: null,
  };

  function newStats() {
    return { score: 0, hits: 0, shots: 0, escaped: 0, streak: 0, bestStreak: 0, rings: {} };
  }

  function startRound(mode) {
    game.mode = mode;
    game.scene = 'countdown';
    game.countdown = 3;
    game.lastTick = 4;
    game.targets = [];
    game.effects = [];
    game.holes = [];
    game.stats = newStats();
    game.timeLeft = ROUND_SECONDS;
    game.spawnIn = 0.3;
  }

  function endRound() {
    game.scene = 'results';
    const best = getBest(game.mode);
    game.newBest = game.stats.score > best;
    if (game.newBest) store.set(bestKey(game.mode), String(game.stats.score));
    sfx.end();
  }

  function toMenu() {
    game.scene = 'menu';
    game.targets = [];
    game.effects = [];
    game.holes = [];
  }

  // ---------- Mål ----------

  function spawnTarget() {
    const m = MODES[game.mode];
    const r = m.radius * S;
    const top = 120 * S + r; // under poängraden
    const bottom = H - r - 20 * S;

    if (m.kind === 'glide') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const wob = m.wobble * S; // håll hela slingret inom skärmen
      game.targets.push({
        kind: 'glide',
        x: dir > 0 ? -r : W + r,
        y0: rand(top + wob, Math.max(top + wob, bottom - wob)),
        y: 0,
        r,
        vx: dir * rand(m.speed[0], m.speed[1]) * S,
        wobble: m.wobble * S,
        freq: rand(1.2, 2.4),
        phase: rand(0, Math.PI * 2),
        age: 0,
        holes: [],
      });
    } else {
      // Fasta mål: slumpa plats som inte överlappar andra
      let x, y, ok = false;
      for (let i = 0; i < 30 && !ok; i++) {
        x = rand(r + 20 * S, W - r - 20 * S);
        y = rand(top, bottom);
        ok = game.targets.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r + 30 * S);
      }
      game.targets.push({ kind: 'popup', x, y, r, age: 0, life: rand(m.life[0], m.life[1]), holes: [] });
    }
  }

  function updateTargets(dt) {
    for (const t of game.targets) {
      t.age += dt;
      if (t.kind === 'glide') {
        t.x += t.vx * dt;
        t.y = t.y0 + Math.sin(t.age * t.freq + t.phase) * t.wobble;
        t.gone = (t.vx > 0 && t.x - t.r > W) || (t.vx < 0 && t.x + t.r < 0);
      } else {
        t.gone = t.age >= t.life;
      }
      if (t.gone) {
        if (t.kind === 'popup') addEffect({ type: 'escape', x: t.x, y: t.y, life: 0.8 });
        game.stats.escaped++;
        game.stats.streak = 0;
        sfx.escape();
      }
    }
    game.targets = game.targets.filter((t) => !t.gone);
  }

  function targetScale(t) {
    if (t.kind !== 'popup') return 1;
    const inT = Math.min(1, t.age / 0.15);
    return 0.3 + 0.7 * (1 - Math.pow(1 - inT, 3));
  }

  function targetAlpha(t) {
    if (t.kind !== 'popup') return 1;
    const left = t.life - t.age;
    return left < 0.35 ? Math.max(0, left / 0.35) : 1;
  }

  function drawTarget(t) {
    const s = targetScale(t);
    const r = t.r * s;
    ctx.save();
    ctx.globalAlpha = targetAlpha(t);
    // Band utifrån och in
    for (let i = 0; i < RINGS.length; i++) {
      const frac = RINGS[RINGS.length - 1 - i][0];
      ctx.fillStyle = C.bands[i];
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * frac, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tunna ringlinjer
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = Math.max(1, 1.5 * S);
    for (const [frac] of RINGS) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Effekter ----------

  function addEffect(e) {
    game.effects.push({ ...e, age: 0 });
  }

  function updateEffects(dt) {
    for (const e of game.effects) e.age += dt;
    game.effects = game.effects.filter((e) => e.age < e.life);
    // Missmärken bleknar efter några sekunder
    for (const h of game.holes) h.age += dt;
    game.holes = game.holes.filter((h) => h.age < 4);
  }

  function drawEffects() {
    for (const e of game.effects) {
      const p = e.age / e.life;
      const a = 1 - p;
      if (e.type === 'hit') {
        ctx.strokeStyle = rgba(C.hit, a * 0.8);
        ctx.lineWidth = 3 * S;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (0.6 + p * 0.9), 0, Math.PI * 2);
        ctx.stroke();
        // Mörkt kulhål i mitten av träffen
        ctx.fillStyle = `rgba(5, 8, 10, ${a})`;
        ctx.beginPath();
        ctx.arc(e.hx, e.hy, 6 * S, 0, Math.PI * 2);
        ctx.fill();
        text(`+${e.pts}`, e.x, e.y - e.r * 0.4 - p * 60 * S, 44, rgba(C.hit, a), 'center', 700);
      } else if (e.type === 'escape') {
        text('Missat', e.x, e.y - p * 30 * S, 26, rgba(C.miss, a * 0.6));
      }
    }
    // Missade skott: mörka hål med svag ring
    for (const h of game.holes) {
      const a = Math.max(0, 1 - h.age / 4);
      ctx.fillStyle = `rgba(2, 3, 4, ${a})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 7 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(C.miss, a * 0.35);
      ctx.lineWidth = 1.5 * S;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 11 * S, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- Skott ----------

  function shoot(x, y) {
    if (game.scene === 'menu' || game.scene === 'results') {
      const b = game.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (!b) return;
      sfx.select();
      if (b.id === 'menu') toMenu();
      else if (b.id === 'again') startRound(game.mode);
      else startRound(b.id);
      return;
    }
    if (game.scene !== 'play') return;

    const st = game.stats;
    st.shots++;

    // Översta (senast skapade) målet först
    for (let i = game.targets.length - 1; i >= 0; i--) {
      const t = game.targets[i];
      const r = t.r * targetScale(t);
      const d = Math.hypot(x - t.x, y - t.y) / r;
      if (d > 1) continue;
      const pts = RINGS.find(([frac]) => d <= frac)[1];
      st.score += pts;
      st.hits++;
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      st.rings[pts] = (st.rings[pts] || 0) + 1;
      game.targets.splice(i, 1);
      addEffect({ type: 'hit', x: t.x, y: t.y, r: t.r, hx: x, hy: y, pts, life: 0.7 });
      sfx.hit(pts);
      return;
    }

    st.streak = 0;
    game.holes.push({ x, y, age: 0 });
    sfx.miss();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    shoot(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    game.hover = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (game.scene === 'menu') window.close();
      else toMenu();
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  // ---------- Knappar (meny/resultat) ----------

  function drawButton(b) {
    const hot = game.hover && game.hover.x >= b.x && game.hover.x <= b.x + b.w && game.hover.y >= b.y && game.hover.y <= b.y + b.h;
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = hot ? C.panelHot : C.panelEdge;
    ctx.lineWidth = 2 * S;
    const r = 14 * S;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, r);
    ctx.fill();
    ctx.stroke();
    const cx = b.x + b.w / 2;
    text(b.label, cx, b.y + b.h * (b.sub ? 0.36 : 0.5), 40, C.text, 'center', 600);
    if (b.sub) text(b.sub, cx, b.y + b.h * 0.6, 22, C.dim);
    if (b.extra) text(b.extra, cx, b.y + b.h * 0.8, 20, C.dim);
  }

  function layoutMenu() {
    const bw = Math.min(380 * S, (W - 120 * S) / 2);
    const bh = 190 * S;
    const gap = 32 * S;
    const x0 = W / 2 - bw - gap / 2;
    const y0 = H * 0.36;
    game.buttons = MODE_ORDER.map((id, i) => {
      const best = getBest(id);
      return {
        id,
        label: MODES[id].label,
        sub: MODES[id].sub,
        extra: best ? `Rekord: ${best}` : 'Inget rekord än',
        x: x0 + (i % 2) * (bw + gap),
        y: y0 + Math.floor(i / 2) * (bh + gap),
        w: bw,
        h: bh,
      };
    });
  }

  function layoutResults() {
    const bw = 300 * S;
    const bh = 110 * S;
    const gap = 32 * S;
    const y = H * 0.74;
    game.buttons = [
      { id: 'again', label: 'Spela igen', x: W / 2 - bw - gap / 2, y, w: bw, h: bh },
      { id: 'menu', label: 'Meny', x: W / 2 + gap / 2, y, w: bw, h: bh },
    ];
  }

  // ---------- Scener ----------

  function drawMenu() {
    layoutMenu();
    text('Glidande mål', W / 2, H * 0.14, 84, C.text, 'center', 700);
    text('Skjut på ett val för att börja', W / 2, H * 0.14 + 80 * S, 28, C.dim);
    game.buttons.forEach(drawButton);
    text('60 sekunder per runda · Esc avslutar · F helskärm', W / 2, H - 40 * S, 20, C.faint);
  }

  function drawHud() {
    const st = game.stats;
    const y = 54 * S;
    const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
    text(`${Math.ceil(game.timeLeft)} s`, 40 * S, y, 40, game.timeLeft < 10 ? C.text : C.dim, 'left', 600);
    text(`${st.score}`, W / 2, y, 56, C.text, 'center', 700);
    text(`${st.hits}/${st.shots} · ${acc} %`, W - 40 * S, y, 32, C.dim, 'right');
    // Tidslinje
    ctx.fillStyle = C.faint;
    ctx.fillRect(0, 100 * S, W * (game.timeLeft / ROUND_SECONDS), 3 * S);
  }

  function drawCountdown() {
    drawHud();
    const n = Math.ceil(game.countdown);
    text(n > 0 ? String(n) : 'Kör!', W / 2, H / 2, 220, C.dim, 'center', 700);
    text(MODES[game.mode].label, W / 2, H / 2 + 160 * S, 32, C.faint);
  }

  function drawPlay() {
    for (const t of game.targets) drawTarget(t);
    drawEffects();
    drawHud();
  }

  function drawResults() {
    layoutResults();
    const st = game.stats;
    const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
    const avg = st.hits ? (st.score / st.hits).toFixed(1) : '–';
    text(MODES[game.mode].label, W / 2, H * 0.12, 32, C.dim);
    text(`${st.score} poäng`, W / 2, H * 0.24, 110, C.text, 'center', 700);
    text(game.newBest ? 'Nytt rekord!' : `Rekord: ${getBest(game.mode)}`, W / 2, H * 0.24 + 90 * S, 30, game.newBest ? rgba(C.hit, 1) : C.dim, 'center', 600);

    const rows = [
      ['Träffar', `${st.hits} av ${st.shots} skott (${acc} %)`],
      ['Snitt per träff', `${avg}`],
      ['Längsta träffserie', `${st.bestStreak}`],
      ['Mål som slapp undan', `${st.escaped}`],
      ['Tior / nior / åttor', `${st.rings[10] || 0} / ${st.rings[9] || 0} / ${st.rings[8] || 0}`],
    ];
    const y0 = H * 0.44;
    rows.forEach(([k, v], i) => {
      const y = y0 + i * 44 * S;
      text(k, W / 2 - 20 * S, y, 28, C.dim, 'right');
      text(v, W / 2 + 20 * S, y, 28, C.text, 'left', 600);
    });
    game.buttons.forEach(drawButton);
  }

  // ---------- Huvudloop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (game.scene === 'countdown') {
      game.countdown -= dt;
      const n = Math.ceil(game.countdown);
      if (n < game.lastTick) {
        game.lastTick = n;
        if (n > 0) sfx.tick();
      }
      if (game.countdown <= -0.4) {
        game.scene = 'play';
        sfx.go();
      }
    } else if (game.scene === 'play') {
      game.timeLeft -= dt;
      game.spawnIn -= dt;
      const m = MODES[game.mode];
      if (game.spawnIn <= 0 && game.targets.length < m.max) {
        spawnTarget();
        game.spawnIn = rand(m.spawn[0], m.spawn[1]);
      }
      updateTargets(dt);
      updateEffects(dt);
      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        endRound();
      }
    }

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (game.scene === 'menu') drawMenu();
    else if (game.scene === 'countdown') drawCountdown();
    else if (game.scene === 'play') drawPlay();
    else drawResults();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // För automatiska tester
  window.__game = game;
})();
