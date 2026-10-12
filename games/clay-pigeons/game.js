// Clay Pigeons – clays thrown in an arc, like the real thing.
//
// Three disciplines:
//  - Trap:     clays fly away from the shooter and shrink with distance
//  - Skeet:    crossing clays from a high house (left) and a low house (right),
//              with doubles every fifth throw
//  - Sporting: a mix of trap and skeet clays, doubles, tower clays dropping
//              from above and "rabbits" bouncing along the ground
//
// 25 clays per round and two shots per throw, as with a double-barrelled
// shotgun. The score is the number of clays broken, as in real clay shooting.
//
// The game reacts to ordinary mouse clicks, so it works with a mouse as well
// as with Laser Mouse (where the laser becomes a click).
//
// Release ("pull"): automatic after a random delay – long enough to break
// open and reload a laser training cartridge – or by calling "Pull!" into
// the microphone.
//
// Design rules for projector + webcam:
//  - dark sky, muted colours and a LOW red channel (the clays peak at R ≈ 125,
//    the laser detector's threshold is 170)
//  - no small bright dots – the scorecard and markers are dim
//
// Language: Swedish by default, English available. The language comes from
// ?lang=sv|en (set by Laser Mouse), otherwise from the last choice in the menu.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const CLAYS_PER_ROUND = 25;
  const SHOTS_PER_THROW = 2;

  // ---------- Texts ----------

  const STRINGS = {
    sv: {
      title: 'Lerduvor',
      subtitle: 'Skjut på ett val för att börja',
      footer: '25 duvor per serie · två skott per kast · Esc avslutar · F helskärm',
      'mode.trap': 'Trap',
      'mode.trap.sub': 'Duvorna flyger ifrån dig',
      'mode.skeet': 'Skeet',
      'mode.skeet.sub': 'Korsande duvor från två torn',
      'mode.sporting': 'Sporting',
      'mode.sporting.sub': 'Dubbletter, tornduvor och harar',
      best: 'Rekord: {n}/25',
      noBest: 'Inget rekord än',
      newBest: 'Nytt rekord!',
      sound: 'Skottljud: {name}',
      soundSub: 'Skjut här för att byta',
      'release.auto': 'Utkast: Automatiskt',
      'release.voice': 'Utkast: Ropa "Pull!"',
      releaseSub: 'Skjut här för att byta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      clay: 'Duva {n} av {total}',
      ready: 'Gör dig redo…',
      callPull: 'Ropa "Pull!"',
      micDenied: 'Mikrofonen gick inte att använda – automatiskt utkast',
      hit: 'Träff!',
      smoked: 'Rökboll!',
      lost: 'Miss',
      double: 'Dubblett!',
      score: '{n} av {total}',
      'row.first': 'Träff på första skottet',
      'row.second': 'Träff på andra skottet',
      'row.smoked': 'Rökbollar',
      'row.run': 'Längsta serie i rad',
      'row.shots': 'Skott totalt',
      'rate.25': 'Full serie – 25 av 25!',
      'rate.22': 'Mycket bra skjutet!',
      'rate.18': 'Bra skjutet!',
      'rate.12': 'Godkänt – det sitter snart',
      'rate.0': 'Fortsätt träna – håll svingen igenom',
      again: 'Skjut igen',
      menu: 'Meny',
    },
    en: {
      title: 'Clay Pigeons',
      subtitle: 'Shoot a choice to start',
      footer: '25 clays per round · two shots per throw · Esc quits · F full screen',
      'mode.trap': 'Trap',
      'mode.trap.sub': 'Clays fly away from you',
      'mode.skeet': 'Skeet',
      'mode.skeet.sub': 'Crossing clays from two houses',
      'mode.sporting': 'Sporting',
      'mode.sporting.sub': 'Doubles, towers and rabbits',
      best: 'Best: {n}/25',
      noBest: 'No record yet',
      newBest: 'New record!',
      sound: 'Gunshot: {name}',
      soundSub: 'Shoot here to change',
      'release.auto': 'Release: Automatic',
      'release.voice': 'Release: Call "Pull!"',
      releaseSub: 'Shoot here to change',
      language: 'English',
      languageSub: 'Skjut för svenska',
      clay: 'Clay {n} of {total}',
      ready: 'Get ready…',
      callPull: 'Call "Pull!"',
      micDenied: 'Microphone unavailable – automatic release',
      hit: 'Hit!',
      smoked: 'Smoked!',
      lost: 'Lost',
      double: 'Double!',
      score: '{n} of {total}',
      'row.first': 'Hits with the first shot',
      'row.second': 'Hits with the second shot',
      'row.smoked': 'Smoked',
      'row.run': 'Longest run',
      'row.shots': 'Shots fired',
      'rate.25': 'Straight – 25 out of 25!',
      'rate.22': 'Excellent shooting!',
      'rate.18': 'Good shooting!',
      'rate.12': 'Fair – it is coming together',
      'rate.0': 'Keep practising – follow through',
      again: 'Shoot again',
      menu: 'Menu',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'clay-pigeons:lang';
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
    skyTop: '#05070a',
    skyBottom: '#0b1219',
    ground: '#080b0e',
    horizon: '#1b2733',
    house: '#111a22',
    houseEdge: '#1f2e3a',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    // Clays: muted orange with a low red channel (≤ 125)
    clayTop: '#7d5a40',
    clayBody: '#6a4630',
    clayRim: '#3a271b',
    dust: [70, 78, 86],
    pattern: [90, 120, 140], // the shot pattern ring
    hit: [70, 170, 120], // muted green
    lost: [120, 110, 110],
    shell: '#3b4a56',
    shellUsed: '#151d24',
  };

  // ---------- Helpers ----------

  let W = 0, H = 0, S = 1;
  let groundY = 0, horizonY = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H) / 1080;
    groundY = H * 0.86;
    horizonY = H * 0.62;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const bestKey = (m) => `clay-pigeons:best:${m}`;
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

  function beep(freq, dur, { type = 'sine', gain = 0.15, at = 0, to = null } = {}) {
    try {
      const a = ac();
      const t0 = a.currentTime + at;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch { /* no sound */ }
  }

  let noiseBuf = null;
  function noise(dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.2, at = 0 } = {}) {
    try {
      const a = ac();
      if (!noiseBuf) {
        noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = a.currentTime + at;
      const src = a.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = a.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(a.destination);
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + dur + 0.05);
    } catch { /* no sound */ }
  }

  // Gunshot sound (games/shared/gunshots.js). The choice is saved.
  const Gunshots = window.Gunshots;
  const guns = Gunshots ? new Gunshots(ac) : null;
  const SOUND_KEY = 'clay-pigeons:shotSound';
  let shotSound = store.get(SOUND_KEY) || 'shotgun';
  let lastGunshotAt = 0;
  const fire = () => {
    lastGunshotAt = performance.now();
    if (guns) guns.play(shotSound);
  };

  const sfx = {
    // The trap machine: a low thump and the whoosh of the throwing arm
    launch: () => {
      beep(90, 0.12, { gain: 0.25, to: 50 });
      noise(0.35, { f0: 900, f1: 250, q: 0.8, gain: 0.12, at: 0.02 });
    },
    // A clay breaking: a short, sharp crack slightly after the shot
    break: (smoked) => {
      noise(smoked ? 0.18 : 0.1, { type: 'highpass', f0: 2600, f1: 1800, gain: 0.25, at: 0.06 });
      beep(1400, 0.05, { type: 'triangle', gain: 0.08, at: 0.06 });
    },
    // A clay landing in the grass
    land: () => noise(0.12, { type: 'lowpass', f0: 400, f1: 150, gain: 0.08 }),
    ready: () => beep(520, 0.08, { gain: 0.08 }),
    end: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { at: i * 0.11 })),
  };

  // ---------- Microphone release ("Pull!") ----------

  const RELEASE_KEY = 'clay-pigeons:release';
  let release = store.get(RELEASE_KEY) === 'voice' ? 'voice' : 'auto';
  const mic = { stream: null, analyser: null, data: null, level: 0, loud: 0, failed: false };

  async function startMic() {
    if (mic.analyser || mic.failed) return;
    try {
      mic.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const a = ac();
      const src = a.createMediaStreamSource(mic.stream);
      mic.analyser = a.createAnalyser();
      mic.analyser.fftSize = 1024;
      mic.data = new Float32Array(mic.analyser.fftSize);
      src.connect(mic.analyser);
    } catch (e) {
      console.warn('Microphone unavailable', e);
      mic.failed = true;
    }
  }

  function stopMic() {
    if (mic.stream) mic.stream.getTracks().forEach((tr) => tr.stop());
    mic.stream = null;
    mic.analyser = null;
  }

  /** True when the shooter calls "Pull!" (a loud sound for a few frames). */
  function micCalled() {
    if (!mic.analyser) return false;
    mic.analyser.getFloatTimeDomainData(mic.data);
    let sum = 0;
    for (let i = 0; i < mic.data.length; i++) sum += mic.data[i] * mic.data[i];
    mic.level = Math.sqrt(sum / mic.data.length);
    // Ignore our own gunshot sound for a moment
    if (performance.now() - lastGunshotAt < 900) {
      mic.loud = 0;
      return false;
    }
    mic.loud = mic.level > 0.08 ? mic.loud + 1 : 0;
    return mic.loud >= 3;
  }

  // ---------- Clays ----------

  const BASE_R = 24; // clay radius at scale 1 (before S)
  const PATTERN = 30; // shot pattern radius added to the clay (before S)
  const GRAVITY = 520; // px/s² at S = 1

  /** Width of the skeet houses (the clays come out of their openings). */
  const houseWidth = () => Math.max(48 * S, W * 0.045);

  /** Creates one clay of a given kind. Positions in screen pixels. */
  function makeClay(kind) {
    const g = GRAVITY * S;
    const c = {
      kind,
      age: 0,
      spin: rand(0, Math.PI * 2),
      spinRate: rand(10, 18) * (Math.random() < 0.5 ? -1 : 1),
      broken: false,
      gone: false,
      result: null, // 'first' | 'second' | null
      g,
      drag: 0,
      s0: 1,
      s1: 1,
      dur: 2,
      landY: groundY,
    };
    if (kind === 'trap') {
      // Out of the trap house in front of the shooter, away and up, shrinking
      const apex = rand(0.2, 0.34) * H;
      c.x = W / 2 + rand(-20, 20) * S;
      c.y = groundY - 8 * S;
      c.vy = -Math.sqrt(2 * g * (c.y - apex));
      c.vx = rand(-0.28, 0.28) * W;
      c.s0 = 1.0;
      c.s1 = 0.38;
      c.dur = 2.4;
      c.drag = 0.35;
      c.landY = horizonY + 10 * S;
    } else if (kind === 'skeetHigh') {
      // From the high house on the left, crossing to the right
      c.x = W * 0.06 + houseWidth() / 2;
      c.y = H * 0.3;
      c.vx = rand(0.36, 0.44) * W;
      c.vy = -rand(60, 160) * S;
      c.s0 = c.s1 = 0.8;
    } else if (kind === 'skeetLow') {
      // From the low house on the right, rising and crossing to the left
      c.x = W * 0.94 - houseWidth() / 2;
      c.y = groundY - 40 * S;
      c.vx = -rand(0.36, 0.44) * W;
      c.vy = -rand(420, 520) * S;
      c.s0 = c.s1 = 0.8;
    } else if (kind === 'tower') {
      // Dropped from a tall tower: comes in from above and falls slowly
      c.x = rand(0.25, 0.75) * W;
      c.y = -30 * S;
      c.vx = rand(-0.12, 0.12) * W;
      c.vy = rand(80, 140) * S;
      c.g = g * 0.45;
      c.s0 = 0.9;
      c.s1 = 1.0;
    } else if (kind === 'rabbit') {
      // A rabbit rolls and bounces along the ground
      const fromLeft = Math.random() < 0.5;
      c.x = fromLeft ? -30 * S : W + 30 * S;
      c.y = groundY - BASE_R * S;
      c.vx = (fromLeft ? 1 : -1) * rand(0.24, 0.32) * W;
      c.vy = 0;
      c.s0 = c.s1 = 1.0;
    }
    return c;
  }

  function clayScale(c) {
    return c.s0 + (c.s1 - c.s0) * Math.min(1, c.age / c.dur);
  }

  function updateClay(c, dt) {
    c.age += dt;
    c.spin += c.spinRate * dt;
    if (c.drag) {
      const k = Math.exp(-c.drag * dt);
      c.vx *= k;
    }
    if (c.kind === 'rabbit') {
      c.x += c.vx * dt;
      c.vy += c.g * dt;
      c.y += c.vy * dt;
      const floor = groundY - BASE_R * S * 0.9;
      if (c.y > floor) {
        c.y = floor;
        c.vy = Math.random() < 0.35 ? -rand(180, 320) * S : 0; // an occasional hop
      }
      c.gone = c.x < -60 * S || c.x > W + 60 * S;
      return;
    }
    c.vy += c.g * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.vy > 0 && c.y >= c.landY) {
      c.gone = true;
      c.landed = true;
    }
    if (c.x < -80 * S || c.x > W + 80 * S) c.gone = true;
  }

  function drawClay(c) {
    const s = clayScale(c) * S;
    const r = BASE_R * s;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.kind === 'rabbit') {
      // Rabbits roll on their edge
      const squash = 0.35 + 0.25 * Math.abs(Math.sin(c.spin * 0.3));
      ctx.fillStyle = C.clayBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * squash, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.clayRim;
      ctx.lineWidth = 2 * S;
      ctx.stroke();
    } else {
      // A flying clay is seen as a flat dome: a squashed ellipse with a lighter top
      const squash = 0.42 + 0.06 * Math.sin(c.spin);
      ctx.rotate(Math.atan2(c.vy, c.vx) * 0.15);
      ctx.fillStyle = C.clayRim;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.12, r, r * squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.clayBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.clayTop;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.05, r * 0.55, r * squash * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Effects ----------

  const effects = [];

  function addBreak(c, smoked) {
    const s = clayScale(c) * S;
    const n = smoked ? 22 : 9;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(80, smoked ? 340 : 240) * s;
      effects.push({
        type: smoked ? 'dust' : 'shard',
        x: c.x,
        y: c.y,
        vx: c.vx * 0.4 + Math.cos(a) * v,
        vy: c.vy * 0.4 + Math.sin(a) * v - 60 * s,
        rot: rand(0, Math.PI),
        vr: rand(-12, 12),
        size: rand(4, smoked ? 10 : 9) * s,
        age: 0,
        life: rand(0.7, 1.3),
      });
    }
    effects.push({ type: 'puff', x: c.x, y: c.y, r: (smoked ? 46 : 28) * s, age: 0, life: smoked ? 1.0 : 0.6 });
  }

  function addPattern(x, y, r) {
    effects.push({ type: 'pattern', x, y, r, age: 0, life: 0.9 });
  }

  function addLabel(str, x, y, color) {
    effects.push({ type: 'label', str, x, y, color, age: 0, life: 1.1 });
  }

  function updateEffects(dt) {
    for (const e of effects) {
      e.age += dt;
      if (e.type === 'shard' || e.type === 'dust') {
        e.vy += GRAVITY * S * 0.8 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
      }
    }
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].age >= effects[i].life) effects.splice(i, 1);
  }

  function drawEffects() {
    for (const e of effects) {
      const p = e.age / e.life;
      const a = 1 - p;
      if (e.type === 'shard') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = C.clayBody;
        ctx.beginPath();
        ctx.moveTo(-e.size, -e.size * 0.4);
        ctx.lineTo(e.size, -e.size * 0.2);
        ctx.lineTo(e.size * 0.2, e.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (e.type === 'dust') {
        ctx.fillStyle = rgba(C.dust, a * 0.6);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 + p), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'puff') {
        ctx.fillStyle = rgba(C.dust, a * 0.35);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (0.6 + p), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'pattern') {
        // Where the shot pattern went – thin and dim, so you can read your lead
        ctx.strokeStyle = rgba(C.pattern, a * 0.55);
        ctx.lineWidth = 1.5 * S;
        ctx.setLineDash([4 * S, 5 * S]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (e.type === 'label') {
        text(e.str, e.x, e.y - p * 40 * S, 40, rgba(e.color, a), 'center', 700);
      }
    }
  }

  // ---------- Game state ----------

  const MODES = ['trap', 'skeet', 'sporting'];

  const game = {
    scene: 'menu', // 'menu' | 'play' | 'results'
    phase: 'ready', // within play: 'ready' | 'flight' | 'result'
    mode: 'trap',
    throws: [], // planned throws: arrays of clay kinds
    throwIndex: 0,
    claysThrown: 0,
    clays: [], // clays of the current throw
    shotsLeft: SHOTS_PER_THROW,
    timer: 0,
    card: [], // per clay: 'first' | 'second' | null
    stats: null,
    buttons: [],
    newBest: false,
    hover: null,
    micNote: false,
  };

  /** Plans the throws of a round: 25 clays in singles and doubles. */
  function planRound(mode) {
    const throws = [];
    let clays = 0;
    let n = 0;
    while (clays < CLAYS_PER_ROUND) {
      n++;
      const left = CLAYS_PER_ROUND - clays;
      let th;
      if (mode === 'trap') {
        th = ['trap'];
      } else if (mode === 'skeet') {
        // Every fifth throw is a double from both houses
        th = n % 5 === 0 && left >= 2 ? ['skeetHigh', 'skeetLow'] : [n % 2 ? 'skeetHigh' : 'skeetLow'];
      } else {
        const single = pick(['trap', 'skeetHigh', 'skeetLow', 'tower', 'rabbit', 'tower', 'trap']);
        th = Math.random() < 0.3 && left >= 2 ? [single, pick(['trap', 'skeetHigh', 'skeetLow', 'rabbit'].filter((k) => k !== single))] : [single];
      }
      throws.push(th);
      clays += th.length;
    }
    return throws;
  }

  function newStats() {
    return { first: 0, second: 0, smoked: 0, shots: 0, run: 0, bestRun: 0 };
  }

  function startRound(mode) {
    game.mode = mode;
    game.scene = 'play';
    game.throws = planRound(mode);
    game.throwIndex = 0;
    game.claysThrown = 0;
    game.card = [];
    game.stats = newStats();
    game.clays = [];
    effects.length = 0;
    game.micNote = false;
    if (release === 'voice') startMic();
    toReady(1.6);
  }

  function toReady(delay) {
    game.phase = 'ready';
    game.clays = [];
    game.shotsLeft = SHOTS_PER_THROW;
    // Auto release: a random delay, long enough to reload a laser cartridge
    game.timer = delay !== undefined ? delay : rand(2.4, 3.6);
    game.readyBeeped = false;
  }

  function launch() {
    const kinds = game.throws[game.throwIndex];
    game.clays = kinds.map(makeClay);
    game.phase = 'flight';
    game.shotsLeft = SHOTS_PER_THROW;
    sfx.launch();
  }

  function finishThrow() {
    const st = game.stats;
    let hits = 0;
    for (const c of game.clays) {
      game.card.push(c.result);
      if (c.result) {
        hits++;
        st.run++;
        st.bestRun = Math.max(st.bestRun, st.run);
      } else {
        st.run = 0;
      }
    }
    game.claysThrown += game.clays.length;
    game.throwIndex++;
    if (game.clays.length === 2 && hits === 2) addLabel(t('double'), W / 2, H * 0.3, C.hit);
    else if (hits === 0) addLabel(t('lost'), W / 2, H * 0.3, C.lost);

    game.phase = 'result';
    game.timer = 0.9;
  }

  function endRound() {
    game.scene = 'results';
    const hits = game.card.filter(Boolean).length;
    const best = getBest(game.mode);
    game.newBest = hits > best;
    if (game.newBest) store.set(bestKey(game.mode), String(hits));
    sfx.end();
  }

  function toMenu() {
    game.scene = 'menu';
    game.clays = [];
    effects.length = 0;
    stopMic();
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
      if (b.id === 'lang') toggleLang();
      else if (b.id === 'release') {
        release = release === 'auto' ? 'voice' : 'auto';
        store.set(RELEASE_KEY, release);
        mic.failed = false;
      } else if (b.id === 'menu') toMenu();
      else if (b.id === 'again') startRound(game.mode);
      else startRound(b.id);
      return;
    }

    fire();
    // Only shots while clays are in the air count
    if (game.scene !== 'play' || game.phase !== 'flight' || game.shotsLeft <= 0) return;

    const st = game.stats;
    st.shots++;
    const shotNo = SHOTS_PER_THROW - game.shotsLeft + 1;
    game.shotsLeft--;

    // The nearest unbroken clay inside the shot pattern breaks
    let best = null;
    let bestD = Infinity;
    for (const c of game.clays) {
      if (c.broken || c.gone) continue;
      const r = BASE_R * clayScale(c) * S;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d <= r + PATTERN * S && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    addPattern(x, y, (PATTERN + BASE_R * 0.6) * S);

    if (best) {
      const r = BASE_R * clayScale(best) * S;
      const smoked = bestD <= r * 0.6;
      best.broken = true;
      best.result = shotNo === 1 ? 'first' : 'second';
      if (shotNo === 1) st.first++;
      else st.second++;
      if (smoked) st.smoked++;
      addBreak(best, smoked);
      addLabel(smoked ? t('smoked') : t('hit'), best.x, best.y - 40 * S, C.hit);
      sfx.break(smoked);
    }
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

  // ---------- Update ----------

  function update(dt) {
    updateEffects(dt);
    if (game.scene !== 'play') return;

    if (game.phase === 'ready') {
      if (release === 'voice' && !mic.failed) {
        if (micCalled()) launch();
        return;
      }
      if (release === 'voice' && mic.failed) game.micNote = true;
      game.timer -= dt;
      if (!game.readyBeeped && game.timer < 0.9) {
        game.readyBeeped = true;
        sfx.ready();
      }
      if (game.timer <= 0) launch();
    } else if (game.phase === 'flight') {
      for (const c of game.clays) {
        if (c.broken || c.gone) continue;
        updateClay(c, dt);
        if (c.landed) sfx.land();
      }
      const flying = game.clays.some((c) => !c.broken && !c.gone);
      if (!flying) finishThrow();
    } else if (game.phase === 'result') {
      game.timer -= dt;
      if (game.timer <= 0) {
        if (game.throwIndex >= game.throws.length) endRound();
        else toReady();
      }
    }
  }

  // ---------- Drawing ----------

  function drawScene() {
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, C.skyTop);
    sky.addColorStop(1, C.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, horizonY, W, H - horizonY);
    ctx.strokeStyle = C.horizon;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(W, horizonY);
    ctx.stroke();

    // A low tree line on the horizon
    ctx.fillStyle = '#0a1016';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= W; x += 40 * S) {
      ctx.lineTo(x, horizonY - (14 + 10 * Math.abs(Math.sin(x * 0.013) + Math.sin(x * 0.031))) * S);
    }
    ctx.lineTo(W, horizonY);
    ctx.closePath();
    ctx.fill();

    // Throwing houses for the current discipline
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = C.houseEdge;
    ctx.fillStyle = C.house;
    if (game.mode === 'trap' || game.mode === 'sporting') {
      // Trap bunker in front of the shooter
      ctx.fillRect(W / 2 - 70 * S, groundY - 14 * S, 140 * S, 24 * S);
      ctx.strokeRect(W / 2 - 70 * S, groundY - 14 * S, 140 * S, 24 * S);
    }
    if (game.mode === 'skeet' || game.mode === 'sporting') {
      /** A skeet house: walls, a pitched roof and the opening the clay comes out of. */
      const house = (x, top, w, bottom, slotY, slotOnRight) => {
        ctx.fillStyle = C.house;
        ctx.strokeStyle = C.houseEdge;
        ctx.beginPath();
        ctx.moveTo(x - 6 * S, top);
        ctx.lineTo(x + w / 2, top - 22 * S);
        ctx.lineTo(x + w + 6 * S, top);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(x, top, w, bottom - top);
        ctx.strokeRect(x, top, w, bottom - top);
        // The opening, on the side facing the field
        ctx.fillStyle = '#05080b';
        const sx = slotOnRight ? x + w - 14 * S : x;
        ctx.fillRect(sx, slotY - 9 * S, 14 * S, 18 * S);
      };
      const hw = houseWidth();
      house(W * 0.06 - hw / 2, H * 0.3 - 30 * S, hw, groundY, H * 0.3, true); // high house (left)
      house(W * 0.94 - hw / 2, groundY - 70 * S, hw, groundY, groundY - 40 * S, false); // low house (right)
    }
  }

  function drawHud() {
    const y = 54 * S;
    const hits = game.card.filter(Boolean).length;
    const n = Math.min(CLAYS_PER_ROUND, game.claysThrown + (game.phase === 'flight' ? 1 : game.phase === 'ready' ? 1 : 0));
    text(t('clay', { n: Math.max(1, n), total: CLAYS_PER_ROUND }), 40 * S, y, 32, C.dim, 'left', 600);
    text(String(hits), W / 2, y, 56, C.text, 'center', 700);

    // Shells left in the gun
    for (let i = 0; i < SHOTS_PER_THROW; i++) {
      ctx.fillStyle = i < game.shotsLeft ? C.shell : C.shellUsed;
      ctx.beginPath();
      ctx.roundRect(W - (60 + i * 34) * S, y - 22 * S, 22 * S, 44 * S, 5 * S);
      ctx.fill();
    }

    // Scorecard along the bottom: one box per clay
    const box = Math.min(26 * S, (W - 80 * S) / CLAYS_PER_ROUND - 6 * S);
    const gap = 6 * S;
    const total = CLAYS_PER_ROUND * box + (CLAYS_PER_ROUND - 1) * gap;
    let x = (W - total) / 2;
    const by = groundY + (H - groundY) / 2 - box / 2;
    for (let i = 0; i < CLAYS_PER_ROUND; i++) {
      const r = game.card[i];
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1.5 * S;
      ctx.strokeRect(x, by, box, box);
      if (r) {
        ctx.fillStyle = rgba(C.hit, 0.55);
        ctx.fillRect(x + 3 * S, by + 3 * S, box - 6 * S, box - 6 * S);
      } else if (i < game.card.length) {
        ctx.strokeStyle = rgba(C.lost, 0.6);
        ctx.beginPath();
        ctx.moveTo(x + 5 * S, by + 5 * S);
        ctx.lineTo(x + box - 5 * S, by + box - 5 * S);
        ctx.moveTo(x + box - 5 * S, by + 5 * S);
        ctx.lineTo(x + 5 * S, by + box - 5 * S);
        ctx.stroke();
      }
      x += box + gap;
    }
  }

  function drawReady() {
    if (game.phase !== 'ready') return;
    if (release === 'voice' && !mic.failed) {
      text(t('callPull'), W / 2, H * 0.4, 48, C.dim, 'center', 700);
      // Microphone level, so you can see that it hears you
      const w = 260 * S;
      const lv = Math.min(1, mic.level / 0.12);
      ctx.fillStyle = C.faint;
      ctx.fillRect(W / 2 - w / 2, H * 0.4 + 44 * S, w, 6 * S);
      ctx.fillStyle = C.dim;
      ctx.fillRect(W / 2 - w / 2, H * 0.4 + 44 * S, w * lv, 6 * S);
    } else {
      text(t('ready'), W / 2, H * 0.4, 40, C.faint, 'center', 600);
      if (game.micNote) text(t('micDenied'), W / 2, H * 0.4 + 50 * S, 22, C.faint);
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
    text(b.label, cx, b.y + b.h * (b.sub ? 0.34 : 0.5), 40, C.text, 'center', 600);
    if (b.sub) text(b.sub, cx, b.y + b.h * 0.58, 21, C.dim);
    if (b.extra) text(b.extra, cx, b.y + b.h * 0.8, 20, C.dim);
  }

  function layoutMenu() {
    const gap = 28 * S;
    const full = Math.min(1180 * S, W - 100 * S);
    const bw = (full - 2 * gap) / 3;
    const bh = 200 * S;
    const x0 = (W - full) / 2;
    const y0 = H * 0.32;
    game.buttons = MODES.map((id, i) => {
      const best = getBest(id);
      return {
        id,
        label: t(`mode.${id}`),
        sub: t(`mode.${id}.sub`),
        extra: best ? t('best', { n: best }) : t('noBest'),
        x: x0 + i * (bw + gap),
        y: y0,
        w: bw,
        h: bh,
      };
    });
    const rowY = y0 + bh + gap;
    const rowH = 110 * S;
    const items = [];
    if (Gunshots) items.push({ id: 'sound', label: t('sound', { name: Gunshots.nameOf(shotSound, lang) }), sub: t('soundSub') });
    items.push({ id: 'release', label: t(`release.${release}`), sub: t('releaseSub') });
    items.push({ id: 'lang', label: t('language'), sub: t('languageSub') });
    const iw = (full - (items.length - 1) * gap) / items.length;
    items.forEach((it, i) => game.buttons.push({ ...it, x: x0 + i * (iw + gap), y: rowY, w: iw, h: rowH, small: true }));
  }

  function layoutResults() {
    const bw = 300 * S;
    const bh = 110 * S;
    const gap = 32 * S;
    const y = H * 0.76;
    game.buttons = [
      { id: 'again', label: t('again'), x: W / 2 - bw - gap / 2, y, w: bw, h: bh },
      { id: 'menu', label: t('menu'), x: W / 2 + gap / 2, y, w: bw, h: bh },
    ];
  }

  function drawMenu() {
    layoutMenu();
    text(t('title'), W / 2, H * 0.13, 84, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.13 + 80 * S, 28, C.dim);
    game.buttons.forEach(drawButton);
    text(t('footer'), W / 2, H - 40 * S, 20, C.faint);
  }

  function rating(hits) {
    if (hits >= 25) return t('rate.25');
    if (hits >= 22) return t('rate.22');
    if (hits >= 18) return t('rate.18');
    if (hits >= 12) return t('rate.12');
    return t('rate.0');
  }

  function drawResults() {
    layoutResults();
    const st = game.stats;
    const hits = game.card.filter(Boolean).length;
    text(t(`mode.${game.mode}`), W / 2, H * 0.1, 32, C.dim);
    text(t('score', { n: hits, total: CLAYS_PER_ROUND }), W / 2, H * 0.21, 110, C.text, 'center', 700);
    text(rating(hits), W / 2, H * 0.21 + 84 * S, 30, C.dim, 'center', 600);
    text(game.newBest ? t('newBest') : t('best', { n: getBest(game.mode) }), W / 2, H * 0.21 + 128 * S, 26, game.newBest ? rgba(C.hit, 1) : C.faint, 'center', 600);

    const rows = [
      [t('row.first'), `${st.first}`],
      [t('row.second'), `${st.second}`],
      [t('row.smoked'), `${st.smoked}`],
      [t('row.run'), `${st.bestRun}`],
      [t('row.shots'), `${st.shots}`],
    ];
    const y0 = H * 0.46;
    rows.forEach(([k, v], i) => {
      const y = y0 + i * 42 * S;
      text(k, W / 2 - 20 * S, y, 27, C.dim, 'right');
      text(v, W / 2 + 20 * S, y, 27, C.text, 'left', 600);
    });
    game.buttons.forEach(drawButton);
  }

  // ---------- Main loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);

    if (game.scene === 'menu') {
      ctx.fillStyle = C.skyTop;
      ctx.fillRect(0, 0, W, H);
      drawMenu();
    } else if (game.scene === 'play') {
      drawScene();
      for (const c of game.clays) if (!c.broken && !c.gone) drawClay(c);
      drawEffects();
      drawHud();
      drawReady();
    } else {
      ctx.fillStyle = C.skyTop;
      ctx.fillRect(0, 0, W, H);
      drawResults();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // For automated tests
  window.__game = game;
  window.__lang = () => lang;
  window.__launchNow = () => { if (game.phase === 'ready') game.timer = 0; };
})();
