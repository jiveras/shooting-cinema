// Animal drawing for Hunting Stand: anatomy-based silhouettes.
//
// Quadrupeds are built from a smooth torso outline, a neck that carries the
// head, and legs with real joints (shoulder → knee → hoof in front, hip →
// hock → hoof behind) solved with two-bone IK. The feet follow a walk or
// trot cycle, so the legs move like the real thing. Each species has its own
// head shape, ears, tail and markings.
//
// Everything is drawn in local units facing right (+x), y down, with the body
// centre at the origin and the ground at y = sp.g. The game scales/flips it.
//
// Colours are muted with a LOW red channel (R ≤ 125) – the laser detector
// must never mistake an animal for the laser.

(function () {
  // ---------- Geometry helpers ----------

  const lerp = (a, b, k) => a + (b - a) * k;

  /** Smooth closed curve through the points (quadratic curves via midpoints). */
  function smooth(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  /** Transforms head-local points (unit length) into the current space. */
  const scaled = (pts, sx, sy = sx) => pts.map(([x, y]) => [x * sx, y * sy]);

  /** A tapered limb segment from p0 to p1 with a round joint at p1. */
  function limb(ctx, p0, p1, w0, w1) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    ctx.beginPath();
    ctx.moveTo(p0[0] + (nx * w0) / 2, p0[1] + (ny * w0) / 2);
    ctx.lineTo(p1[0] + (nx * w1) / 2, p1[1] + (ny * w1) / 2);
    ctx.lineTo(p1[0] - (nx * w1) / 2, p1[1] - (ny * w1) / 2);
    ctx.lineTo(p0[0] - (nx * w0) / 2, p0[1] - (ny * w0) / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p1[0], p1[1], w1 / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Two-bone IK. `bend` = -1: joint points forward (knee), +1: backward (hock). */
  function ik(p, f, a, b, bend) {
    const dx = f[0] - p[0];
    const dy = f[1] - p[1];
    const d = Math.min(Math.hypot(dx, dy), a + b - 0.01);
    const th = Math.atan2(dy, dx);
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const A = Math.acos(cosA);
    const ang = th + bend * A;
    const j = [p[0] + Math.cos(ang) * a, p[1] + Math.sin(ang) * a];
    // The foot sits where the second bone really ends
    const aj = Math.atan2(f[1] - j[1], f[0] - j[0]);
    return { joint: j, foot: [j[0] + Math.cos(aj) * b, j[1] + Math.sin(aj) * b] };
  }

  // ---------- Species ----------

  // Head outlines in unit length, pointing +x from the skull base.
  const HEADS = {
    moose: [[-0.05, -0.22], [0.25, -0.2], [0.6, -0.15], [0.86, -0.13], [1.02, -0.06], [1.07, 0.06], [1.0, 0.15], [0.82, 0.18], [0.62, 0.24], [0.35, 0.32], [0.05, 0.36], [-0.1, 0.12]],
    roe: [[-0.05, -0.2], [0.2, -0.22], [0.55, -0.1], [0.88, -0.04], [1.0, 0.02], [0.97, 0.08], [0.8, 0.1], [0.5, 0.16], [0.2, 0.26], [-0.05, 0.22]],
    boar: [[-0.1, -0.38], [0.25, -0.38], [0.6, -0.22], [0.92, -0.11], [1.07, 0.0], [1.04, 0.1], [0.8, 0.14], [0.5, 0.22], [0.2, 0.34], [-0.1, 0.34]],
    fox: [[-0.05, -0.26], [0.25, -0.27], [0.6, -0.12], [1.0, -0.02], [1.03, 0.03], [0.7, 0.09], [0.4, 0.17], [0.1, 0.24], [-0.1, 0.16]],
    dog: [[-0.05, -0.28], [0.25, -0.3], [0.6, -0.14], [0.95, -0.06], [1.04, 0.02], [0.96, 0.1], [0.65, 0.13], [0.4, 0.2], [0.1, 0.28], [-0.1, 0.18]],
  };

  const EARS = {
    moose: { pts: [[0.02, -0.16], [-0.16, -0.36], [-0.12, -0.58], [0.08, -0.42], [0.18, -0.18]], dark: true },
    roe: { pts: [[0.02, -0.16], [-0.1, -0.4], [0.02, -0.62], [0.2, -0.46], [0.2, -0.18]], dark: true },
    boar: { pts: [[0.0, -0.32], [-0.12, -0.62], [0.16, -0.6], [0.24, -0.3]], dark: true },
    fox: { pts: [[0.0, -0.24], [-0.06, -0.62], [0.22, -0.5], [0.26, -0.24]], dark: true },
    dog: { pts: [[0.0, -0.26], [-0.12, -0.5], [0.04, -0.62], [0.22, -0.44], [0.24, -0.26]], dark: false },
  };

  const SP = {};

  function quad(id, o) {
    const sp = {
      kind: 'quad', id, gait: 'walk', fleeMul: 3, hoof: '#171411',
      ...o,
    };
    // Sizes: body centre to ground, vital zone (heart/lungs behind the shoulder), body ellipse
    sp.vit = { x: 0.2 * sp.L, y: (sp.cd - sp.wh) * 0.5 + (sp.wh + sp.cd) * 0.1, r: 0.33 * (sp.wh + sp.cd) };
    sp.bodyEl = { cx: -0.03 * sp.L, cy: (sp.cd - sp.wh) / 2, rx: 0.52 * sp.L, ry: 0.58 * (sp.wh + sp.cd) };
    SP[id] = sp;
    return sp;
  }

  const moose = {
    L: 128, scale: 2.6, speed: 125, fleeMul: 2.4, wh: 34, rh: 27, cd: 28, fd: 17, g: 86,
    stride: 50, lift: 17,
    front: { px: 0.3, py: 8, a: 38, b: 46, w: [14, 8, 5.5] },
    hind: { px: -0.34, py: 6, a: 40, b: 46, w: [19, 9, 5.5] },
    neck: { x: 0.36, y: -0.7, len: 40, up: -0.2, down: 0.95, w0: 48, w1: 28 },
    head: { id: 'moose', len: 64, tilt: 0.72 },
    col: '#4a4034', belly: '#3b332a', leg: '#6f6858', dark: '#2c261f',
    hump: true, bell: true,
  };
  quad('mooseBull', { ...moose, antler: 'palm' });
  quad('mooseCow', { ...moose, col: '#4f4538', scale: 2.3 });
  quad('mooseCalf', { ...moose, col: '#5a4b3a', belly: '#45392c', scale: 1.5, hump: false, bell: false, neck: { ...moose.neck, len: 34 } });

  const roe = {
    L: 60, scale: 3.2, speed: 105, fleeMul: 3.4, wh: 12, rh: 14, cd: 11, fd: 8, g: 30,
    stride: 24, lift: 8,
    front: { px: 0.3, py: 3, a: 12, b: 17, w: [6, 3.6, 2.6] },
    hind: { px: -0.34, py: 2, a: 14, b: 17, w: [9, 4.2, 2.6] },
    neck: { x: 0.36, y: -0.6, len: 19, up: -0.62, down: 1.1, w0: 14, w1: 8 },
    head: { id: 'roe', len: 20, tilt: 0.35 },
    col: '#6e5a40', belly: '#7a6c52', leg: '#594932', dark: '#3b3124', rumpPatch: true,
  };
  quad('roeBuck', { ...roe, antler: 'tines' });
  quad('roeDoe', { ...roe });
  quad('roeFawn', { ...roe, scale: 2.2, spots: true, col: '#7a6444' });

  const boar = {
    L: 112, scale: 2.4, speed: 95, fleeMul: 3, wh: 36, rh: 24, cd: 26, fd: 20, g: 48,
    stride: 32, lift: 10,
    front: { px: 0.32, py: 10, a: 19, b: 21, w: [14, 8, 6] },
    hind: { px: -0.34, py: 8, a: 20, b: 21, w: [17, 8, 6] },
    neck: { x: 0.38, y: -0.45, len: 16, up: 0.4, down: 1.2, w0: 48, w1: 34 },
    head: { id: 'boar', len: 44, tilt: 0.18 },
    col: '#4c453b', belly: '#3a342b', leg: '#2b2723', dark: '#26231f', crest: true, tusk: true, snout: true,
  };
  quad('boar', boar);
  quad('sow', { ...boar, col: '#544a3d', belly: '#40382e', crest: false, tusk: false, teats: true, L: 116 });
  quad('piglet', { ...boar, scale: 1.45, col: '#5a4c36', belly: '#4a3f2e', crest: false, tusk: false, stripes: true, L: 100 });

  quad('fox', {
    L: 62, scale: 2.5, speed: 170, fleeMul: 2.3, gait: 'trot', wh: 10, rh: 11, cd: 9, fd: 6, g: 30,
    stride: 26, lift: 8,
    front: { px: 0.3, py: 3, a: 14, b: 16, w: [5, 3.2, 2.4] },
    hind: { px: -0.34, py: 2, a: 15, b: 16, w: [7, 3.6, 2.4] },
    neck: { x: 0.38, y: -0.5, len: 13, up: -0.15, down: 0.95, w0: 13, w1: 9 },
    head: { id: 'fox', len: 24, tilt: 0.3 },
    col: '#7a4c2a', belly: '#78746a', leg: '#271f18', dark: '#3d2a1a', tail: 'bushy', cheek: '#7a766a',
  });
  quad('dog', {
    L: 66, scale: 2.5, speed: 175, fleeMul: 2.2, gait: 'trot', wh: 14, rh: 13, cd: 12, fd: 8, g: 33,
    stride: 28, lift: 8,
    front: { px: 0.3, py: 4, a: 15, b: 17, w: [6.5, 4, 3] },
    hind: { px: -0.34, py: 3, a: 16, b: 17, w: [8.5, 4.4, 3] },
    neck: { x: 0.38, y: -0.55, len: 15, up: -0.2, down: 0.95, w0: 16, w1: 11 },
    head: { id: 'dog', len: 25, tilt: 0.3 },
    col: '#4a4a42', belly: '#3c3c36', leg: '#5f523c', dark: '#2a2a25', tail: 'long', vest: true,
  });

  SP.hare = { kind: 'hare', scale: 3, speed: 170, fleeMul: 2.2, g: 15, L: 44, col: '#5f5440', belly: '#76705c', dark: '#3b3329',
    vit: { x: 6, y: -2, r: 9 }, bodyEl: { cx: 0, cy: -2, rx: 24, ry: 13 } };
  SP.duck = { kind: 'bird', scale: 2.2, speed: 430, rx: 17, ry: 10, col: '#5b5646', dark: '#3a382e', head: '#2e5048' };
  SP.crane = { kind: 'bird', scale: 2.4, speed: 330, rx: 26, ry: 10, crane: true, col: '#6c737c', dark: '#3a3f46', head: '#4a5058' };

  // ---------- Pose ----------

  function pose(a) {
    const sp = a.sp;
    const n = sp.neck;
    const bob = Math.sin((a.bob || 0) * 4) * 0.07 * a.headDown;
    const ang = lerp(n.up, n.down, a.headDown) + bob;
    const ns = [n.x * sp.L, n.y * sp.wh];
    const nh = [ns[0] + Math.cos(ang) * n.len, ns[1] + Math.sin(ang) * n.len];
    const ha = ang + sp.head.tilt;
    const hl = sp.head.len;
    const hc = [nh[0] + Math.cos(ha) * hl * 0.5, nh[1] + Math.sin(ha) * hl * 0.5];
    return { ns, nh, ha, hl, hc, nang: ang };
  }

  /** 'vital', 'body' or null for a point in the animal's local space. */
  function hit(a, lx, ly, minR) {
    const sp = a.sp;
    if (sp.kind === 'bird') {
      return (lx / (sp.rx * 1.8)) ** 2 + (ly / (sp.ry * 2.6)) ** 2 <= 1 ? 'vital' : null;
    }
    const v = sp.vit;
    if (Math.hypot(lx - v.x, ly - v.y) <= Math.max(v.r, minR)) return 'vital';
    const b = sp.bodyEl;
    if (((lx - b.cx) / b.rx) ** 2 + ((ly - b.cy) / b.ry) ** 2 <= 1) return 'body';
    if (sp.kind === 'hare') return null;
    const p = pose(a);
    if (Math.hypot(lx - p.hc[0], ly - p.hc[1]) <= p.hl * 0.6) return 'body';
    const dx = p.nh[0] - p.ns[0];
    const dy = p.nh[1] - p.ns[1];
    const k = Math.max(0, Math.min(1, ((lx - p.ns[0]) * dx + (ly - p.ns[1]) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(lx - (p.ns[0] + dx * k), ly - (p.ns[1] + dy * k)) <= sp.neck.w1 * 0.8) return 'body';
    return null;
  }

  // ---------- Quadrupeds ----------

  function torsoPts(sp) {
    const { L, wh, rh, cd, fd } = sp;
    return [
      [0.3 * L, -wh], [0.14 * L, -wh * 0.84], [-0.04 * L, -(wh + rh) * 0.47], [-0.24 * L, -rh * 1.03], [-0.4 * L, -rh],
      [-0.5 * L, -rh * 0.55], [-0.52 * L, fd * 0.1], [-0.44 * L, fd * 0.95], [-0.3 * L, fd * 1.05], [-0.1 * L, fd * 1.05],
      [0.1 * L, cd * 0.9], [0.26 * L, cd * 1.02], [0.38 * L, cd * 0.82], [0.44 * L, cd * 0.05], [0.42 * L, -wh * 0.5],
    ];
  }

  function legPoints(sp, a, side, front) {
    const def = front ? sp.front : sp.hind;
    const pivot = [def.px * sp.L, def.py];
    const wb = a.wb || 0;
    const trot = sp.gait === 'trot' || a.flee;
    // Walk: near hind 0, near front .25, far hind .5, far front .75. Trot: diagonal pairs.
    const off = trot
      ? { nh: 0, nf: 0.5, fh: 0.5, ff: 0 }
      : { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
    const ph = (a.gait || 0) + (front ? (side === 'near' ? off.nf : off.ff) : (side === 'near' ? off.nh : off.fh));
    const stride = sp.stride * (a.flee ? 1.7 : 1);
    const lift = sp.lift * (a.flee ? 1.6 : 1);
    const p = ((ph % 1) + 1) % 1;
    const duty = 0.6;
    let dx;
    let up = 0;
    if (p < duty) dx = stride * (0.5 - p / duty);
    else {
      const q = (p - duty) / (1 - duty);
      dx = stride * (-0.5 + q);
      up = Math.sin(q * Math.PI) * lift;
    }
    // A dead animal's legs fold under it and splay out as the body sinks
    const dk = a.deadK || 0;
    const sink = dk * (sp.g - sp.cd - 2);
    const foot = [pivot[0] + dx * wb * (1 - dk) + dk * (front ? 14 : -10) * (side === 'far' ? 0.6 : 1), sp.g - up * wb * (1 - dk) - sink];
    const r = ik(pivot, foot, def.a, def.b, front ? -1 : 1);
    return { pivot, joint: r.joint, foot: r.foot, w: def.w };
  }

  function drawLeg(ctx, sp, lp, upperCol, lowerCol) {
    ctx.fillStyle = upperCol;
    limb(ctx, lp.pivot, lp.joint, lp.w[0], lp.w[1]);
    ctx.fillStyle = lowerCol;
    limb(ctx, lp.joint, lp.foot, lp.w[1] * 0.85, lp.w[2]);
    // Hoof
    const h = lp.w[2];
    ctx.fillStyle = sp.hoof;
    poly(ctx, [[lp.foot[0] - h * 0.55, lp.foot[1] - h * 0.9], [lp.foot[0] + h * 0.55, lp.foot[1] - h * 0.9], [lp.foot[0] + h * 0.95, lp.foot[1] + 0.3], [lp.foot[0] - h * 0.45, lp.foot[1] + 0.3]]);
    ctx.fill();
  }

  function drawHead(ctx, sp, p, antlerFar) {
    const hd = sp.head;
    ctx.save();
    ctx.translate(p.nh[0], p.nh[1]);
    ctx.rotate(p.ha);
    const hl = hd.len;

    // Antlers sit on the head, so draw them in head space (the far one first)
    if (sp.antler && antlerFar) drawAntler(ctx, sp, hl, true);
    // Ear
    const ear = EARS[hd.id];
    ctx.fillStyle = ear.dark ? sp.dark : sp.col;
    smooth(ctx, scaled(ear.pts, hl));
    ctx.fill();
    if (!antlerFar) {
      ctx.fillStyle = sp.col;
      smooth(ctx, scaled(HEADS[hd.id], hl));
      ctx.fill();
      // Muzzle and cheek tones
      if (sp.cheek) {
        ctx.fillStyle = sp.cheek;
        smooth(ctx, scaled([[0.3, 0.06], [0.7, 0.0], [1.0, 0.03], [0.7, 0.1], [0.4, 0.17], [0.15, 0.22]], hl));
        ctx.fill();
      }
      ctx.fillStyle = sp.dark;
      ctx.beginPath(); // nose
      ctx.ellipse(hl * (hd.id === 'moose' ? 1.0 : 1.01), hl * (hd.id === 'moose' ? 0.0 : 0.02), hl * 0.05, hl * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sp.snout) {
        ctx.fillStyle = '#2a2622';
        ctx.beginPath();
        ctx.ellipse(hl * 1.05, hl * 0.04, hl * 0.06, hl * 0.09, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sp.tusk) {
        ctx.strokeStyle = '#8a8676';
        ctx.lineWidth = Math.max(1, hl * 0.035);
        ctx.beginPath();
        ctx.moveTo(hl * 0.88, hl * 0.12);
        ctx.quadraticCurveTo(hl * 0.92, hl * 0.02, hl * 0.84, -hl * 0.06);
        ctx.stroke();
      }
      // Eye – a dark dot, nothing bright
      ctx.fillStyle = '#0b0a08';
      ctx.beginPath();
      ctx.ellipse(hl * (hd.id === 'boar' ? 0.5 : 0.52), -hl * 0.06, hl * 0.03, hl * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sp.antler) drawAntler(ctx, sp, hl, false);
    }
    ctx.restore();
  }

  function drawAntler(ctx, sp, hl, far) {
    ctx.fillStyle = far ? '#4f4838' : '#7a705a';
    ctx.strokeStyle = ctx.fillStyle;
    if (sp.antler === 'palm') {
      // A broad palm with tines, seen from the side
      const k = hl * 1.3;
      const off = far ? -0.1 : 0;
      const pts = [[0.05, -0.18], [-0.1, -0.42], [0.0, -0.66], [-0.1, -0.95], [0.1, -0.78], [0.18, -1.08], [0.3, -0.82], [0.42, -1.05],
        [0.5, -0.78], [0.66, -0.98], [0.7, -0.66], [0.86, -0.72], [0.74, -0.46], [0.56, -0.34], [0.3, -0.26], [0.18, -0.16]];
      poly(ctx, pts.map(([x, y]) => [(x + off) * k, y * k * 0.95]));
      ctx.fill();
    } else {
      const k = hl;
      ctx.lineWidth = Math.max(1, hl * 0.07);
      ctx.lineCap = 'round';
      const o = far ? -0.08 : 0;
      ctx.beginPath();
      ctx.moveTo((0.08 + o) * k, -0.18 * k);
      ctx.lineTo((0.02 + o) * k, -0.7 * k);
      ctx.moveTo((0.05 + o) * k, -0.45 * k);
      ctx.lineTo((0.3 + o) * k, -0.66 * k);
      ctx.moveTo((0.02 + o) * k, -0.7 * k);
      ctx.lineTo((0.12 + o) * k, -0.82 * k);
      ctx.stroke();
    }
  }

  function drawQuad(ctx, a) {
    const sp = a.sp;
    const { L, wh, cd } = sp;
    const wb = a.wb || 0;
    const p = pose(a);
    const far = (front) => legPoints(sp, a, 'far', front);
    const near = (front) => legPoints(sp, a, 'near', front);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Body bounce
    const bounce = wb ? Math.sin((a.gait || 0) * Math.PI * 4) * (a.flee ? 2.4 : 1.1) * wb : 0;
    ctx.save();
    ctx.translate(0, bounce + (a.deadK || 0) * (sp.g - sp.cd - 2));

    // Far legs and far antler
    drawLeg(ctx, sp, far(false), sp.dark, sp.dark);
    drawLeg(ctx, sp, far(true), sp.dark, sp.dark);
    if (sp.antler) drawHead(ctx, sp, p, true);

    // Tail
    if (sp.tail === 'bushy') {
      ctx.fillStyle = sp.col;
      smooth(ctx, [[-0.44 * L, -6], [-0.68 * L, -7], [-0.95 * L, -2], [-1.08 * L, 7], [-1.05 * L, 15], [-0.86 * L, 13], [-0.62 * L, 6], [-0.44 * L, 3]]);
      ctx.fill();
      ctx.fillStyle = '#76766a';
      smooth(ctx, [[-0.98 * L, 4], [-1.1 * L, 9], [-1.07 * L, 16], [-0.92 * L, 13]]);
      ctx.fill();
    } else if (sp.tail === 'long') {
      ctx.strokeStyle = sp.col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-0.48 * L, -sp.rh * 0.7);
      ctx.quadraticCurveTo(-0.72 * L, -sp.rh * 0.9, -0.82 * L, -sp.rh * 2.1);
      ctx.stroke();
    } else if (sp.id === 'boar' || sp.id === 'sow' || sp.id === 'piglet') {
      ctx.strokeStyle = sp.dark;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-0.5 * L, -sp.rh * 0.45);
      ctx.quadraticCurveTo(-0.62 * L, -sp.rh * 0.1, -0.6 * L, sp.rh * 0.5);
      ctx.stroke();
    } else if (sp.id.startsWith('moose')) {
      ctx.fillStyle = sp.dark;
      smooth(ctx, [[-0.5 * L, -sp.rh * 0.6], [-0.55 * L, -sp.rh * 0.2], [-0.52 * L, sp.rh * 0.15], [-0.48 * L, -sp.rh * 0.2]]);
      ctx.fill();
    }

    // Torso with a back-to-belly gradient
    const g = ctx.createLinearGradient(0, -wh, 0, cd);
    g.addColorStop(0, sp.col);
    g.addColorStop(0.62, sp.col);
    g.addColorStop(1, sp.belly);
    ctx.fillStyle = g;
    const tp = torsoPts(sp);
    smooth(ctx, tp);
    ctx.fill();

    // Neck: a tapered shape from the shoulders to the head, plus the bell/mane
    {
      const n = sp.neck;
      const nx = Math.cos(p.nang);
      const ny = Math.sin(p.nang);
      const px = -ny;
      const py = nx;
      const w0 = n.w0 / 2;
      const w1 = n.w1 / 2;
      const s0 = [p.ns[0] - nx * w0 * 0.2, p.ns[1] - ny * w0 * 0.2];
      ctx.fillStyle = sp.col;
      smooth(ctx, [
        [s0[0] - px * w0 * 1.25 - nx * 4, s0[1] - py * w0 * 1.25 - ny * 4],
        [(s0[0] + p.nh[0]) / 2 - px * (w0 + w1) * 0.5, (s0[1] + p.nh[1]) / 2 - py * (w0 + w1) * 0.5],
        [p.nh[0] - px * w1, p.nh[1] - py * w1],
        [p.nh[0] + px * w1, p.nh[1] + py * w1],
        [(s0[0] + p.nh[0]) / 2 + px * (w0 + w1) * 0.5, (s0[1] + p.nh[1]) / 2 + py * (w0 + w1) * 0.5],
        [s0[0] + px * w0 * 1.1, s0[1] + py * w0 * 1.1 + 2],
      ]);
      ctx.fill();
      if (sp.bell) {
        ctx.fillStyle = sp.dark;
        smooth(ctx, [[p.nh[0] + px * w1, p.nh[1] + py * w1], [p.nh[0] + px * w1 * 1.7 + nx * 6, p.nh[1] + py * w1 * 1.7 + ny * 6 + 8], [p.nh[0] + px * w1 * 0.9 + nx * 10, p.nh[1] + py * w1 * 0.9 + ny * 10]]);
        ctx.fill();
      }
    }

    // Shoulder hump (moose) and bristly crest (boar)
    if (sp.hump) {
      ctx.fillStyle = sp.col;
      smooth(ctx, [[0.05 * L, -wh * 0.8], [0.22 * L, -wh * 1.12], [0.36 * L, -wh * 0.92], [0.3 * L, -wh * 0.5]]);
      ctx.fill();
    }
    if (sp.crest) {
      // Bristles along the back: a thin row of spikes on the top line
      ctx.fillStyle = sp.dark;
      const top = (f) => [lerp(0.33 * L, -0.42 * L, f), lerp(-wh * 0.98, -sp.rh * 1.0, f) - Math.sin(f * Math.PI) * 1.2];
      const up = [];
      const down = [];
      for (let i = 0; i <= 20; i++) {
        const [x, y] = top(i / 20);
        up.push([x, y - (i % 2 ? 6 : 2.5)]);
        down.unshift([x, y + 3]);
      }
      poly(ctx, up.concat(down));
      ctx.fill();
    }

    // Markings
    if (sp.rumpPatch) {
      ctx.fillStyle = '#7a7462';
      smooth(ctx, [[-0.5 * L, -sp.rh * 0.7], [-0.44 * L, -sp.rh * 0.95], [-0.38 * L, -sp.rh * 0.4], [-0.46 * L, -sp.rh * 0.05]]);
      ctx.fill();
    }
    if (sp.spots) {
      ctx.fillStyle = '#8a7a58';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(-0.34 * L + (i % 5) * 0.16 * L, -wh * 0.55 + Math.floor(i / 5) * wh * 0.55, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (sp.stripes) {
      ctx.strokeStyle = '#8c7b58';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0.34 * L, -wh * (0.3 - i * 0.18) + 1);
        ctx.quadraticCurveTo(0, -wh * (0.55 - i * 0.2) + 2, -0.42 * L, -sp.rh * (0.45 - i * 0.22));
        ctx.stroke();
      }
    }
    if (sp.teats) {
      ctx.fillStyle = '#6a5a48';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(-0.2 * L + i * 0.09 * L, sp.fd * 1.05 + 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (sp.vest) {
      ctx.fillStyle = '#7a5a2c'; // orange vest, muted
      smooth(ctx, [[0.24 * L, -wh * 0.95], [0.0, -wh * 0.85], [-0.2 * L, -wh * 0.9], [-0.22 * L, cd * 0.4], [0.0, cd * 0.7], [0.24 * L, cd * 0.55]]);
      ctx.fill();
      ctx.strokeStyle = '#686a5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0.04 * L, -wh * 0.85);
      ctx.lineTo(0.04 * L, cd * 0.7);
      ctx.stroke();
    }

    // Muscle contours: the shoulder and the haunch give the body its volume
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = Math.max(1, L * 0.012);
    ctx.beginPath();
    ctx.moveTo(0.12 * L, -wh * 0.7);
    ctx.quadraticCurveTo(0.2 * L, cd * 0.1, 0.12 * L, cd * 0.7);
    ctx.moveTo(-0.22 * L, -sp.rh * 0.8);
    ctx.quadraticCurveTo(-0.14 * L, fd(sp) * 0.3, -0.28 * L, fd(sp) * 0.9);
    ctx.stroke();
    // A soft highlight along the back
    ctx.strokeStyle = 'rgba(190, 200, 190, 0.07)';
    ctx.lineWidth = Math.max(1.5, L * 0.03);
    ctx.beginPath();
    ctx.moveTo(0.28 * L, -wh * 0.92);
    ctx.quadraticCurveTo(0, -(wh + sp.rh) * 0.5, -0.38 * L, -sp.rh * 0.95);
    ctx.stroke();

    // Head, then the near legs on top
    drawHead(ctx, sp, p, false);
    drawLeg(ctx, sp, near(false), sp.col, sp.leg);
    drawLeg(ctx, sp, near(true), sp.col, sp.leg);
    ctx.restore();
  }

  const fd = (sp) => sp.fd;

  // ---------- Hare ----------

  function drawHare(ctx, a) {
    const sp = a.sp;
    const wb = a.wb || 0;
    const hopping = wb > 0.3 || a.flee;
    const ext = hopping ? 0.5 + 0.5 * Math.sin((a.gait || 0) * Math.PI * 2) : 0; // 0 crouched .. 1 stretched
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    const dk = a.deadK || 0;
    ctx.translate(0, dk * 5);
    ctx.rotate(dk ? lerp(-0.42, 0.12, dk) : hopping ? lerp(-0.05, 0.22, ext) : -0.42); // alert posture when sitting
    const body = [[-24, 3], [-23, -7], [-14, -14], [0, -14], [12, -11], [20, -8], [22, -2], [14, 5], [0, 9], [-14, 10]];
    // Far legs
    ctx.fillStyle = sp.dark;
    smooth(ctx, [[-14, 4], [-26 - ext * 14, 8 + ext * 1], [-26 - ext * 14, 12], [-10, 12]]);
    ctx.fill();
    limb(ctx, [16, 2], [20 + ext * 5, 10 + ext * 1], 4, 3);
    // Body
    ctx.fillStyle = sp.col;
    smooth(ctx, body);
    ctx.fill();
    // Haunch
    ctx.fillStyle = sp.belly;
    smooth(ctx, [[-22, -2], [-14, -10], [-4, -6], [-4, 5], [-14, 10], [-22, 6]]);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    // Hind foot, long and flat – stretched back when hopping
    ctx.fillStyle = sp.col;
    smooth(ctx, [[-14, 7], [-6, 6], [4, 10], [4, 14], [-14 - ext * 10, 14.5]]);
    ctx.fill();
    // Tail
    ctx.fillStyle = '#76705e';
    smooth(ctx, [[-24, -4], [-28, -8], [-30, -3], [-26, 2]]);
    ctx.fill();
    // Front leg
    ctx.fillStyle = sp.col;
    limb(ctx, [14, 2], [16 + ext * 8, 13], 5, 3.2);
    // Head with long ears
    ctx.fillStyle = sp.col;
    smooth(ctx, [[14, -14], [21, -17], [30, -13], [33, -8], [29, -4], [20, -4], [15, -8]]);
    ctx.fill();
    ctx.fillStyle = sp.col;
    smooth(ctx, [[17, -16], [11, -33], [14, -37], [21, -22], [22, -17]]);
    ctx.fill();
    ctx.fillStyle = sp.dark;
    smooth(ctx, [[15, -18], [10, -31], [13, -33], [16, -22]]);
    ctx.fill();
    smooth(ctx, [[22, -16], [24, -30], [28, -31], [27, -17]]);
    ctx.fill();
    ctx.fillStyle = '#0b0a08';
    ctx.beginPath();
    ctx.ellipse(24, -11, 1.3, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Birds ----------

  function wing(ctx, sp, flap, near) {
    const wl = sp.crane ? sp.rx * 2.2 : sp.rx * 1.3;
    const tipY = -sp.ry * 0.3 - wl * flap;
    const tipX = -sp.rx * (near ? 0.55 : 0.4);
    const fx = sp.rx * 0.45;
    const bx = -sp.rx * 0.95;
    ctx.fillStyle = near ? sp.col : sp.dark;
    ctx.beginPath();
    ctx.moveTo(fx, -sp.ry * 0.35);
    ctx.quadraticCurveTo(fx - sp.rx * 0.1, tipY * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(bx * 0.7, tipY * 0.4, bx, -sp.ry * 0.25);
    ctx.closePath();
    ctx.fill();
    if (sp.crane) {
      ctx.fillStyle = '#25292e'; // dark wing tips
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(bx * 0.5, tipY * 0.7, bx * 0.8, tipY * 0.55 - sp.ry * 0.1);
      ctx.quadraticCurveTo(tipX * 0.9, tipY * 0.8, tipX, tipY);
      ctx.fill();
    }
  }

  function drawBird(ctx, a) {
    const sp = a.sp;
    const flap = Math.sin(a.wing || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (sp.crane) {
      ctx.strokeStyle = sp.dark;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-sp.rx * 0.8, sp.ry * 0.2);
      ctx.lineTo(-sp.rx * 2.6, sp.ry * 0.7);
      ctx.moveTo(-sp.rx * 0.7, sp.ry * 0.35);
      ctx.lineTo(-sp.rx * 2.5, sp.ry * 1.2);
      ctx.stroke();
    }
    wing(ctx, sp, flap, false);
    // Body
    ctx.fillStyle = sp.col;
    smooth(ctx, [[sp.rx, -sp.ry * 0.1], [sp.rx * 0.6, -sp.ry * 0.9], [-sp.rx * 0.2, -sp.ry], [-sp.rx * 0.9, -sp.ry * 0.5], [-sp.rx * 1.5, 0], [-sp.rx * 0.9, sp.ry * 0.6], [-sp.rx * 0.1, sp.ry], [sp.rx * 0.7, sp.ry * 0.6]]);
    ctx.fill();
    // Neck and head
    if (sp.crane) {
      ctx.strokeStyle = sp.col;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(sp.rx * 0.8, -sp.ry * 0.2);
      ctx.quadraticCurveTo(sp.rx * 1.6, -sp.ry * 0.9, sp.rx * 2.3, -sp.ry * 0.7);
      ctx.stroke();
      ctx.fillStyle = sp.head;
      smooth(ctx, [[sp.rx * 2.15, -sp.ry * 0.9], [sp.rx * 2.5, -sp.ry * 0.85], [sp.rx * 2.5, -sp.ry * 0.55], [sp.rx * 2.15, -sp.ry * 0.55]]);
      ctx.fill();
      ctx.strokeStyle = '#4a4a40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp.rx * 2.5, -sp.ry * 0.72);
      ctx.lineTo(sp.rx * 3.0, -sp.ry * 0.6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = sp.col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sp.rx * 0.8, -sp.ry * 0.2);
      ctx.lineTo(sp.rx * 1.2, -sp.ry * 0.5);
      ctx.stroke();
      ctx.fillStyle = sp.head;
      smooth(ctx, [[sp.rx * 1.0, -sp.ry * 0.9], [sp.rx * 1.35, -sp.ry * 0.95], [sp.rx * 1.5, -sp.ry * 0.55], [sp.rx * 1.1, -sp.ry * 0.35]]);
      ctx.fill();
      ctx.fillStyle = '#7a7a3e'; // bill
      poly(ctx, [[sp.rx * 1.45, -sp.ry * 0.78], [sp.rx * 1.9, -sp.ry * 0.62], [sp.rx * 1.45, -sp.ry * 0.5]]);
      ctx.fill();
      ctx.fillStyle = '#76766a'; // neck ring
      ctx.fillRect(sp.rx * 0.95, -sp.ry * 0.35, sp.rx * 0.18, sp.ry * 0.22);
    }
    wing(ctx, sp, flap, true);
  }

  // ---------- Entry points ----------

  /** Draws an animal in its local space (origin = body centre, facing +x). */
  function draw(ctx, a) {
    const k = a.sp.kind;
    if (k === 'bird') drawBird(ctx, a);
    else if (k === 'hare') drawHare(ctx, a);
    else drawQuad(ctx, a);
  }

  window.Animals = { SP, draw, hit, pose };
})();
