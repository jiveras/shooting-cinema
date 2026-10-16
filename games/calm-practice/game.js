// Calm Practice – one fixed target at a time, no clock.
//
// A target appears somewhere on the screen and waits. A miss leaves a dark
// mark and the target stays. A hit shows where the shot landed and its score
// for a moment, then everything fades and the next target appears in a new
// place. Good for practising aim and trigger control at your own pace.
//
// Design rules for projector + webcam (see docs/TECHNICAL.md): dark background,
// muted colours with a low red channel, no small bright dots (holes are dark)
// and the darkest part of the target is the bullseye.
//
// Language: ?lang=sv|en (set by Laser Mouse), otherwise the last menu choice.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- Texts ----------

  const STRINGS = {
    sv: {
      title: 'Lugn träning',
      subtitle: 'Välj storlek på tavlan för att börja',
      footer: 'Ingen tid, ingen stress · Esc avslutar · F helskärm',
      'size.large': 'Stor',
      'size.large.sub': 'Bred tavla',
      'size.medium': 'Medel',
      'size.medium.sub': 'Standard',
      'size.small': 'Liten',
      'size.small.sub': 'Kräver stadig hand',
      sound: 'Skottljud: {name}',
      soundSub: 'Skjut här för att byta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      'hud.hits': 'Träffar',
      'hud.shots': 'Skott',
      'hud.avg': 'Snitt',
      'hud.streak': 'Serie',
      miss: 'Utanför',
      'off.centre': '{n} % från mitten',
      menu: 'Meny',
    },
    en: {
      title: 'Calm Practice',
      subtitle: 'Pick a target size to start',
      footer: 'No clock, no pressure · Esc quits · F full screen',
      'size.large': 'Large',
      'size.large.sub': 'Wide target',
      'size.medium': 'Medium',
      'size.medium.sub': 'Standard',
      'size.small': 'Small',
      'size.small.sub': 'Needs a steady hand',
      sound: 'Gunshot: {name}',
      soundSub: 'Shoot here to change',
      language: 'English',
      languageSub: 'Skjut för svenska',
      'hud.hits': 'Hits',
      'hud.shots': 'Shots',
      'hud.avg': 'Average',
      'hud.streak': 'Streak',
      miss: 'Off target',
      'off.centre': '{n} % from centre',
      menu: 'Menu',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'calm-practice:lang';
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
    // Bands from the outside in; the centre is the DARKEST so the laser dot stands out there.
    bands: ['#1d3140', '#17293a', '#1d3140', '#14232f', '#101c26', '#0b141b'],
    ring: '#3a6178',
    hit: [70, 170, 120], // muted green
    miss: [110, 122, 134],
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

  const SIZES = { large: 120, medium: 80, small: 50 }; // radius at 1080 px screen height
  const SIZE_ORDER = ['large', 'medium', 'small'];
  const HIT_SHOW_S = 1.8; // how long a hit stays on screen before the next target
  const FADE_S = 0.35;
  const APPEAR_S = 0.2;

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
  const Gunshots = window.Gunshots;
  const guns = Gunshots ? new Gunshots(ac) : null;
  const SOUND_KEY = 'calm-practice:shotSound';
  let shotSound = store.get(SOUND_KEY) || 'pistol';
  const fire = () => guns && guns.play(shotSound);

  // The hit sound comes slightly after the shot so it isn't drowned out
  const sfxHit = (pts) => {
    beep(380 + pts * 55, 0.12, { type: 'triangle', gain: 0.2, at: 0.1 });
    if (pts === 10) beep(1500, 0.18, { at: 0.16, gain: 0.12 });
  };

  // ---------- Game state ----------

  const game = {
    scene: 'menu', // 'menu' | 'play'
    size: 'medium',
    target: null, // { x, y, r, age, hit: null | { x, y, pts, off, age }, holes: [{x, y}] }
    prev: null, // previous target position, so the next one lands somewhere new
    stats: null,
    buttons: [],
    hover: null,
  };

  const newStats = () => ({ shots: 0, hits: 0, score: 0, streak: 0 });

  function startPractice(size) {
    game.size = size;
    game.scene = 'play';
    game.stats = newStats();
    game.prev = null;
    spawnTarget();
  }

  function toMenu() {
    game.scene = 'menu';
    game.target = null;
  }

  /** A new target well away from the last one and clear of the score bar. */
  function spawnTarget() {
    const r = SIZES[game.size] * S;
    const margin = 30 * S;
    const top = 130 * S + r;
    const bottom = H - r - 90 * S; // room for the menu button
    const minDist = Math.min(W, H) * 0.3;
    let x = 0, y = 0;
    for (let i = 0; i < 40; i++) {
      x = rand(r + margin, W - r - margin);
      y = rand(top, bottom);
      if (!game.prev || Math.hypot(x - game.prev.x, y - game.prev.y) >= minDist) break;
    }
    game.prev = { x, y };
    game.target = { x, y, r, age: 0, hit: null, holes: [] };
  }

  // ---------- Shooting ----------

  function menuButton() {
    const w = 200 * S, h = 64 * S;
    return { id: 'menu', label: t('menu'), x: W / 2 - w / 2, y: H - h - 20 * S, w, h };
  }

  const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  function shoot(x, y) {
    if (game.scene === 'menu') {
      const b = game.buttons.find((btn) => inside(btn, x, y));
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
      else startPractice(b.id);
      return;
    }

    if (inside(menuButton(), x, y)) {
      fire();
      toMenu();
      return;
    }
    fire();

    const tg = game.target;
    // While a hit is being shown the round is between targets: shots don't count
    if (!tg || tg.hit || tg.age < APPEAR_S) return;

    const st = game.stats;
    st.shots++;
    const d = Math.hypot(x - tg.x, y - tg.y) / tg.r;
    if (d > 1) {
      st.streak = 0;
      tg.holes.push({ x, y, age: 0 });
      return;
    }
    const pts = RINGS.find(([frac]) => d <= frac)[1];
    st.hits++;
    st.score += pts;
    st.streak++;
    tg.hit = { x, y, pts, off: Math.round(d * 100), age: 0 };
    sfxHit(pts);
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

  // ---------- Drawing ----------

  function drawButton(b) {
    const hot = game.hover && inside(b, game.hover.x, game.hover.y);
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = hot ? C.panelHot : C.panelEdge;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14 * S);
    ctx.fill();
    ctx.stroke();
    const cx = b.x + b.w / 2;
    if (b.small) {
      text(b.label, cx, b.y + b.h * 0.38, 32, C.text, 'center', 600);
      if (b.sub) text(b.sub, cx, b.y + b.h * 0.7, 20, C.dim);
    } else if (b.compact) {
      text(b.label, cx, b.y + b.h / 2, 28, C.dim, 'center', 600);
    } else {
      text(b.label, cx, b.y + b.h * 0.38, 40, C.text, 'center', 600);
      text(b.sub, cx, b.y + b.h * 0.68, 22, C.dim);
    }
  }

  function layoutMenu() {
    const gap = 32 * S;
    const bw = Math.min(300 * S, (W - 120 * S - 2 * gap) / 3);
    const bh = 190 * S;
    const full = bw * 3 + gap * 2;
    const x0 = W / 2 - full / 2;
    const y0 = H * 0.34;
    game.buttons = SIZE_ORDER.map((id, i) => ({
      id,
      label: t(`size.${id}`),
      sub: t(`size.${id}.sub`),
      x: x0 + i * (bw + gap),
      y: y0,
      w: bw,
      h: bh,
    }));
    const rowY = y0 + bh + gap;
    const rowH = 110 * S;
    const langW = Math.round(full * 0.32);
    if (Gunshots) {
      game.buttons.push({
        id: 'sound',
        label: t('sound', { name: Gunshots.nameOf(shotSound, lang) }),
        sub: t('soundSub'),
        x: x0, y: rowY, w: full - langW - gap, h: rowH, small: true,
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

  function drawMenu() {
    layoutMenu();
    text(t('title'), W / 2, H * 0.14, 84, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.14 + 80 * S, 28, C.dim);
    game.buttons.forEach(drawButton);
    text(t('footer'), W / 2, H - 40 * S, 20, C.faint);
  }

  function drawTarget(tg, alpha) {
    const s = tg.age < APPEAR_S ? 0.3 + 0.7 * (1 - Math.pow(1 - tg.age / APPEAR_S, 3)) : 1;
    const r = tg.r * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < RINGS.length; i++) {
      const frac = RINGS[RINGS.length - 1 - i][0];
      ctx.fillStyle = C.bands[i];
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r * frac, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = Math.max(1, 1.5 * S);
    for (const [frac] of RINGS) {
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Missed shots: dark holes with a faint ring (they go with the target)
    for (const h of tg.holes) {
      ctx.fillStyle = 'rgba(2, 3, 4, 0.95)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 7 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(C.miss, 0.45);
      ctx.lineWidth = 1.5 * S;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 12 * S, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The hit: a dark hole in a green ring, a line to the centre and the score
    if (tg.hit) {
      const h = tg.hit;
      ctx.strokeStyle = rgba(C.hit, 0.4);
      ctx.lineWidth = 2 * S;
      ctx.setLineDash([6 * S, 6 * S]);
      ctx.beginPath();
      ctx.moveTo(tg.x, tg.y);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(2, 3, 4, 0.95)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 7 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(C.hit, 0.9);
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 15 * S, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    if (tg.hit) {
      const h = tg.hit;
      const above = tg.y > H * 0.4;
      const ty = above ? tg.y - tg.r - 70 * S : tg.y + tg.r + 70 * S;
      text(String(h.pts), tg.x, ty, 72, rgba(C.hit, alpha), 'center', 700);
      text(t('off.centre', { n: h.off }), tg.x, ty + 50 * S, 24, rgba(C.miss, alpha * 0.8));
    }
  }

  function drawHud() {
    const st = game.stats;
    const y = 54 * S;
    const avg = st.hits ? (st.score / st.hits).toFixed(1) : '–';
    const cols = [
      [t('hud.hits'), `${st.hits}`],
      [t('hud.shots'), `${st.shots}`],
      [t('hud.avg'), avg],
      [t('hud.streak'), `${st.streak}`],
    ];
    const step = Math.min(240 * S, (W - 80 * S) / cols.length);
    const x0 = W / 2 - (step * (cols.length - 1)) / 2;
    cols.forEach(([k, v], i) => {
      text(v, x0 + i * step, y, 46, C.text, 'center', 700);
      text(k, x0 + i * step, y + 42 * S, 20, C.dim);
    });
  }

  function drawPlay() {
    const tg = game.target;
    if (tg) {
      let alpha = 1;
      if (tg.hit) alpha = Math.min(1, (HIT_SHOW_S - tg.hit.age) / FADE_S);
      drawTarget(tg, Math.max(0, alpha));
    }
    drawHud();
    drawButton({ ...menuButton(), compact: true });
  }

  // ---------- Main loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const tg = game.target;
    if (game.scene === 'play' && tg) {
      tg.age += dt;
      if (tg.hit) {
        tg.hit.age += dt;
        if (tg.hit.age >= HIT_SHOW_S) spawnTarget();
      }
    }

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (game.scene === 'menu') drawMenu();
    else drawPlay();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // For automated tests
  window.__game = game;
  window.__lang = () => lang;
})();
