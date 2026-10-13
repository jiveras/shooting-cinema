// Shot Timer & Drills – measure and sharpen the basics, like with a real shot timer.
//
// A beep starts the clock; every shot (a mouse click, or a laser flash via
// Laser Mouse) is timed and placed. Six drills:
//
//  - Free timer   beep, then shoot as you like: first-shot time and splits
//  - Mount        gun lowered, on the beep mount and hit – 10 reps
//  - Bill drill   six shots on one target, as fast as you can
//  - El Presidente three targets, two shots each
//  - Reaction     one of five targets lights up – find it and hit it, 10 reps
//  - Grouping     ten calm shots on a small target, no clock: group size
//
// A shot before the beep is a false start, and the rep starts over.
// Every result is saved; the results screen shows the personal best and a
// trend line of the last ten runs. All primary metrics are "lower is better".
//
// Note: times measured through Laser Mouse include the camera delay
// (typically 0.05–0.1 s), the same for every shot.
//
// Design rules for projector + webcam: dark background, muted colours with a
// LOW red channel, dark bullseyes and no small bright dots.
//
// Language: Swedish by default, English available. The language comes from
// ?lang=sv|en (set by Laser Mouse), otherwise from the last choice in the menu.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- Texts ----------

  const STRINGS = {
    sv: {
      title: 'Skottimer',
      subtitle: 'Skjut på en övning för att börja',
      footer: 'Pipet startar klockan · skott före pipet är tjuvstart · Esc avslutar · F helskärm',
      'drill.timer': 'Fri skottimer',
      'drill.timer.sub': 'Pip – skjut som du vill',
      'drill.mount': 'Uppskjutning',
      'drill.mount.sub': 'Sänkt vapen, upp och träffa · 10 ggr',
      'drill.bill': 'Bill drill',
      'drill.bill.sub': 'Sex skott, ett mål, snabbt',
      'drill.presidente': 'El Presidente',
      'drill.presidente.sub': 'Tre mål, två skott på varje',
      'drill.random': 'Reaktion',
      'drill.random.sub': 'Ett mål tänds – träffa det · 10 ggr',
      'drill.grouping': 'Gruppering',
      'drill.grouping.sub': 'Tio lugna skott, ingen klocka',
      best: 'Bäst: {v}',
      noBest: 'Inget resultat än',
      sound: 'Skottljud: {name}',
      soundSub: 'Skjut här för att byta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      rep: 'Omgång {n} av {total}',
      shots: 'Skott {n} av {total}',
      standby: 'Gör dig redo…',
      falseStart: 'Tjuvstart!',
      groupingGo: 'Skjut i lugn takt',
      miss: 'Miss',
      timeout: 'För sent',
      wrong: 'Fel mål',
      newBest: 'Nytt personbästa!',
      pb: 'Personbästa: {v}',
      trend: 'Senaste {n} gångerna',
      again: 'Kör igen',
      menu: 'Meny',
      'm.firstShot': 'Första skottet',
      'm.avgSplit': 'Snitt mellan skotten',
      'm.shots': 'Antal skott',
      'm.hits': 'Träffar',
      'm.avgTime': 'Snittid till skott',
      'm.bestTime': 'Bästa tid',
      'm.hitRate': 'Träffprocent',
      'm.total': 'Total tid',
      'm.points': 'Poäng',
      'm.correct': 'Rätt mål',
      'm.group': 'Träffbildens storlek',
      'm.offset': 'Träffbildens mitt',
      'm.avgRing': 'Snitt per skott',
      'm.falseStarts': 'Tjuvstarter',
      'primary.timer': 'till första skottet',
      'primary.mount': 'i snitt till skott',
      'primary.bill': 'för sex skott',
      'primary.presidente': 'för tre mål',
      'primary.random': 'i snitt reaktionstid',
      'primary.grouping': 'träffbild',
      'offset.centre': 'mitt i prick',
      'offset.right': '{px} px höger',
      'offset.left': '{px} px vänster',
      'offset.low': '{px} px lågt',
      'offset.high': '{px} px högt',
      noResult: 'Inget resultat – inga träffar',
    },
    en: {
      title: 'Shot Timer',
      subtitle: 'Shoot a drill to start',
      footer: 'The beep starts the clock · shots before the beep are false starts · Esc quits · F full screen',
      'drill.timer': 'Free timer',
      'drill.timer.sub': 'Beep – shoot as you like',
      'drill.mount': 'Mount drill',
      'drill.mount.sub': 'Gun lowered, mount and hit · 10 reps',
      'drill.bill': 'Bill drill',
      'drill.bill.sub': 'Six shots, one target, fast',
      'drill.presidente': 'El Presidente',
      'drill.presidente.sub': 'Three targets, two shots each',
      'drill.random': 'Reaction',
      'drill.random.sub': 'A target lights up – hit it · 10 reps',
      'drill.grouping': 'Grouping',
      'drill.grouping.sub': 'Ten calm shots, no clock',
      best: 'Best: {v}',
      noBest: 'No result yet',
      sound: 'Gunshot: {name}',
      soundSub: 'Shoot here to change',
      language: 'English',
      languageSub: 'Skjut för svenska',
      rep: 'Rep {n} of {total}',
      shots: 'Shot {n} of {total}',
      standby: 'Standby…',
      falseStart: 'False start!',
      groupingGo: 'Shoot at a calm pace',
      miss: 'Miss',
      timeout: 'Too slow',
      wrong: 'Wrong target',
      newBest: 'New personal best!',
      pb: 'Personal best: {v}',
      trend: 'Last {n} runs',
      again: 'Run again',
      menu: 'Menu',
      'm.firstShot': 'First shot',
      'm.avgSplit': 'Average split',
      'm.shots': 'Shots',
      'm.hits': 'Hits',
      'm.avgTime': 'Average time to shot',
      'm.bestTime': 'Best time',
      'm.hitRate': 'Hit rate',
      'm.total': 'Total time',
      'm.points': 'Points',
      'm.correct': 'Correct target',
      'm.group': 'Group size',
      'm.offset': 'Group centre',
      'm.avgRing': 'Average per shot',
      'm.falseStarts': 'False starts',
      'primary.timer': 'to the first shot',
      'primary.mount': 'average time to shot',
      'primary.bill': 'for six shots',
      'primary.presidente': 'for three targets',
      'primary.random': 'average reaction time',
      'primary.grouping': 'group size',
      'offset.centre': 'dead centre',
      'offset.right': '{px} px right',
      'offset.left': '{px} px left',
      'offset.low': '{px} px low',
      'offset.high': '{px} px high',
      noResult: 'No result – no hits',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'shot-timer:lang';
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

  // ---------- Look ----------

  const C = {
    bg: '#06080b',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    // Target bands from the outside in – the centre is the darkest (see games/README)
    bands: ['#1d3140', '#17293a', '#1d3140', '#14232f', '#101c26', '#0b141b'],
    ring: '#3a6178',
    // An inactive target in the reaction drill: only a faint outline
    idle: '#1a2833',
    hit: [70, 170, 120],
    miss: [110, 122, 134], // bluish grey, no red for the camera
    timer: '#5f7a8f',
  };

  const RINGS = [
    [0.15, 10],
    [0.3, 9],
    [0.45, 8],
    [0.6, 7],
    [0.8, 6],
    [1.0, 5],
  ];

  // ---------- Drills ----------
  // Positions are normalized (0–1), radii in px at a 1080 px tall screen.

  const DRILLS = {
    timer: { reps: 1, shots: 30, idleEndMs: 3000, firstShotTimeoutMs: 10000, targets: [{ x: 0.5, y: 0.55, r: 120 }] },
    mount: { reps: 10, shots: 1, timeoutMs: 5000, targets: [{ x: 0.5, y: 0.55, r: 95 }] },
    bill: { reps: 1, shots: 6, timeoutMs: 12000, targets: [{ x: 0.5, y: 0.55, r: 95 }] },
    presidente: {
      reps: 1,
      shots: 6,
      timeoutMs: 15000,
      targets: [
        { x: 0.22, y: 0.55, r: 85 },
        { x: 0.5, y: 0.55, r: 85 },
        { x: 0.78, y: 0.55, r: 85 },
      ],
    },
    random: {
      reps: 10,
      shots: 1,
      timeoutMs: 4000,
      targets: [
        { x: 0.18, y: 0.38, r: 72 },
        { x: 0.5, y: 0.34, r: 72 },
        { x: 0.82, y: 0.38, r: 72 },
        { x: 0.32, y: 0.74, r: 72 },
        { x: 0.68, y: 0.74, r: 72 },
      ],
    },
    grouping: { reps: 1, shots: 10, noClock: true, targets: [{ x: 0.5, y: 0.55, r: 60 }] },
  };
  const DRILL_ORDER = ['timer', 'mount', 'bill', 'presidente', 'random', 'grouping'];

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
  const secs = (ms) => `${(ms / 1000).toFixed(2)} s`;
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : '–');
  const median = (arr) => {
    const a = [...arr].sort((p, q) => p - q);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  /** A target in screen pixels. */
  const targetPx = (tg) => ({ x: tg.x * W, y: tg.y * H, r: tg.r * S });

  // ---------- History ----------

  const histKey = (d) => `shot-timer:history:${d}`;
  function loadHistory(d) {
    try {
      return JSON.parse(store.get(histKey(d)) || '[]');
    } catch {
      return [];
    }
  }
  function saveResult(d, value) {
    const h = loadHistory(d);
    h.push({ v: value, at: Date.now() });
    while (h.length > 50) h.shift();
    store.set(histKey(d), JSON.stringify(h));
  }
  const bestOf = (h) => (h.length ? Math.min(...h.map((e) => e.v)) : null);

  /** Formats a drill's primary value: seconds, or px for grouping. */
  const fmtPrimary = (d, v) => (v === null || v === undefined ? '–' : d === 'grouping' ? `${Math.round(v)} px` : secs(v));

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
      g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
      g.gain.setValueAtTime(gain, t0 + dur - 0.01);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch { /* no sound */ }
  }

  const Gunshots = window.Gunshots;
  const guns = Gunshots ? new Gunshots(ac) : null;
  const SOUND_KEY = 'shot-timer:shotSound';
  let shotSound = store.get(SOUND_KEY) || 'shotgun';
  const fire = () => guns && guns.play(shotSound);

  const sfx = {
    // The classic shot-timer beep: sharp, high and loud
    start: () => beep(2400, 0.28, { type: 'square', gain: 0.12 }),
    hit: (pts) => beep(380 + pts * 55, 0.1, { type: 'triangle', gain: 0.16, at: 0.1 }),
    falseStart: () => {
      beep(220, 0.18, { type: 'square', gain: 0.08 });
      beep(180, 0.25, { type: 'square', gain: 0.08, at: 0.2 });
    },
    end: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.18, { at: i * 0.1, gain: 0.12 })),
  };

  // ---------- State ----------

  const game = {
    scene: 'menu', // 'menu' | 'play' | 'results'
    phase: 'standby', // in play: 'standby' | 'go' | 'rep'
    drill: 'timer',
    rep: 0,
    timer: 0, // ms left in the current phase
    goAt: 0, // performance.now() of the beep
    shots: [], // shots of the current rep: { t, x, y, target, pts }
    reps: [], // finished reps
    active: 0, // lit target in the reaction drill
    falseStarts: 0,
    note: null, // { key, color, until }
    result: null, // computed results
    buttons: [],
    hover: null,
  };

  function startDrill(id) {
    game.drill = id;
    game.scene = 'play';
    game.rep = 0;
    game.reps = [];
    game.falseStarts = 0;
    game.result = null;
    startRep();
  }

  function startRep() {
    game.shots = [];
    const d = DRILLS[game.drill];
    if (d.noClock) {
      // Grouping: no beep, the shots are just counted
      game.phase = 'go';
      game.goAt = performance.now();
      return;
    }
    game.phase = 'standby';
    // A random delay, like the "random start" on a shot timer
    game.timer = rand(1500, 3500);
    if (game.drill === 'random') game.active = Math.floor(Math.random() * d.targets.length);
  }

  function go() {
    game.phase = 'go';
    game.goAt = performance.now();
    sfx.start();
  }

  function endRep() {
    game.reps.push(game.shots);
    game.rep++;
    const d = DRILLS[game.drill];
    if (game.rep >= d.reps) {
      finishDrill();
      return;
    }
    game.phase = 'rep';
    game.timer = 1800; // time to see the result and reload
  }

  function note(key, color) {
    game.note = { key, color, until: performance.now() + 1200 };
  }

  // ---------- Results ----------

  /** Computes the results of a finished drill: primary value + rows of [label, value]. */
  function computeResult(id, reps) {
    const d = DRILLS[id];
    const all = reps.flat();
    const hits = all.filter((s) => s.target !== null && s.target !== undefined);
    const rows = [];
    let primary = null;

    if (id === 'timer') {
      const shots = reps[0] || [];
      const splits = shots.slice(1).map((s, i) => s.t - shots[i].t);
      primary = shots.length ? shots[0].t : null;
      rows.push([t('m.firstShot'), shots.length ? secs(shots[0].t) : '–']);
      rows.push([t('m.avgSplit'), splits.length ? secs(splits.reduce((a, b) => a + b, 0) / splits.length) : '–']);
      rows.push([t('m.shots'), `${shots.length}`]);
      rows.push([t('m.hits'), `${hits.length} / ${shots.length}`]);
    } else if (id === 'mount' || id === 'random') {
      // One shot per rep: time counts only when the right target was hit
      const good = reps.map((r) => r[0]).filter((s) => s && s.target !== null && (id !== 'random' || s.correct));
      const times = good.map((s) => s.t);
      primary = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
      rows.push([t('m.avgTime'), times.length ? secs(primary) : '–']);
      rows.push([t('m.bestTime'), times.length ? secs(Math.min(...times)) : '–']);
      rows.push([id === 'random' ? t('m.correct') : t('m.hitRate'), `${good.length} / ${d.reps} (${pct(good.length, d.reps)})`]);
    } else if (id === 'bill' || id === 'presidente') {
      const shots = reps[0] || [];
      const splits = shots.slice(1).map((s, i) => s.t - shots[i].t);
      primary = shots.length === d.shots ? shots[shots.length - 1].t : null;
      rows.push([t('m.total'), shots.length ? secs(shots[shots.length - 1].t) : '–']);
      rows.push([t('m.firstShot'), shots.length ? secs(shots[0].t) : '–']);
      rows.push([t('m.avgSplit'), splits.length ? secs(splits.reduce((a, b) => a + b, 0) / splits.length) : '–']);
      rows.push([t('m.hits'), `${hits.length} / ${d.shots}`]);
      rows.push([t('m.points'), `${hits.reduce((a, s) => a + s.pts, 0)} / ${d.shots * 10}`]);
    } else if (id === 'grouping') {
      const shots = reps[0] || [];
      const tg = targetPx(d.targets[0]);
      const cx = shots.reduce((a, s) => a + s.x, 0) / (shots.length || 1);
      const cy = shots.reduce((a, s) => a + s.y, 0) / (shots.length || 1);
      // Group size: median distance from the group centre (robust against a flyer)
      primary = shots.length >= 2 ? median(shots.map((s) => Math.hypot(s.x - cx, s.y - cy))) : null;
      const dx = Math.round(cx - tg.x);
      const dy = Math.round(cy - tg.y);
      const off = [
        Math.abs(dx) >= 2 ? t(dx > 0 ? 'offset.right' : 'offset.left', { px: Math.abs(dx) }) : null,
        Math.abs(dy) >= 2 ? t(dy > 0 ? 'offset.low' : 'offset.high', { px: Math.abs(dy) }) : null,
      ].filter(Boolean).join(', ') || t('offset.centre');
      rows.push([t('m.group'), primary !== null ? `${Math.round(primary)} px` : '–']);
      rows.push([t('m.offset'), shots.length ? off : '–']);
      rows.push([t('m.avgRing'), shots.length ? (shots.reduce((a, s) => a + (s.pts || 0), 0) / shots.length).toFixed(1) : '–']);
      rows.push([t('m.hits'), `${hits.length} / ${d.shots}`]);
    }
    if (!d.noClock) rows.push([t('m.falseStarts'), `${game.falseStarts}`]);
    return { primary, rows };
  }

  function finishDrill() {
    const id = game.drill;
    const res = computeResult(id, game.reps);
    const prevBest = bestOf(loadHistory(id));
    if (res.primary !== null) saveResult(id, res.primary);
    res.newBest = res.primary !== null && (prevBest === null || res.primary < prevBest);
    res.history = loadHistory(id).slice(-10).map((e) => e.v);
    res.best = bestOf(loadHistory(id));
    game.result = res;
    game.scene = 'results';
    sfx.end();
  }

  // ---------- Shooting ----------

  /** Which target (index) a point is inside, and the ring score. */
  function hitTest(x, y) {
    const d = DRILLS[game.drill];
    for (let i = 0; i < d.targets.length; i++) {
      const tg = targetPx(d.targets[i]);
      const dist = Math.hypot(x - tg.x, y - tg.y) / tg.r;
      if (dist <= 1) return { target: i, pts: RINGS.find(([f]) => dist <= f)[1] };
    }
    return { target: null, pts: 0 };
  }

  function shoot(x, y) {
    if (game.scene === 'menu' || game.scene === 'results') {
      const b = game.buttons.find((btn) => x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h);
      if (b && b.id === 'sound') {
        if (!Gunshots) return;
        shotSound = Gunshots.next(shotSound);
        store.set(SOUND_KEY, shotSound);
        fire();
        return;
      }
      fire();
      if (!b) return;
      if (b.id === 'lang') toggleLang();
      else if (b.id === 'menu') game.scene = 'menu';
      else if (b.id === 'again') startDrill(game.drill);
      else startDrill(b.id);
      return;
    }

    fire();
    if (game.scene !== 'play') return;

    if (game.phase === 'standby') {
      // A shot before the beep: false start, the rep starts over
      game.falseStarts++;
      note('falseStart', C.miss);
      sfx.falseStart();
      startRep();
      return;
    }
    if (game.phase !== 'go') return;

    const d = DRILLS[game.drill];
    const now = performance.now();
    const h = hitTest(x, y);
    const shot = { t: now - game.goAt, at: now, x, y, target: h.target, pts: h.pts };
    if (game.drill === 'random') shot.correct = h.target === game.active;
    game.shots.push(shot);

    if (h.target !== null && (game.drill !== 'random' || shot.correct)) sfx.hit(h.pts);
    else note(game.drill === 'random' && h.target !== null ? 'wrong' : 'miss', C.miss);

    if (game.shots.length >= d.shots) endRep();
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
      else game.scene = 'menu';
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  // ---------- Update ----------

  function update(dtMs) {
    if (game.scene !== 'play') return;
    const d = DRILLS[game.drill];

    if (game.phase === 'standby') {
      game.timer -= dtMs;
      if (game.timer <= 0) go();
    } else if (game.phase === 'go') {
      if (d.noClock) return;
      const elapsed = performance.now() - game.goAt;
      if (game.drill === 'timer') {
        // The free timer ends a while after the last shot (or if no shot comes)
        const last = game.shots.length ? game.shots[game.shots.length - 1].t : null;
        if ((last === null && elapsed > d.firstShotTimeoutMs) || (last !== null && elapsed - last > d.idleEndMs)) endRep();
      } else if (elapsed > d.timeoutMs) {
        if (d.shots === 1 && game.shots.length === 0) note('timeout', C.miss);
        endRep();
      }
    } else if (game.phase === 'rep') {
      game.timer -= dtMs;
      if (game.timer <= 0) startRep();
    }
  }

  // ---------- Drawing ----------

  function drawTarget(tg, { lit = true } = {}) {
    const { x, y, r } = targetPx(tg);
    if (!lit) {
      ctx.strokeStyle = C.idle;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    for (let i = 0; i < RINGS.length; i++) {
      ctx.fillStyle = C.bands[i];
      ctx.beginPath();
      ctx.arc(x, y, r * RINGS[RINGS.length - 1 - i][0], 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = Math.max(1, 1.5 * S);
    for (const [f] of RINGS) {
      ctx.beginPath();
      ctx.arc(x, y, r * f, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const SHOT_FADE_START = 1500; // ms before a shot mark starts to fade
  const SHOT_FADE_MS = 2000;

  /** A shot mark: a dark hole with a thin ring (green = hit, grey = miss). */
  function drawShot(s, i) {
    const good = s.target !== null && s.correct !== false;
    // Marks fade away (except in grouping, where the pattern is the point)
    // so old shots do not hide the next one from the camera.
    const age = performance.now() - s.at;
    const fade = i !== undefined ? 1 : Math.max(0, Math.min(1, 1 - (age - SHOT_FADE_START) / SHOT_FADE_MS));
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(3, 5, 7, 0.95)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(good ? C.hit : C.miss, 0.7);
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 11 * S, 0, Math.PI * 2);
    ctx.stroke();
    if (i !== undefined) text(String(i + 1), s.x + 18 * S, s.y - 16 * S, 16, C.dim);
    ctx.restore();
  }

  function drawPlay(now) {
    const d = DRILLS[game.drill];

    // Targets
    d.targets.forEach((tg, i) => {
      const lit = game.drill !== 'random' || (game.phase === 'go' && i === game.active) ||
        (game.phase === 'rep' && i === game.active);
      drawTarget(tg, { lit });
    });

    // Shots of the current rep (the grouping drill numbers them)
    game.shots.forEach((s, i) => drawShot(s, game.drill === 'grouping' ? i : undefined));

    // Header: drill and progress
    text(t(`drill.${game.drill}`), 40 * S, 50 * S, 30, C.dim, 'left', 600);
    const progress = d.reps > 1
      ? t('rep', { n: Math.min(game.rep + 1, d.reps), total: d.reps })
      : d.shots > 1 && d.shots < 30 ? t('shots', { n: Math.min(game.shots.length + 1, d.shots), total: d.shots }) : '';
    if (progress) text(progress, W - 40 * S, 50 * S, 26, C.dim, 'right');

    // The running clock, like the display of a shot timer
    if (!d.noClock) {
      let ms = 0;
      if (game.phase === 'go') ms = now - game.goAt;
      else if (game.phase === 'rep' && game.shots.length) ms = game.shots[game.shots.length - 1].t;
      const label = game.phase === 'standby' ? t('standby') : secs(ms);
      text(label, W / 2, 120 * S, game.phase === 'standby' ? 44 : 84, game.phase === 'standby' ? C.faint : C.timer, 'center', 700);
    } else {
      text(t('groupingGo'), W / 2, 120 * S, 36, C.faint, 'center', 600);
    }

    // Splits along the right side (timer, bill, presidente)
    if (['timer', 'bill', 'presidente'].includes(game.drill) && game.shots.length) {
      game.shots.slice(-12).forEach((s, i, arr) => {
        const idx = game.shots.length - arr.length + i;
        const split = idx === 0 ? s.t : s.t - game.shots[idx - 1].t;
        text(`${idx + 1}.  ${secs(split)}`, W - 40 * S, 110 * S + i * 34 * S, 22, s.target !== null ? C.text : C.dim, 'right');
      });
    }

    // Short notes: false start, miss, too slow…
    if (game.note && now < game.note.until) {
      const a = (game.note.until - now) / 1200;
      text(t(game.note.key), W / 2, H - 80 * S, 40, rgba(game.note.color, a), 'center', 700);
    }
  }

  function drawButton(b) {
    const hot = game.hover && game.hover.x >= b.x && game.hover.x <= b.x + b.w && game.hover.y >= b.y && game.hover.y <= b.y + b.h;
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = hot ? C.panelHot : C.panelEdge;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14 * S);
    ctx.fill();
    ctx.stroke();
    const cx = b.x + b.w / 2;
    if (b.small) {
      text(b.label, cx, b.y + b.h * 0.38, 28, C.text, 'center', 600);
      text(b.sub, cx, b.y + b.h * 0.7, 19, C.dim);
      return;
    }
    text(b.label, cx, b.y + b.h * (b.sub ? 0.32 : 0.5), 36, C.text, 'center', 600);
    if (b.sub) text(b.sub, cx, b.y + b.h * 0.56, 19, C.dim);
    if (b.extra) text(b.extra, cx, b.y + b.h * 0.79, 19, C.dim);
  }

  function layoutMenu() {
    const gap = 26 * S;
    const full = Math.min(1180 * S, W - 100 * S);
    const bw = (full - 2 * gap) / 3;
    const bh = 170 * S;
    const x0 = (W - full) / 2;
    const y0 = H * 0.27;
    game.buttons = DRILL_ORDER.map((id, i) => {
      const best = bestOf(loadHistory(id));
      return {
        id,
        label: t(`drill.${id}`),
        sub: t(`drill.${id}.sub`),
        extra: best !== null ? t('best', { v: fmtPrimary(id, best) }) : t('noBest'),
        x: x0 + (i % 3) * (bw + gap),
        y: y0 + Math.floor(i / 3) * (bh + gap),
        w: bw,
        h: bh,
      };
    });
    const rowY = y0 + 2 * (bh + gap);
    const rowH = 100 * S;
    const half = (full - gap) / 2;
    if (Gunshots) {
      game.buttons.push({ id: 'sound', label: t('sound', { name: Gunshots.nameOf(shotSound, lang) }), sub: t('soundSub'), x: x0, y: rowY, w: half, h: rowH, small: true });
    }
    game.buttons.push({ id: 'lang', label: t('language'), sub: t('languageSub'), x: Gunshots ? x0 + half + gap : x0, y: rowY, w: Gunshots ? half : full, h: rowH, small: true });
  }

  function layoutResults() {
    const bw = 300 * S;
    const bh = 100 * S;
    const gap = 32 * S;
    const y = H * 0.8;
    game.buttons = [
      { id: 'again', label: t('again'), x: W / 2 - bw - gap / 2, y, w: bw, h: bh },
      { id: 'menu', label: t('menu'), x: W / 2 + gap / 2, y, w: bw, h: bh },
    ];
  }

  function drawMenu() {
    layoutMenu();
    text(t('title'), W / 2, H * 0.11, 80, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.11 + 74 * S, 26, C.dim);
    game.buttons.forEach(drawButton);
    text(t('footer'), W / 2, H - 36 * S, 19, C.faint);
  }

  /** The trend of the last runs as a thin line (lower is better, so lower = higher up). */
  function drawTrend(values, x, y, w, h) {
    if (values.length < 2) return;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    values.forEach((v, i) => {
      const px = x + (i / (values.length - 1)) * w;
      const py = y + ((v - lo) / span) * h;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
    // The latest run as a small hollow ring
    const lx = x + w;
    const ly = y + ((values[values.length - 1] - lo) / span) * h;
    ctx.strokeStyle = C.text;
    ctx.beginPath();
    ctx.arc(lx, ly, 6 * S, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawResults() {
    layoutResults();
    const id = game.drill;
    const r = game.result;
    text(t(`drill.${id}`), W / 2, H * 0.09, 32, C.dim);
    if (r.primary !== null) {
      text(fmtPrimary(id, r.primary), W / 2, H * 0.19, 100, C.text, 'center', 700);
      text(t(`primary.${id}`), W / 2, H * 0.19 + 70 * S, 24, C.dim);
      text(r.newBest ? t('newBest') : t('pb', { v: fmtPrimary(id, r.best) }), W / 2, H * 0.19 + 110 * S, 26, r.newBest ? rgba(C.hit, 1) : C.faint, 'center', 600);
    } else {
      text(t('noResult'), W / 2, H * 0.21, 44, C.dim, 'center', 700);
    }

    const y0 = H * 0.43;
    r.rows.forEach(([k, v], i) => {
      const y = y0 + i * 40 * S;
      text(k, W / 2 - 20 * S, y, 25, C.dim, 'right');
      text(v, W / 2 + 20 * S, y, 25, C.text, 'left', 600);
    });

    if (r.history && r.history.length >= 2) {
      const w = 360 * S;
      const h = 60 * S;
      const ty = H * 0.43 + r.rows.length * 40 * S + 30 * S;
      text(t('trend', { n: r.history.length }), W / 2, ty, 18, C.faint);
      drawTrend(r.history, W / 2 - w / 2, ty + 20 * S, w, h);
    }
    game.buttons.forEach(drawButton);
  }

  // ---------- Main loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last);
    last = now;
    update(dt);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (game.scene === 'menu') drawMenu();
    else if (game.scene === 'play') drawPlay(now);
    else drawResults();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // For automated tests
  window.__game = game;
  window.__lang = () => lang;
  window.__goNow = () => { if (game.phase === 'standby') game.timer = 0; };
  window.__targets = () => DRILLS[game.drill].targets.map(targetPx);
})();
