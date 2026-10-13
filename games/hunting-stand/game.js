// Hunting Stand – animals pass your stand and you decide: shoot or let go.
//
// This is not only about hitting. Every encounter is judged by good hunting
// ethics, and an unsafe shot costs more than a miss:
//  - Clear line of fire: no branches, no vegetation hiding the animal
//  - Safe backstop: no rock behind (ricochet), no ridge/sky behind, no
//    fellow hunter or building in the line of fire
//  - Young first: shoot the calf/fawn before the cow/doe, never the mother
//    first (she may have a calf you cannot see yet). A sow with piglets is
//    spared completely.
//  - Identify the target: a hunting dog and a protected crane look a lot
//    like a fox and a duck
//  - Aim behind the shoulder (heart and lungs). A bad hit is a wounded animal
//
// Letting a bad situation pass earns points. Hitting nothing is not a sin.
//
// The game reacts to ordinary mouse clicks, so it works with a mouse as well
// as with Laser Mouse (where the laser becomes a click).
//
// Design rules for projector + webcam:
//  - dark dusk forest, muted colours and a LOW red channel (nothing above
//    R ≈ 125; the laser detector's threshold is 170)
//  - no small bright dots – markers are dim, bad outcomes use a muted amber
//
// Language: Swedish by default, English available. The language comes from
// ?lang=sv|en (set by Laser Mouse), otherwise from the last choice in the menu.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ENCOUNTERS = 10;
  const POINTS = { clean: 10, still: 3, hold: 5, wound: -5, unsafe: -10 };

  // ---------- Texts ----------

  const STRINGS = {
    sv: {
      title: 'Jaktpasset',
      subtitle: 'Skjut på ett val för att börja',
      footer: '10 möten per pass · Esc avslutar · F helskärm',
      'rule.1': 'Sikta bakom bogen – hjärta och lungor. Huvud och buk ger skadskjutning.',
      'rule.2': 'Skjut bara med fri skottlinje och säkert kulfång. Är du osäker: låt den gå.',
      'rule.3': 'Kalven före kon – aldrig sugga med kultingar. Känn alltid igen vad du skjuter på.',
      'mode.moose': 'Älgpasset',
      'mode.moose.sub': 'Älg och rådjur i skogen',
      'mode.boar': 'Vildsvinspasset',
      'mode.boar.sub': 'Vildsvin, räv och hare i buskaget',
      'mode.mixed': 'Blandat pass',
      'mode.mixed.sub': 'Allt – även flygande fåglar',
      best: 'Rekord: {n} p',
      noBest: 'Inget rekord än',
      newBest: 'Nytt rekord!',
      sound: 'Skottljud: {name}',
      soundSub: 'Skjut här för att byta',
      language: 'Svenska',
      languageSub: 'Shoot for English',
      encounter: 'Pass {n} av {total}',
      shots: 'Skott: {n}',
      points: '{n} p',
      ready: 'Spana…',
      saw: 'Det var: {name}',
      // Animals
      'name.mooseBull': 'Älgtjur',
      'name.mooseCow': 'Älgko (ensam)',
      'name.mooseCalf': 'Älgko med kalv',
      'name.roeBuck': 'Rådjursbock',
      'name.roeDoe': 'Rådjursget med killing',
      'name.boar': 'Ensam galt',
      'name.sow': 'Sugga med kultingar',
      'name.fox': 'Räv',
      'name.dog': 'Jakthund (orange väst)',
      'name.hare': 'Hare',
      'name.duck': 'Gräsand',
      'name.crane': 'Trana (fridlyst)',
      // Outcomes
      'res.clean': 'Fällt på platsen',
      'res.still': 'Fällt på platsen – lugnt djur',
      'res.wound': 'Skadskjutet – djuret flydde',
      'res.miss': 'Bom',
      'res.unsafe': 'Osäkert skott!',
      'res.hold': 'Rätt beslut – du lät den gå',
      'res.pass': 'Du lät den passera',
      'why.clear': 'Fri skottlinje och säkert kulfång',
      'why.wound': 'Sikta bakom bogen – hjärta och lungor',
      'why.miss': 'Ta det lugnt: andas ut och tryck av',
      'why.young': 'Kon/geten med ungar – skjut ungen först, aldrig modern',
      'why.sow': 'Sugga med kultingar – skona henne och de randiga kultingarna',
      'why.calf': 'Kalven före kon – god jaktetik',
      'why.passYoung': 'Du lät dem gå – kalven kan skjutas först när skottlinjen är fri',
      'res.cleanYoung': 'Kalven fälld – rätt ordning',
      'why.dog': 'Det var en jakthund – kontrollera alltid målet',
      'why.crane': 'Tranan är fridlyst – känn igen arten först',
      'why.rock': 'Sten bakom djuret – risk för rikoschett',
      'why.hunter': 'Jaktkamrat i skottlinjen – kulan går vidare',
      'why.house': 'Byggnad bakom målet – skjut aldrig mot bebyggelse',
      'why.sky': 'Inget kulfång – djuret syns mot himlen',
      'why.branch': 'Gren i skottlinjen – kulan kan avlänkas',
      'why.bush': 'Du ser inte målet – vegetation i vägen',
      'why.passWait': 'Skottlinjen blev aldrig fri – bra tålamod',
      'why.passGone': 'Djuret hann försvinna innan du kom till skott',
      // Results
      score: '{n} poäng',
      'row.clean': 'Fällda djur',
      'row.hold': 'Rätta beslut (lät gå)',
      'row.unsafe': 'Osäkra skott',
      'row.wound': 'Skadskjutna',
      'row.miss': 'Bommar',
      'row.pass': 'Passerade utan skott',
      'row.shots': 'Skott totalt',
      'rate.great': 'Mönsterjägare – säkert och träffsäkert',
      'rate.good': 'Gott jaktskytte – säkerheten sitter',
      'rate.some': 'Bra, men ett osäkert skott är ett för mycket',
      'rate.bad': 'Säkerheten först – repetera jaktskyttebanan',
      'rate.low': 'Öva mer – lugn och säker går före snabb',
      again: 'Nytt pass',
      menu: 'Meny',
    },
    en: {
      title: 'Hunting Stand',
      subtitle: 'Shoot a choice to start',
      footer: '10 encounters per stand · Esc quits · F full screen',
      'rule.1': 'Aim behind the shoulder – heart and lungs. Head and belly shots wound.',
      'rule.2': 'Shoot only with a clear line of fire and a safe backstop. In doubt: let it go.',
      'rule.3': 'Calf before cow – never a sow with piglets. Always identify what you shoot at.',
      'mode.moose': 'Moose stand',
      'mode.moose.sub': 'Moose and roe deer in the forest',
      'mode.boar': 'Boar stand',
      'mode.boar.sub': 'Boar, fox and hare in the thicket',
      'mode.mixed': 'Mixed stand',
      'mode.mixed.sub': 'Everything – even flying birds',
      best: 'Best: {n} p',
      noBest: 'No record yet',
      newBest: 'New record!',
      sound: 'Gunshot: {name}',
      soundSub: 'Shoot here to change',
      language: 'English',
      languageSub: 'Skjut för svenska',
      encounter: 'Encounter {n} of {total}',
      shots: 'Shots: {n}',
      points: '{n} pts',
      ready: 'Watch…',
      saw: 'It was: {name}',
      'name.mooseBull': 'Bull moose',
      'name.mooseCow': 'Lone cow moose',
      'name.mooseCalf': 'Cow moose with calf',
      'name.roeBuck': 'Roe buck',
      'name.roeDoe': 'Roe doe with fawn',
      'name.boar': 'Lone boar',
      'name.sow': 'Sow with piglets',
      'name.fox': 'Fox',
      'name.dog': 'Hunting dog (orange vest)',
      'name.hare': 'Hare',
      'name.duck': 'Mallard',
      'name.crane': 'Crane (protected)',
      'res.clean': 'Dropped on the spot',
      'res.still': 'Dropped on the spot – calm animal',
      'res.wound': 'Wounded – the animal fled',
      'res.miss': 'Miss',
      'res.unsafe': 'Unsafe shot!',
      'res.hold': 'Right call – you let it go',
      'res.pass': 'You let it pass',
      'why.clear': 'Clear line of fire and a safe backstop',
      'why.wound': 'Aim behind the shoulder – heart and lungs',
      'why.miss': 'Stay calm: breathe out and squeeze',
      'why.young': 'Cow/doe with young – shoot the young first, never the mother',
      'why.sow': 'Sow with piglets – spare her and the striped piglets',
      'why.calf': 'Calf before cow – good hunting ethics',
      'why.passYoung': 'You let them go – the calf may be shot first when the line is clear',
      'res.cleanYoung': 'Calf harvested – the right order',
      'why.dog': 'It was a hunting dog – always check your target',
      'why.crane': 'The crane is protected – identify the species first',
      'why.rock': 'Rock behind the animal – risk of ricochet',
      'why.hunter': 'Fellow hunter in the line of fire – the bullet travels on',
      'why.house': 'Building behind the target – never shoot towards buildings',
      'why.sky': 'No backstop – the animal is skylined',
      'why.branch': 'Branch in the line of fire – the bullet may deflect',
      'why.bush': 'You cannot see the target – vegetation in the way',
      'why.passWait': 'The line of fire never cleared – good patience',
      'why.passGone': 'The animal was gone before you got a shot',
      score: '{n} points',
      'row.clean': 'Animals harvested',
      'row.hold': 'Right calls (let go)',
      'row.unsafe': 'Unsafe shots',
      'row.wound': 'Wounded',
      'row.miss': 'Misses',
      'row.pass': 'Passed without a shot',
      'row.shots': 'Shots fired',
      'rate.great': 'Master hunter – safe and accurate',
      'rate.good': 'Good hunting – safety is solid',
      'rate.some': 'Good, but one unsafe shot is one too many',
      'rate.bad': 'Safety first – retake the hunter exam range',
      'rate.low': 'Practise more – calm and safe beats fast',
      again: 'New stand',
      menu: 'Menu',
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  const LANG_KEY = 'hunting-stand:lang';
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
    sky: '#04070a',
    skyLow: '#0f1b22',
    bank: '#0b140f',
    bankTop: '#112018',
    treeFar: '#08110d',
    trunk: '#060b08',
    ground: '#09110c',
    grass: '#0e1a12',
    rock: '#35424b',
    rockEdge: '#4a5864',
    text: '#7d93a6',
    dim: '#4b5d6c',
    faint: '#2a3742',
    panel: '#0d151c',
    panelEdge: '#24394a',
    panelHot: '#33546b',
    hit: [70, 170, 120], // muted green
    warn: [150, 118, 52], // muted amber – never red
    grey: [110, 122, 134],
  };

  // ---------- Helpers ----------

  let W = 0, H = 0, S = 1, groundY = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H) / 1080;
    groundY = H * 0.86;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const bestKey = (m) => `hunting-stand:best:${m}`;
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

  function ellipse(x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  }

  // ---------- Sound ----------

  let audio = null;
  function ac() {
    if (!audio) audio = new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function beep(freq, dur, { type = 'sine', gain = 0.12, at = 0, to = null } = {}) {
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
  function noise(dur, { type = 'lowpass', f0 = 400, f1 = f0, gain = 0.1, at = 0 } = {}) {
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

  const Gunshots = window.Gunshots;
  const guns = Gunshots ? new Gunshots(ac) : null;
  const SOUND_KEY = 'hunting-stand:shotSound';
  let shotSound = store.get(SOUND_KEY) || 'rifle';
  const fire = () => { if (guns) guns.play(shotSound); };

  const sfx = {
    ready: () => beep(440, 0.08, { gain: 0.06 }),
    thud: () => noise(0.25, { f0: 300, f1: 90, gain: 0.14, at: 0.12 }),
    good: () => [523, 659].forEach((f, i) => beep(f, 0.18, { at: 0.2 + i * 0.1, gain: 0.07 })),
    bad: () => beep(170, 0.35, { type: 'triangle', gain: 0.12, at: 0.15, to: 110 }),
    end: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { at: i * 0.11 })),
  };

  // ---------- Species ----------

  // Anatomy-based species and drawing live in animals.js
  const Animals = window.Animals;
  const SP = Animals.SP;

  // ---------- Scenery ----------

  function mulberry(seed) {
    let a = Math.floor(seed * 1e6) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t0 = a;
      t0 = Math.imul(t0 ^ (t0 >>> 15), t0 | 1);
      t0 ^= t0 + Math.imul(t0 ^ (t0 >>> 7), t0 | 61);
      return ((t0 ^ (t0 >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BANK_H = 360; // normal height of the hillside behind the animals

  /** Top edge of the hillside at x. A "dip" lets the sky show through. */
  function bankTop(e, x) {
    let h = BANK_H * S + 18 * S * Math.sin(x * 0.0035 + e.seed) + 10 * S * Math.sin(x * 0.011 + e.seed * 2);
    for (const d of e.dips) {
      const k = Math.exp(-(((x - d.x) / d.w) ** 2));
      h -= (h - 70 * S) * k;
    }
    return groundY - h;
  }

  function buildScenery(e) {
    const r = mulberry(e.seed);
    e.trees = [];
    for (let x = -20 * S; x < W + 40 * S; x += (16 + r() * 22) * S) {
      e.trees.push({ x, h: (60 + r() * 90) * S, w: (22 + r() * 16) * S, shade: r() });
    }
    e.trunks = [];
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      e.trunks.push({ x: r() * W, w: (14 + r() * 22) * S, top: groundY - (BANK_H + 40 + r() * 120) * S });
    }
    e.tufts = [];
    for (let i = 0; i < 70; i++) e.tufts.push({ x: r() * W, y: groundY + r() * (H - groundY), h: (8 + r() * 14) * S });
  }

  function drawScene(e) {
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, C.sky);
    sky.addColorStop(1, C.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);

    // Hillside behind the animals
    ctx.fillStyle = C.bank;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, bankTop(e, x));
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    // Conifers along the crest (small where the hill dips)
    ctx.fillStyle = C.treeFar;
    for (const tr of e.trees) {
      const base = bankTop(e, tr.x) + 26 * S;
      const k = Math.max(0.15, Math.min(1, (groundY - base) / (230 * S)));
      const h = tr.h * k;
      ctx.beginPath();
      ctx.moveTo(tr.x - tr.w * k, base);
      ctx.lineTo(tr.x, base - h);
      ctx.lineTo(tr.x + tr.w * k, base);
      ctx.closePath();
      ctx.fill();
    }

    // Hazards in the background
    for (const z of e.zones) {
      if (z.type === 'rock') drawRock(z);
      else if (z.type === 'hunter') drawHunter(z);
      else if (z.type === 'house') drawHouse(z);
    }

    // Trunks
    ctx.fillStyle = C.trunk;
    for (const tk of e.trunks) ctx.fillRect(tk.x - tk.w / 2, tk.top, tk.w, groundY - tk.top);

    // Ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = C.grass;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    for (const tf of e.tufts) {
      ctx.moveTo(tf.x, tf.y);
      ctx.lineTo(tf.x - 3 * S, tf.y - tf.h);
      ctx.moveTo(tf.x, tf.y);
      ctx.lineTo(tf.x + 4 * S, tf.y - tf.h * 0.8);
    }
    ctx.stroke();
    ctx.strokeStyle = C.bankTop;
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  function drawRock(z) {
    const r = mulberry(z.cx * 0.01 + 1);
    const pts = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const k = 0.82 + r() * 0.18;
      pts.push([z.cx + Math.cos(a) * z.rx * 0.95 * k, z.cy + z.ry * 0.85 + Math.sin(a) * z.ry * 1.6 * k]);
    }
    ctx.fillStyle = C.rock;
    ctx.strokeStyle = C.rockEdge;
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.moveTo(z.cx - z.rx * 0.95, z.cy + z.ry * 0.85);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(z.cx + z.rx * 0.95, z.cy + z.ry * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cracks
    ctx.strokeStyle = '#26323a';
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(z.cx - z.rx * 0.3, z.cy - z.ry * 0.4);
    ctx.lineTo(z.cx - z.rx * 0.1, z.cy + z.ry * 0.1);
    ctx.lineTo(z.cx - z.rx * 0.25, z.cy + z.ry * 0.5);
    ctx.moveTo(z.cx + z.rx * 0.35, z.cy - z.ry * 0.2);
    ctx.lineTo(z.cx + z.rx * 0.2, z.cy + z.ry * 0.3);
    ctx.stroke();
  }

  function drawHunter(z) {
    const x = z.cx;
    const foot = z.cy + z.ry * 0.85;
    const u = 150 * S / 100; // figure is 150 S tall
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b2420';
    ctx.lineWidth = 11 * u;
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, foot - 50 * u);
    ctx.lineTo(x - 8 * u, foot);
    ctx.moveTo(x + 6 * u, foot - 50 * u);
    ctx.lineTo(x + 9 * u, foot);
    ctx.stroke();
    ctx.fillStyle = '#7a5a2c'; // orange vest, muted
    ctx.beginPath();
    ctx.roundRect(x - 17 * u, foot - 100 * u, 34 * u, 55 * u, 6 * u);
    ctx.fill();
    ctx.strokeStyle = '#2c3a33';
    ctx.lineWidth = 10 * u;
    ctx.beginPath();
    ctx.moveTo(x + 14 * u, foot - 88 * u);
    ctx.lineTo(x + 38 * u, foot - 70 * u);
    ctx.stroke();
    ctx.strokeStyle = '#151b18'; // rifle
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(x + 4 * u, foot - 60 * u);
    ctx.lineTo(x + 62 * u, foot - 108 * u);
    ctx.stroke();
    ctx.fillStyle = '#5a4a3a';
    ellipse(x, foot - 112 * u, 10 * u, 11 * u);
    ctx.fill();
    ctx.fillStyle = '#7a5a2c';
    ctx.beginPath();
    ctx.arc(x, foot - 117 * u, 11 * u, Math.PI, 0);
    ctx.fill();
  }

  function drawHouse(z) {
    const base = z.cy + z.ry * 0.65;
    const w = z.rx * 1.0;
    const h = z.ry * 0.9;
    const x = z.cx - w / 2;
    ctx.fillStyle = '#1b262a';
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = '#10181b';
    ctx.beginPath();
    ctx.moveTo(x - 14 * S, base - h);
    ctx.lineTo(z.cx, base - h - 60 * S);
    ctx.lineTo(x + w + 14 * S, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#23342f';
    ctx.fillRect(x + w * 0.2, base - h * 0.7, w * 0.22, h * 0.32);
    ctx.fillRect(x + w * 0.6, base - h * 0.7, w * 0.22, h * 0.32);
  }

  function drawForeground(e) {
    for (const b of e.bushes) {
      for (const bl of b.blobs) {
        ctx.fillStyle = bl.col;
        ctx.beginPath();
        ctx.arc(b.x + bl.dx, b.y + bl.dy, bl.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.lineCap = 'round';
    for (const br of e.branches) {
      ctx.strokeStyle = '#050a07';
      ctx.lineWidth = br.w;
      ctx.beginPath();
      ctx.moveTo(br.pts[0][0], br.pts[0][1]);
      for (let i = 1; i < br.pts.length; i++) ctx.lineTo(br.pts[i][0], br.pts[i][1]);
      ctx.stroke();
      ctx.lineWidth = br.w * 0.35;
      for (const tw of br.twigs) {
        ctx.beginPath();
        ctx.moveTo(tw[0], tw[1]);
        ctx.lineTo(tw[2], tw[3]);
        ctx.stroke();
      }
    }
  }

  // ---------- Animals: drawing ----------

  function drawAnimal(a) {
    if (a.gone || a.alpha <= 0) return;
    const s = a.s;
    ctx.save();
    ctx.globalAlpha = a.alpha;
    if (a.sp.kind === 'bird') {
      ctx.translate(a.x, a.by);
      ctx.rotate(a.dead ? a.rot * a.dir : -Math.sin(a.wing) * 0.05);
      ctx.scale(a.dir * s, s);
      Animals.draw(ctx, a);
    } else {
      // A soft shadow on the ground
      if (!a.dead || a.deadT < 0.5) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(a.x, a.gy + 3 * S, a.sp.L * 0.5 * s, 7 * S, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.translate(a.x, a.gy);
      ctx.translate(0, a.by - a.gy);
      ctx.scale(a.dir * s, s);
      Animals.draw(ctx, a);
    }
    ctx.restore();
  }

  // ---------- Animals: behaviour ----------

  /** Creates a walking animal that follows a list of stops and leaves at the far edge. */
  function walker(e, spId, { stops = [], off = 0, role = 'main', sm = 1 } = {}) {
    const sp = SP[spId];
    const dir = e.dir;
    const margin = 280 * S;
    const startX = (dir > 0 ? -margin : W + margin) - dir * off;
    const exitX = dir > 0 ? W + margin : -margin;
    const wp = stops.map((st) => ({ x: st.x - dir * off, stop: st.dur, mode: st.mode }));
    wp.push({ x: exitX, stop: 0 });
    return {
      sp, spId, role, dir, x: startX, gy: groundY, by: groundY, s: sp.scale * S, vx: 0, state: 'walk',
      wp, wpi: 0, timer: 0, gait: rand(0, 1), wb: 0, bob: rand(0, 6), headDown: 0, headTarget: 0,
      speed: sp.speed * S * sm, exitX, flee: false, dead: false, deadT: 0, gone: false, alpha: 1,
    };
  }

  function flyer(e, spId, { y, delay = 0 } = {}) {
    const sp = SP[spId];
    const dir = e.dir;
    const margin = 120 * S;
    return {
      sp, spId, role: 'main', dir, x: (dir > 0 ? -margin : W + margin) - dir * delay * sp.speed * S,
      gy: 0, by: y, baseY: y, s: sp.scale * S, vx: 0, state: 'fly', wing: rand(0, 6), t: rand(0, 6), ph: rand(0, 6),
      headDown: 0, bob: 0, speed: sp.speed * S, exitX: dir > 0 ? W + margin : -margin, flee: false, dead: false,
      deadT: 0, gone: false, alpha: 1, vy: 0, rot: 0,
    };
  }

  function updateAnimal(a, dt) {
    const sp = a.sp;
    if (a.dead) {
      a.deadT += dt;
      a.deadK = Math.min(1, a.deadT / 0.5);
      a.headDown += (0.55 - a.headDown) * Math.min(1, dt * 4);
      a.wb = 0;
      if (sp.kind === 'bird') {
        a.vy += 1400 * S * dt;
        a.by = Math.min(groundY, a.by + a.vy * dt);
        a.x += a.dir * 60 * S * dt * (a.by < groundY ? 1 : 0);
        a.rot = Math.min(1.4, a.rot + dt * 3);
      }
      if (a.deadT > 3) a.alpha = Math.max(0, 1 - (a.deadT - 3));
      return;
    }
    if (a.gone) return;

    if (sp.kind === 'bird') {
      a.vx = a.dir * a.speed;
      a.x += a.vx * dt;
      a.t += dt;
      a.wing += dt * (sp.crane ? 7 : 16);
      a.by = a.baseY + Math.sin(a.t * 2.2 + a.ph) * 28 * S;
      if ((a.x - a.exitX) * a.dir >= 0) a.gone = true;
      return;
    }

    a.headDown += (a.headTarget - a.headDown) * Math.min(1, dt * 3);
    a.bob += dt;
    let hop = 0;
    if (a.state === 'stop') {
      a.vx = 0;
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'walk';
        a.headTarget = 0;
        a.wpi++;
      }
    } else {
      const v = a.flee ? a.speed * (sp.fleeMul || 3) : a.speed;
      a.vx = a.dir * v;
      a.x += a.vx * dt;
      if (sp.kind === 'hare') {
        // Hares bound: one hop per cycle
        a.gait = (a.gait + dt * (a.flee ? 3.4 : 2.4)) % 1;
        hop = Math.sin(a.gait * Math.PI * 2) > 0 ? Math.sin(a.gait * Math.PI * 2) * 22 * a.s : 0;
      } else {
        // Stride length keeps the feet planted while the body moves
        const stride = sp.stride * (a.flee ? 1.7 : 1);
        a.gait = (a.gait + (0.6 * (v / (S * sp.scale)) * dt) / stride) % 1;
      }
      const w = a.wp[a.wpi];
      if (!a.flee && w && w.stop > 0 && (a.x - w.x) * a.dir >= 0) {
        a.state = 'stop';
        a.timer = w.stop;
        a.headTarget = w.mode === 'graze' ? 1 : 0;
      }
      if ((a.x - a.exitX) * a.dir >= 0) a.gone = true;
    }
    // Blend between standing and walking so the legs do not pop
    a.wb += ((a.state === 'stop' ? 0 : 1) - a.wb) * Math.min(1, dt * 6);
    a.by = a.gy - sp.g * a.s - hop;
  }

  // ---------- Hit tests and safety judgement ----------

  /** 'vital' (heart/lungs), 'body' (a bad hit) or null. */
  function testHit(a, px, py) {
    if (a.dead || a.gone) return null;
    const lx = ((px - a.x) / a.s) * a.dir;
    const ly = (py - a.by) / a.s;
    const minR = (22 * S) / a.s; // tolerance for a laser on a projector
    return Animals.hit(a, lx, ly, minR);
  }

  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
  }

  /** Everything that makes a shot at (x, y) unsafe or unethical, most serious first. */
  function unsafeReasons(e, x, y) {
    const why = [];
    if (e.hold) why.push(e.hold);
    for (const z of e.zones) {
      if (((x - z.cx) / z.rx) ** 2 + ((y - z.cy) / z.ry) ** 2 <= 1) why.push(z.type);
    }
    if (!e.bird && y < bankTop(e, x)) why.push('sky');
    for (const br of e.branches) {
      for (let i = 1; i < br.pts.length; i++) {
        if (segDist(x, y, br.pts[i - 1][0], br.pts[i - 1][1], br.pts[i][0], br.pts[i][1]) < br.w / 2 + 10 * S) {
          why.push('branch');
          i = br.pts.length;
        }
      }
    }
    for (const b of e.bushes) {
      if (((x - b.x) / (b.rx + 8 * S)) ** 2 + ((y - b.y) / (b.ry + 8 * S)) ** 2 <= 1) why.push('bush');
    }
    return [...new Set(why)];
  }

  // ---------- Encounters ----------

  function stopsFor(e, n, mode, dur) {
    const fr = [rand(0.3, 0.46), rand(0.62, 0.76)];
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = fr[i];
      out.push({ x: e.dir > 0 ? W * f : W * (1 - f), dur: rand(dur[0], dur[1]), mode });
    }
    return out;
  }

  const SCEN = {
    mooseBull(e) {
      const stops = stopsFor(e, chance(0.5) ? 2 : 1, 'look', [4, 7]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'mooseBull', { stops }));
    },
    mooseCow(e) {
      const stops = stopsFor(e, chance(0.5) ? 2 : 1, 'look', [4, 7]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'mooseCow', { stops }));
    },
    mooseCalf(e) {
      const stops = stopsFor(e, 1, 'look', [5, 8]);
      e.anchor = stops[0].x;
      e.protectMain = true; // the calf may be shot first, never the cow
      e.animals.push(walker(e, 'mooseCow', { stops }));
      // The calf follows – sometimes close behind, sometimes it shows up late
      e.animals.push(walker(e, 'mooseCalf', { stops, off: rand(170, 420) * S, role: 'young' }));
    },
    roeBuck(e) {
      const stops = stopsFor(e, 1, 'look', [3, 5]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'roeBuck', { stops }));
    },
    roeDoe(e) {
      const stops = stopsFor(e, 1, 'graze', [4, 6]);
      e.anchor = stops[0].x;
      e.protectMain = true;
      e.animals.push(walker(e, 'roeDoe', { stops }));
      e.animals.push(walker(e, 'roeFawn', { stops, off: rand(110, 300) * S, role: 'young' }));
    },
    boar(e) {
      const stops = stopsFor(e, chance(0.4) ? 2 : 1, 'graze', [5, 8]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'boar', { stops }));
    },
    sow(e) {
      const stops = stopsFor(e, 1, 'graze', [6, 9]);
      e.anchor = stops[0].x;
      e.hold = 'sow'; // striped piglets cannot survive without the sow: spare them all
      e.animals.push(walker(e, 'sow', { stops }));
      const n = 2 + Math.floor(rand(0, 3));
      for (let i = 0; i < n; i++) {
        e.animals.push(walker(e, 'piglet', { stops, off: rand(60, 320) * S, role: 'young', sm: rand(0.9, 1.1) }));
      }
    },
    fox(e) {
      const stops = stopsFor(e, 1, 'look', [1.5, 3]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'fox', { stops }));
    },
    dog(e) {
      const stops = stopsFor(e, 1, 'look', [1.5, 3]);
      e.anchor = stops[0].x;
      e.hold = 'dog';
      e.animals.push(walker(e, 'dog', { stops }));
    },
    hare(e) {
      const stops = stopsFor(e, chance(0.5) ? 2 : 1, 'look', [1.5, 3]);
      e.anchor = stops[0].x;
      e.animals.push(walker(e, 'hare', { stops }));
    },
    duck(e) {
      e.bird = true;
      const y = rand(0.2, 0.42) * H;
      e.animals.push(flyer(e, 'duck', { y }));
      if (chance(0.5)) e.animals.push(flyer(e, 'duck', { y: y + rand(-50, 50) * S, delay: rand(0.15, 0.4) }));
    },
    crane(e) {
      e.bird = true;
      e.hold = 'crane';
      e.animals.push(flyer(e, 'crane', { y: rand(0.2, 0.4) * H }));
    },
  };

  const MODE_TABLE = {
    moose: { mooseBull: 22, mooseCow: 14, mooseCalf: 26, roeBuck: 14, roeDoe: 14, fox: 5, hare: 5 },
    boar: { boar: 26, sow: 26, fox: 14, dog: 9, hare: 14, roeBuck: 11 },
    mixed: {
      mooseBull: 9, mooseCow: 6, mooseCalf: 10, roeBuck: 7, roeDoe: 7, boar: 10, sow: 10,
      fox: 7, dog: 5, hare: 7, duck: 12, crane: 6,
    },
  };

  let lastScen = null;
  function chooseScenario(mode) {
    const table = { ...MODE_TABLE[mode] };
    if (lastScen) delete table[lastScen];
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [id, w] of Object.entries(table)) {
      r -= w;
      if (r <= 0) return id;
    }
    return Object.keys(table)[0];
  }

  function makeBush(x, y, rx, ry) {
    const blobs = [];
    const cols = ['#07110b', '#0a170f', '#0d1d13'];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const k = Math.sqrt(Math.random());
      blobs.push({ dx: Math.cos(a) * rx * 0.8 * k, dy: Math.sin(a) * ry * 0.75 * k, r: rand(0.35, 0.6) * ry, col: pick(cols) });
    }
    // Make sure the middle is solid
    blobs.push({ dx: 0, dy: 0, r: ry * 0.8, col: cols[0] });
    return { x, y, rx, ry, blobs };
  }

  function addHazards(e) {
    const anchor = Math.max(W * 0.25, Math.min(W * 0.75, e.anchor ?? W * 0.5));
    const dir = e.dir;
    const calm = e.hold ? 0.5 : 1; // keep the holds readable
    const hardCover = ['boar', 'sow', 'fox', 'hare'].includes(e.scen);

    if (e.bird) {
      if (chance(0.3 * calm)) {
        const hx = rand(0.25, 0.75) * W;
        e.zones.push({ type: 'house', cx: hx, cy: groundY - 330 * S, rx: 190 * S, ry: 175 * S });
      }
      const nb = chance(0.6) ? 1 + Math.floor(rand(0, 2)) : 0;
      for (let i = 0; i < nb; i++) {
        const x0 = rand(0.2, 0.8) * W;
        const pts = [[x0, -30 * S], [x0 + rand(-120, 120) * S, H * rand(0.12, 0.2)], [x0 + rand(-260, 260) * S, H * rand(0.3, 0.5)]];
        e.branches.push(makeBranch(pts, rand(14, 24) * S));
      }
      return;
    }

    // One thing behind the animal at most
    const r = Math.random();
    if (r < 0.22 * calm) {
      e.zones.push({ type: 'rock', cx: anchor + dir * rand(-30, 30) * S, cy: groundY - 110 * S, rx: rand(170, 230) * S, ry: 150 * S });
    } else if (r < 0.36 * calm) {
      e.zones.push({ type: 'hunter', cx: anchor + dir * rand(80, 240) * S, cy: groundY - 120 * S, rx: 110 * S, ry: 130 * S });
    } else if (r < 0.54 * calm) {
      e.dips.push({ x: anchor + dir * rand(-40, 40) * S, w: rand(190, 260) * S });
    }

    // Vegetation in front
    if (chance(hardCover ? 0.75 : 0.25)) {
      const cover = e.scen === 'boar' || e.scen === 'sow';
      const rx = rand(cover ? 150 : 110, cover ? 210 : 170) * S;
      const ry = (cover ? rand(52, 64) : rand(34, 52)) * S;
      const bx = anchor + dir * rand(-20, 20) * S;
      e.bushes.push(makeBush(bx, groundY + 20 * S - ry, rx, ry));
      if (chance(0.3)) e.bushes.push(makeBush(bx + dir * rand(260, 420) * S, groundY + 20 * S - ry * 0.8, rx * 0.8, ry * 0.8));
    }

    // Branches
    if (chance(0.5)) {
      if (chance(0.5)) {
        // diagonal across the body height, near the stop
        const cx = anchor + dir * rand(-150, 150) * S;
        e.branches.push(makeBranch([[cx - 280 * S, groundY - 480 * S], [cx, groundY - 280 * S], [cx + 300 * S, groundY - 120 * S]], rand(12, 20) * S));
      } else {
        // low and horizontal at chest height
        const cx = anchor + dir * rand(-200, 200) * S;
        const y = groundY - rand(70, 190) * S;
        e.branches.push(makeBranch([[cx - 340 * S, y + 30 * S], [cx, y], [cx + 340 * S, y - 30 * S]], rand(10, 18) * S));
      }
    }
  }

  function makeBranch(pts, w) {
    const twigs = [];
    for (let i = 1; i < pts.length; i++) {
      for (let k = 0; k < 4; k++) {
        const f = rand(0.1, 0.9);
        const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
        const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
        twigs.push([x, y, x + rand(-60, 60) * S, y + rand(-70, 70) * S]);
      }
    }
    return { pts, w, twigs };
  }

  function makeEncounter(mode, force) {
    const e = {
      dir: chance(0.5) ? 1 : -1, animals: [], zones: [], branches: [], bushes: [], dips: [], hold: null,
      bird: false, seed: Math.random() * 100, resolved: false, anchor: null,
    };
    const id = force || chooseScenario(mode);
    lastScen = id;
    e.scen = id;
    SCEN[id](e);
    addHazards(e);
    buildScenery(e);
    // Any hazard that can clear up while the animal moves on?
    e.dynamic = e.zones.length + e.branches.length + e.bushes.length + e.dips.length > 0;
    return e;
  }

  // ---------- Game state ----------

  const MODES = ['moose', 'boar', 'mixed'];

  const game = {
    scene: 'menu', // 'menu' | 'play' | 'results'
    phase: 'ready', // 'ready' | 'active' | 'feedback'
    mode: 'moose',
    enc: null,
    index: 0,
    timer: 0,
    points: 0,
    card: [], // { tone: 'good' | 'bad' | 'neutral' }
    banner: null,
    stats: null,
    newBest: false,
    buttons: [],
    hover: null,
  };

  function startRound(mode, force) {
    game.scene = 'play';
    game.mode = mode;
    game.index = 0;
    game.points = 0;
    game.card = [];
    game.newBest = false;
    game.force = force || null;
    game.stats = { clean: 0, hold: 0, unsafe: 0, wound: 0, miss: 0, pass: 0, shots: 0 };
    lastScen = null;
    toReady();
  }

  function toReady() {
    game.index++;
    game.enc = makeEncounter(game.mode, game.force);
    game.phase = 'ready';
    game.timer = 1.6;
    game.banner = null;
    game.readyBeeped = false;
  }

  function toMenu() {
    game.scene = 'menu';
  }

  function endRound() {
    game.scene = 'results';
    sfx.end();
    if (game.points > getBest(game.mode)) {
      store.set(bestKey(game.mode), String(game.points));
      game.newBest = game.points > 0;
    }
  }

  /** Close the encounter: score it and show what happened. */
  function resolve(kind, points, head, why, tone) {
    const e = game.enc;
    e.resolved = true;
    game.points += points;
    game.stats[kind]++;
    game.card.push({ tone });
    game.banner = { head, why, tone, points, name: t(`name.${e.scen}`) };
    game.phase = 'feedback';
    game.timer = 4.2;
    if (tone === 'good') sfx.good();
    else if (tone === 'bad') sfx.bad();
  }

  function resolveNoShot() {
    const e = game.enc;
    if (e.hold) resolve('hold', POINTS.hold, 'res.hold', `why.${e.hold}`, 'good');
    else resolve('pass', 0, 'res.pass', e.protectMain ? 'why.passYoung' : e.dynamic ? 'why.passWait' : 'why.passGone', 'neutral');
  }

  // ---------- Shooting ----------

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
      else if (b.id === 'menu') toMenu();
      else if (b.id === 'again') startRound(game.mode);
      else startRound(b.id);
      return;
    }

    fire();
    const e = game.enc;
    if (game.scene !== 'play' || game.phase !== 'active' || e.resolved) return;

    game.stats.shots++;
    const why = unsafeReasons(e, x, y);
    let target = null;
    let grade = null;
    for (const a of e.animals) {
      const g = testHit(a, x, y);
      if (g && (!grade || g === 'vital')) {
        target = a;
        grade = g;
      }
    }

    // The animals react: a vital hit drops the animal, everything else flees
    for (const a of e.animals) {
      if (a.dead || a.gone) continue;
      if (a === target && grade === 'vital') {
        a.dead = true;
        a.vx = 0;
        a.vy = 0;
        sfx.thud();
      } else {
        a.flee = true;
        a.state = 'walk';
        a.headTarget = 0;
      }
    }

    // Hitting the mother of a calf/fawn is never acceptable – the young come first
    if (target && target.role === 'main' && e.protectMain) why.unshift('young');

    if (why.length) {
      resolve('unsafe', POINTS.unsafe, 'res.unsafe', `why.${why[0]}`, 'bad');
    } else if (grade === 'vital') {
      // The dead animal keeps the state it had when the shot went off
      const calm = target.sp.kind !== 'bird' && target.state === 'stop';
      const youngFirst = target.role === 'young' && e.protectMain;
      resolve('clean', POINTS.clean + (calm ? POINTS.still : 0),
        youngFirst ? 'res.cleanYoung' : calm ? 'res.still' : 'res.clean', youngFirst ? 'why.calf' : 'why.clear', 'good');
    } else if (grade === 'body') {
      resolve('wound', POINTS.wound, 'res.wound', 'why.wound', 'bad');
    } else {
      resolve('miss', 0, 'res.miss', 'why.miss', 'neutral');
    }
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    shoot(ev.clientX, ev.clientY);
  });

  canvas.addEventListener('pointermove', (ev) => {
    game.hover = { x: ev.clientX, y: ev.clientY };
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (game.scene === 'menu') window.close();
      else toMenu();
    } else if (ev.key === 'f' || ev.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  // ---------- Update ----------

  function update(dt) {
    if (game.scene !== 'play') return;
    const e = game.enc;
    for (const a of e.animals) updateAnimal(a, dt);

    if (game.phase === 'ready') {
      game.timer -= dt;
      if (!game.readyBeeped && game.timer < 0.9) {
        game.readyBeeped = true;
        sfx.ready();
      }
      if (game.timer <= 0) game.phase = 'active';
    } else if (game.phase === 'active') {
      if (!e.resolved && e.animals.every((a) => a.gone)) resolveNoShot();
    } else if (game.phase === 'feedback') {
      game.timer -= dt;
      if (game.timer <= 0) {
        if (game.index >= ENCOUNTERS) endRound();
        else toReady();
      }
    }
  }

  // ---------- Drawing ----------

  function toneColor(tone, a = 1) {
    return tone === 'good' ? rgba(C.hit, a) : tone === 'bad' ? rgba(C.warn, a) : `rgba(125, 147, 166, ${a})`;
  }

  function drawHud() {
    const y = 54 * S;
    text(t('encounter', { n: Math.min(game.index, ENCOUNTERS), total: ENCOUNTERS }), 40 * S, y, 32, C.dim, 'left', 600);
    text(t('points', { n: game.points }), W / 2, y, 56, C.text, 'center', 700);
    text(t('shots', { n: game.stats.shots }), W - 40 * S, y, 28, C.dim, 'right', 600);

    // One box per encounter along the bottom
    const box = Math.min(34 * S, (W - 80 * S) / ENCOUNTERS - 10 * S);
    const gap = 10 * S;
    const total = ENCOUNTERS * box + (ENCOUNTERS - 1) * gap;
    let x = (W - total) / 2;
    const by = groundY + (H - groundY) / 2 - box / 2;
    for (let i = 0; i < ENCOUNTERS; i++) {
      const r = game.card[i];
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1.5 * S;
      ctx.strokeRect(x, by, box, box);
      if (r) {
        ctx.fillStyle = toneColor(r.tone, 0.5);
        ctx.fillRect(x + 3 * S, by + 3 * S, box - 6 * S, box - 6 * S);
        if (r.tone === 'bad') {
          ctx.strokeStyle = 'rgba(5, 8, 10, 0.9)';
          ctx.lineWidth = 2 * S;
          ctx.beginPath();
          ctx.moveTo(x + 8 * S, by + 8 * S);
          ctx.lineTo(x + box - 8 * S, by + box - 8 * S);
          ctx.moveTo(x + box - 8 * S, by + 8 * S);
          ctx.lineTo(x + 8 * S, by + box - 8 * S);
          ctx.stroke();
        }
      }
      x += box + gap;
    }
  }

  function drawBanner() {
    const b = game.banner;
    if (!b || game.phase !== 'feedback') return;
    const fade = Math.min(1, game.timer / 0.6, (4.2 - game.timer) / 0.25 + 0.0);
    const a = Math.max(0, fade);
    const pts = b.points ? `  ${b.points > 0 ? '+' : '−'}${Math.abs(b.points)}` : '';
    const y = H * 0.17;
    // Dark plate so the text stays readable over the forest
    ctx.fillStyle = `rgba(4, 7, 10, ${0.72 * a})`;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 520 * S, y - 56 * S, 1040 * S, 170 * S, 18 * S);
    ctx.fill();
    text(t(b.head) + pts, W / 2, y, 52, toneColor(b.tone, a), 'center', 700);
    text(t(b.why), W / 2, y + 52 * S, 27, `rgba(125, 147, 166, ${a})`);
    text(t('saw', { name: b.name }), W / 2, y + 92 * S, 22, `rgba(75, 93, 108, ${a})`);
  }

  function drawReady() {
    if (game.phase !== 'ready') return;
    text(t('ready'), W / 2, H * 0.3, 44, C.faint, 'center', 600);
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
    text(b.label, cx, b.y + b.h * (b.sub ? 0.34 : 0.5), 38, C.text, 'center', 600);
    if (b.sub) text(b.sub, cx, b.y + b.h * 0.58, 21, C.dim);
    if (b.extra) text(b.extra, cx, b.y + b.h * 0.8, 20, C.dim);
  }

  function layoutMenu() {
    const gap = 28 * S;
    const full = Math.min(1180 * S, W - 100 * S);
    const bw = (full - 2 * gap) / 3;
    const bh = 190 * S;
    const x0 = (W - full) / 2;
    const y0 = H * 0.3;
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
    const rowH = 100 * S;
    const items = [];
    if (Gunshots) items.push({ id: 'sound', label: t('sound', { name: Gunshots.nameOf(shotSound, lang) }), sub: t('soundSub') });
    items.push({ id: 'lang', label: t('language'), sub: t('languageSub') });
    const iw = (full - (items.length - 1) * gap) / items.length;
    items.forEach((it, i) => game.buttons.push({ ...it, x: x0 + i * (iw + gap), y: rowY, w: iw, h: rowH, small: true }));
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
    text(t('title'), W / 2, H * 0.13, 84, C.text, 'center', 700);
    text(t('subtitle'), W / 2, H * 0.13 + 78 * S, 28, C.dim);
    game.buttons.forEach(drawButton);
    ['rule.1', 'rule.2', 'rule.3'].forEach((k, i) => text(t(k), W / 2, H * 0.74 + i * 40 * S, 25, C.dim));
    text(t('footer'), W / 2, H - 40 * S, 20, C.faint);
  }

  function rating() {
    const st = game.stats;
    if (st.unsafe >= 3) return t('rate.bad');
    if (st.unsafe >= 1) return t('rate.some');
    if (game.points >= 80) return t('rate.great');
    if (game.points >= 50) return t('rate.good');
    return t('rate.low');
  }

  function drawResults() {
    layoutResults();
    const st = game.stats;
    text(t(`mode.${game.mode}`), W / 2, H * 0.1, 32, C.dim);
    text(t('score', { n: game.points }), W / 2, H * 0.2, 100, C.text, 'center', 700);
    text(rating(), W / 2, H * 0.2 + 80 * S, 30, C.dim, 'center', 600);
    text(game.newBest ? t('newBest') : t('best', { n: getBest(game.mode) }), W / 2, H * 0.2 + 122 * S, 26,
      game.newBest ? rgba(C.hit, 1) : C.faint, 'center', 600);

    const rows = [
      [t('row.clean'), st.clean],
      [t('row.hold'), st.hold],
      [t('row.unsafe'), st.unsafe],
      [t('row.wound'), st.wound],
      [t('row.miss'), st.miss],
      [t('row.pass'), st.pass],
      [t('row.shots'), st.shots],
    ];
    const y0 = H * 0.42;
    rows.forEach(([k, v], i) => {
      const y = y0 + i * 40 * S;
      text(k, W / 2 - 20 * S, y, 26, C.dim, 'right');
      text(String(v), W / 2 + 20 * S, y, 26, C.text, 'left', 600);
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
      ctx.fillStyle = C.sky;
      ctx.fillRect(0, 0, W, H);
      drawMenu();
    } else if (game.scene === 'play') {
      const e = game.enc;
      drawScene(e);
      // Far animals first: the smaller (younger) ones behind
      for (const a of e.animals) drawAnimal(a);
      drawForeground(e);
      drawHud();
      drawReady();
      drawBanner();
    } else {
      ctx.fillStyle = C.sky;
      ctx.fillRect(0, 0, W, H);
      drawResults();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // For automated tests
  window.__game = game;
  window.__lang = () => lang;
  window.__start = (mode, scen) => startRound(mode, scen);
  window.__skipReady = () => { if (game.phase === 'ready') game.timer = 0; };
})();
