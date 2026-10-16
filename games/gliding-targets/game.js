// Gliding Targets – shoot at targets that glide across the screen.
//
// The game reacts to ordinary mouse clicks, so it works with a mouse as well
// as with Laser Mouse (where the laser becomes a click).
//
// Design rules for projector + webcam:
//  - dark background, muted blue-grey targets with a LOW red channel
//  - no small bright dots (bullet holes are drawn dark) – otherwise the
//    camera could mistake the graphics for the laser dot
//  - a dark bullseye, so the laser dot stands out best exactly there
//
// Language: Swedish by default, English available. The language comes from
// ?lang=sv|en (set by Laser Mouse), otherwise from the last choice in the menu.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ROUND_SECONDS = 60;

  // ---------- Texts ----------

  const STRINGS = {
    sv: {
      title: 'Glidande mål',
      subtitle: 'Skjut på ett val för att börja',
      footer: '60 sekunder per runda · Esc avslutar · F helskärm',
      'mode.easy': 'Lätt',
      'mode.easy.sub': 'Långsamma, stora mål',
      'mode.medium': 'Medel',
      'mode.medium.sub': 'Snabbare och mindre',
      'mode.hard': 'Svår',
      'mode.hard.sub': 'Små mål som slingrar',
      'mode.popup': 'Fasta mål',
      'mode.popup.sub': 'Dyker upp – försvinner',
      best: 'Rekord: {n}',
      noBest: 'Inget rekord än',
      newBest: 'Nytt rekord!',
      sound: 'Skottljud: {name}',
      soundSub: 'Skjut här för att byta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      go: 'Kör!',
      missed: 'Missat',
      points: '{n} poäng',
      'row.hits': 'Träffar',
      'row.hitsValue': '{hits} av {shots} skott ({acc} %)',
      'row.avg': 'Snitt per träff',
      'row.streak': 'Längsta träffserie',
      'row.escaped': 'Mål som slapp undan',
      'row.rings': 'Tior / nior / åttor',
      again: 'Spela igen',
      menu: 'Meny',
    },
    en: {
      title: 'Gliding Targets',
      subtitle: 'Shoot a choice to start',
      footer: '60 seconds per round · Esc quits · F full screen',
      'mode.easy': 'Easy',
      'mode.easy.sub': 'Slow, large targets',
      'mode.medium': 'Medium',
      'mode.medium.sub': 'Faster and smaller',
      'mode.hard': 'Hard',
      'mode.hard.sub': 'Small targets that weave',
      'mode.popup': 'Pop-up',
      'mode.popup.sub': 'Appear – and vanish',
      best: 'Best: {n}',
      noBest: 'No record yet',
      newBest: 'New record!',
      sound: 'Gunshot: {name}',
      soundSub: 'Shoot here to change',
      language: 'English',
      languageSub: 'Skjut för svenska',
      go: 'Go!',
      missed: 'Missed',
      points: '{n} points',
      'row.hits': 'Hits',
      'row.hitsValue': '{hits} of {shots} shots ({acc} %)',
      'row.avg': 'Average per hit',
      'row.streak': 'Longest streak',
      'row.escaped': 'Targets that got away',
      'row.rings': 'Tens / nines / eights',
      again: 'Play again',
      menu: 'Menu',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'gliding-targets:lang';
  const urlLang = new URLSearchParams(location.search).get('lang');
  let lang = STRINGS[urlLang] ? urlLang : STRINGS[store.get(LANG_KEY)] ? store.get(LANG_KEY) : 'sv';
  document.documentElement.lang = lang;

  function t(key, params) {
    let s = STRINGS[lang][key] ?? STRINGS.sv[key] ?? key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    return s;
  }

  function toggleLang() {
    lang = lang === 'sv' ? 'en' : 'sv';
    document.documentElement.lang = lang;
    document.title = t('title');
    store.set(LANG_KEY, lang);
  }
  document.title = t('title');

  // ---------- Look and rules ----------

  const C = {
    bg: '#06080b',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    // Target bands, from the outside in. The centre is the DARKEST: the detector
    // looks for a dot that is brighter than its surroundings, so a bright centre
    // would "drown" the laser dot exactly where you want to hit.
    bands: ['#1d3140', '#17293a', '#1d3140', '#14232f', '#101c26', '#0b141b'],
    ring: '#3a6178',
    hit: [70, 170, 120], // muted green
    miss: [110, 122, 134],
    hole: '#05080a',
  };

  // Ring values: radius as a fraction of the target → points
  const RINGS = [
    [0.15, 10],
    [0.3, 9],
    [0.45, 8],
    [0.6, 7],
    [0.8, 6],
    [1.0, 5],
  ];

  const MODES = {
    easy: { kind: 'glide', speed: [110, 170], radius: 95, max: 2, spawn: [1.3, 2.1], wobble: 0 },
    medium: { kind: 'glide', speed: [180, 260], radius: 72, max: 3, spawn: [0.9, 1.5], wobble: 0 },
    hard: { kind: 'glide', speed: [260, 380], radius: 52, max: 4, spawn: [0.6, 1.1], wobble: 70 },
    popup: { kind: 'popup', radius: 70, life: [1.5, 2.5], max: 2, spawn: [0.6, 1.2] },
  };
  const MODE_ORDER = ['easy', 'medium', 'hard', 'popup'];

  // ---------- Helpers ----------

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

  // ---------- Sound ----------

  let audio = null;
  function ac() {
    if (!audio) audio = new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  function beep(freq, dur, { type = 'sine', gain = 0.15, at = 0 } = {}) {
    try {
      const a = ac();
      const t0 = a.currentTime + at;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch { /* no sound */ }
  }
  // Gunshot sound (games/shared/gunshots.js). The choice is saved.
  const Gunshots = window.Gunshots;
  const guns = Gunshots ? new Gunshots(ac) : null;
  const SOUND_KEY = 'gliding-targets:shotSound';
  let shotSound = store.get(SOUND_KEY) || 'shotgun';
  const fire = () => guns && guns.play(shotSound);

  const sfx = {
    // The hit sound comes slightly after the shot so it isn't drowned out
    hit: (pts) => { beep(380 + pts * 55, 0.12, { type: 'triangle', gain: 0.2, at: 0.1 }); if (pts === 10) beep(1500, 0.18, { at: 0.16, gain: 0.12 }); },
    miss: () => {},
    escape: () => beep(200, 0.15, { type: 'sine', gain: 0.06 }),
    tick: () => beep(520, 0.1),
    go: () => beep(880, 0.25, { gain: 0.2 }),
    end: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { at: i * 0.11 })),
  };

  // ---------- Game state ----------

  const game = {
    scene: 'menu', // 'menu' | 'countdown' | 'play' | 'results'
    mode: 'easy',
    targets: [],
    effects: [],
    holes: [], // missed shots (dark marks on the background)
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

  // ---------- Targets ----------

  function spawnTarget() {
    const m = MODES[game.mode];
    const r = m.radius * S;
    const top = 120 * S + r; // below the score bar
    const bottom = H - r - 20 * S;

    if (m.kind === 'glide') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const wob = m.wobble * S; // keep the whole weave on screen
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
      // Pop-up targets: pick a spot that doesn't overlap the others
      let x, y, ok = false;
      for (let i = 0; i < 30 && !ok; i++) {
        x = rand(r + 20 * S, W - r - 20 * S);
        y = rand(top, bottom);
        ok = game.targets.every((tg) => Math.hypot(tg.x - x, tg.y - y) > tg.r + r + 30 * S);
      }
      game.targets.push({ kind: 'popup', x, y, r, age: 0, life: rand(m.life[0], m.life[1]), holes: [] });
    }
  }

  function updateTargets(dt) {
    for (const tg of game.targets) {
      tg.age += dt;
      if (tg.kind === 'glide') {
        tg.x += tg.vx * dt;
        tg.y = tg.y0 + Math.sin(tg.age * tg.freq + tg.phase) * tg.wobble;
        tg.gone = (tg.vx > 0 && tg.x - tg.r > W) || (tg.vx < 0 && tg.x + tg.r < 0);
      } else {
        tg.gone = tg.age >= tg.life;
      }
      if (tg.gone) {
        if (tg.kind === 'popup') addEffect({ type: 'escape', x: tg.x, y: tg.y, life: 0.8 });
        game.stats.escaped++;
        game.stats.streak = 0;
        sfx.escape();
      }
    }
    game.targets = game.targets.filter((tg) => !tg.gone);
  }

  function targetScale(tg) {
    if (tg.kind !== 'popup') return 1;
    const inT = Math.min(1, tg.age / 0.15);
    return 0.3 + 0.7 * (1 - Math.pow(1 - inT, 3));
  }

  function targetAlpha(tg) {
    if (tg.kind !== 'popup') return 1;
    const left = tg.life - tg.age;
    return left < 0.35 ? Math.max(0, left / 0.35) : 1;
  }

  function drawTarget(tg) {
    const s = targetScale(tg);
    const r = tg.r * s;
    ctx.save();
    ctx.globalAlpha = targetAlpha(tg);
    // Bands from the outside in
    for (let i = 0; i < RINGS.length; i++) {
      const frac = RINGS[RINGS.length - 1 - i][0];
      ctx.fillStyle = C.bands[i];
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r * frac, 0, Math.PI * 2);
      ctx.fill();
    }
    // Thin ring lines
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = Math.max(1, 1.5 * S);
    for (const [frac] of RINGS) {
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Effects ----------

  function addEffect(e) {
    game.effects.push({ ...e, age: 0 });
  }

  function updateEffects(dt) {
    for (const e of game.effects) e.age += dt;
    game.effects = game.effects.filter((e) => e.age < e.life);
    // Miss marks fade after a few seconds
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
        // Dark bullet hole where the hit landed
        ctx.fillStyle = `rgba(5, 8, 10, ${a})`;
        ctx.beginPath();
        ctx.arc(e.hx, e.hy, 6 * S, 0, Math.PI * 2);
        ctx.fill();
        text(`+${e.pts}`, e.x, e.y - e.r * 0.4 - p * 60 * S, 44, rgba(C.hit, a), 'center', 700);
      } else if (e.type === 'escape') {
        text(t('missed'), e.x, e.y - p * 30 * S, 26, rgba(C.miss, a * 0.6));
      }
    }
    // Missed shots: dark holes with a faint ring
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

  // ---------- Shooting ----------

  function shoot(x, y) {
    if (game.scene === 'menu' || game.scene === 'results') {
      const b = game.buttons.find((btn) => x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h);
      if (b && b.id === 'sound') {
        // Change gunshot sound – and fire the new one right away as a preview
        if (!Gunshots) return;
        shotSound = Gunshots.next(shotSound);
        store.set(SOUND_KEY, shotSound);
        fire();
        return;
      }
      fire();
      if (!b) return;
      if (b.id === 'hub') Hub.go(lang);
      else if (b.id === 'lang') toggleLang();
      else if (b.id === 'menu') toMenu();
      else if (b.id === 'again') startRound(game.mode);
      else startRound(b.id);
      return;
    }
    fire();
    if (game.scene !== 'play') return;

    const st = game.stats;
    st.shots++;

    // Topmost (most recently created) target first
    for (let i = game.targets.length - 1; i >= 0; i--) {
      const tg = game.targets[i];
      const r = tg.r * targetScale(tg);
      const d = Math.hypot(x - tg.x, y - tg.y) / r;
      if (d > 1) continue;
      const pts = RINGS.find(([frac]) => d <= frac)[1];
      st.score += pts;
      st.hits++;
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      st.rings[pts] = (st.rings[pts] || 0) + 1;
      game.targets.splice(i, 1);
      addEffect({ type: 'hit', x: tg.x, y: tg.y, r: tg.r, hx: x, hy: y, pts, life: 0.7 });
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
      if (game.scene === 'menu') Hub.exit(lang);
      else toMenu();
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  // ---------- Buttons (menu/results) ----------

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
    if (b.small) {
      text(b.label, cx, b.y + b.h * 0.38, 32, C.text, 'center', 600);
      text(b.sub, cx, b.y + b.h * 0.7, 20, C.dim);
      return;
    }
    text(b.label, cx, b.y + b.h * (b.sub ? 0.36 : 0.5), 40, C.text, 'center', 600);
    if (b.sub) text(b.sub, cx, b.y + b.h * 0.6, 22, C.dim);
    if (b.extra) text(b.extra, cx, b.y + b.h * 0.8, 20, C.dim);
  }

  function layoutMenu() {
    const bw = Math.min(380 * S, (W - 120 * S) / 2);
    const bh = 190 * S;
    const gap = 32 * S;
    const x0 = W / 2 - bw - gap / 2;
    const y0 = H * 0.3;
    game.buttons = MODE_ORDER.map((id, i) => {
      const best = getBest(id);
      return {
        id,
        label: t(`mode.${id}`),
        sub: t(`mode.${id}.sub`),
        extra: best ? t('best', { n: best }) : t('noBest'),
        x: x0 + (i % 2) * (bw + gap),
        y: y0 + Math.floor(i / 2) * (bh + gap),
        w: bw,
        h: bh,
      };
    });
    // Bottom row: gunshot sound (wide) and language
    const rowY = y0 + 2 * (bh + gap);
    const rowH = 110 * S;
    const full = bw * 2 + gap;
    const langW = Math.round(full * 0.32);
    if (Gunshots) {
      game.buttons.push({
        id: 'sound',
        label: t('sound', { name: Gunshots.nameOf(shotSound, lang) }),
        sub: t('soundSub'),
        x: x0,
        y: rowY,
        w: full - langW - gap,
        h: rowH,
        small: true,
      });
    }
    game.buttons.push({
      id: 'lang',
      label: t('language'),
      sub: t('languageSub'),
      x: Gunshots ? x0 + full - langW : x0,
      y: rowY,
      w: Gunshots ? langW : full,
      h: rowH,
      small: true,
    });
    if (Hub.available) game.buttons.push(Hub.button(S, H, lang));
  }

  function layoutResults() {
    const bw = 300 * S;
    const bh = 110 * S;
    const gap = 32 * S;
    const y = H * 0.74;
    game.buttons = [
      { id: 'again', label: t('again'), x: W / 2 - bw - gap / 2, y, w: bw, h: bh },
      { id: 'menu', label: t('menu'), x: W / 2 + gap / 2, y, w: bw, h: bh },
    ];
  }

  // ---------- Scenes ----------

  function drawMenu() {
    layoutMenu();
    text(t('title'), W / 2, H * 0.14, 84, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.14 + 80 * S, 28, C.dim);
    game.buttons.forEach(drawButton);
    text(t('footer'), W / 2, H - 40 * S, 20, C.faint);
  }

  function drawHud() {
    const st = game.stats;
    const y = 54 * S;
    const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
    text(`${Math.ceil(game.timeLeft)} s`, 40 * S, y, 40, game.timeLeft < 10 ? C.text : C.dim, 'left', 600);
    text(`${st.score}`, W / 2, y, 56, C.text, 'center', 700);
    text(`${st.hits}/${st.shots} · ${acc} %`, W - 40 * S, y, 32, C.dim, 'right');
    // Time bar
    ctx.fillStyle = C.faint;
    ctx.fillRect(0, 100 * S, W * (game.timeLeft / ROUND_SECONDS), 3 * S);
  }

  function drawCountdown() {
    drawHud();
    const n = Math.ceil(game.countdown);
    text(n > 0 ? String(n) : t('go'), W / 2, H / 2, 220, C.dim, 'center', 700);
    text(t(`mode.${game.mode}`), W / 2, H / 2 + 160 * S, 32, C.faint);
  }

  function drawPlay() {
    for (const tg of game.targets) drawTarget(tg);
    drawEffects();
    drawHud();
  }

  function drawResults() {
    layoutResults();
    const st = game.stats;
    const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
    const avg = st.hits ? (st.score / st.hits).toFixed(1) : '–';
    text(t(`mode.${game.mode}`), W / 2, H * 0.12, 32, C.dim);
    text(t('points', { n: st.score }), W / 2, H * 0.24, 110, C.text, 'center', 700);
    text(game.newBest ? t('newBest') : t('best', { n: getBest(game.mode) }), W / 2, H * 0.24 + 90 * S, 30, game.newBest ? rgba(C.hit, 1) : C.dim, 'center', 600);

    const rows = [
      [t('row.hits'), t('row.hitsValue', { hits: st.hits, shots: st.shots, acc })],
      [t('row.avg'), `${avg}`],
      [t('row.streak'), `${st.bestStreak}`],
      [t('row.escaped'), `${st.escaped}`],
      [t('row.rings'), `${st.rings[10] || 0} / ${st.rings[9] || 0} / ${st.rings[8] || 0}`],
    ];
    const y0 = H * 0.44;
    rows.forEach(([k, v], i) => {
      const y = y0 + i * 44 * S;
      text(k, W / 2 - 20 * S, y, 28, C.dim, 'right');
      text(v, W / 2 + 20 * S, y, 28, C.text, 'left', 600);
    });
    game.buttons.forEach(drawButton);
  }

  // ---------- Main loop ----------

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

  // For automated tests
  window.__game = game;
  window.__lang = () => lang;
})();
