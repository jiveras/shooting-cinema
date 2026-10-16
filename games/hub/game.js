// Game menu – the start page of the games in Laser Mouse.
//
// Pick a game by shooting its button. Each game has a "Game menu" button that
// leads back here, so you never have to go back to the computer. "Quit" closes
// the window and returns to Laser Mouse.
//
// Games are listed by Laser Mouse (window.laserGames, see game-preload.js).
// Language: ?lang=sv|en, otherwise the last choice made here.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const STRINGS = {
    sv: {
      title: 'Spel',
      subtitle: 'Skjut på ett spel för att börja',
      quit: 'Avsluta',
      quitSub: 'Tillbaka till datorn',
      confirm: 'Skjut igen för att avsluta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      none: 'Inga spel hittades. Starta spelen från Laser Mouse.',
    },
    en: {
      title: 'Games',
      subtitle: 'Shoot a game to start',
      quit: 'Quit',
      quitSub: 'Back to the computer',
      confirm: 'Shoot again to quit',
      language: 'English',
      languageSub: 'Skjut för svenska',
      none: 'No games found. Start the games from Laser Mouse.',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'hub:lang';
  const urlLang = new URLSearchParams(location.search).get('lang');
  let lang = STRINGS[urlLang] ? urlLang : STRINGS[store.get(LANG_KEY)] ? store.get(LANG_KEY) : 'sv';
  document.documentElement.lang = lang;
  const t = (key) => STRINGS[lang][key] ?? STRINGS.sv[key] ?? key;
  const pick = (v) => (typeof v === 'object' && v ? v[lang] || v.en || '' : v || '');

  function toggleLang() {
    lang = lang === 'sv' ? 'en' : 'sv';
    document.documentElement.lang = lang;
    document.title = lang === 'sv' ? 'Spelmeny' : 'Game menu';
    store.set(LANG_KEY, lang);
  }

  const C = {
    bg: '#06080b',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    warn: '#8a6a3a', // muted amber
  };

  const ORDER = ['calm-practice', 'gliding-targets', 'clay-pigeons', 'hunting-stand', 'shot-timer'];

  let W = 0, H = 0, S = 1;
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

  const font = (size, weight = 500) =>
    `${weight} ${Math.round(size * S)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  function text(str, x, y, size, color, align = 'center', weight = 500) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  /** Word-wrapped text, at most maxLines lines. */
  function wrapped(str, x, y, maxW, size, color, maxLines = 2) {
    ctx.font = font(size);
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…');
    }
    lines.forEach((l, i) => text(l, x, y + i * size * 1.3 * S, size, color));
  }

  const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  const state = {
    games: [],
    loaded: false,
    buttons: [],
    hover: null,
    quitArmed: 0, // time until which a second shot on "Quit" really quits
  };

  async function loadGames() {
    try {
      const list = (await window.laserGames?.list()) || [];
      const rank = (g) => (ORDER.includes(g.id) ? ORDER.indexOf(g.id) : ORDER.length);
      state.games = list.sort((a, b) => rank(a) - rank(b));
    } catch {
      state.games = [];
    }
    state.loaded = true;
  }
  loadGames();

  function layout() {
    const gap = 28 * S;
    const full = Math.min(1180 * S, W - 100 * S);
    const bw = (full - gap) / 2;
    const bh = 150 * S;
    const x0 = (W - full) / 2;
    const y0 = H * 0.25;
    state.buttons = state.games.map((g, i) => ({
      id: g.id,
      game: g,
      x: x0 + (i % 2) * (bw + gap),
      y: y0 + Math.floor(i / 2) * (bh + gap),
      w: bw,
      h: bh,
    }));
    // Bottom row: quit and language
    const rows = Math.ceil(state.games.length / 2);
    const rowY = Math.min(y0 + rows * (bh + gap), H - 130 * S);
    const rowH = 100 * S;
    const half = (full - gap) / 2;
    state.buttons.push({ id: 'quit', x: x0, y: rowY, w: half, h: rowH, small: true });
    state.buttons.push({ id: 'lang', x: x0 + half + gap, y: rowY, w: half, h: rowH, small: true });
  }

  function drawButton(b) {
    const hot = state.hover && inside(b, state.hover.x, state.hover.y);
    const armed = b.id === 'quit' && performance.now() < state.quitArmed;
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = armed ? C.warn : hot ? C.panelHot : C.panelEdge;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14 * S);
    ctx.fill();
    ctx.stroke();
    const cx = b.x + b.w / 2;
    if (b.id === 'quit') {
      text(armed ? t('confirm') : t('quit'), cx, b.y + b.h * 0.38, 32, armed ? C.warn : C.text, 'center', 600);
      text(t('quitSub'), cx, b.y + b.h * 0.7, 20, C.dim);
    } else if (b.id === 'lang') {
      text(t('language'), cx, b.y + b.h * 0.38, 32, C.text, 'center', 600);
      text(t('languageSub'), cx, b.y + b.h * 0.7, 20, C.dim);
    } else {
      text(pick(b.game.name), cx, b.y + b.h * 0.3, 40, C.text, 'center', 600);
      wrapped(pick(b.game.description), cx, b.y + b.h * 0.6, b.w - 60 * S, 20, C.dim, 2);
    }
  }

  function shoot(x, y) {
    const b = state.buttons.find((btn) => inside(btn, x, y));
    if (!b) return;
    if (b.id === 'lang') {
      toggleLang();
    } else if (b.id === 'quit') {
      // Quitting takes two shots so a stray shot doesn't end the session
      if (performance.now() < state.quitArmed) window.laserGames ? window.laserGames.close() : window.close();
      else state.quitArmed = performance.now() + 4000;
    } else {
      location.href = `../${b.id}/index.html?lang=${lang}`;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    shoot(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    state.hover = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.laserGames ? window.laserGames.close() : window.close();
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  function frame() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    document.title = lang === 'sv' ? 'Spelmeny' : 'Game menu';
    layout();
    text(t('title'), W / 2, H * 0.1, 84, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.1 + 78 * S, 28, C.dim);
    if (state.loaded && state.games.length === 0) text(t('none'), W / 2, H * 0.45, 28, C.dim);
    state.buttons.forEach(drawButton);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = state;
})();
