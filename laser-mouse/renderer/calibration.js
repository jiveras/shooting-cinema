// Etapp 3: kalibrering och koordinatöversättning.
//
// En homografi är en 3×3-matris som beskriver hur en plan yta (skärmen/väggen)
// ser ut sedd snett från kameran. Med minst 4 kända punktpar kan vi räkna ut
// den, och sedan översätta vilken kamerapunkt som helst till en skärmpunkt.
//
// Skärmkoordinater är normaliserade: (0,0) = övre vänstra hörnet,
// (1,1) = nedre högra. Det gör kalibreringen oberoende av upplösning/skalning.

(function () {
  /** Löser A·x = b (n×n) med Gauss-elimination och partiell pivotering. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) throw new Error('Punkterna går inte att lösa (ligger de på en linje?)');
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /**
   * Homografi från src→dst med minsta kvadrat (exakt för 4 punkter).
   * @param {{x,y}[]} src  @param {{x,y}[]} dst
   * @returns {number[]} 9 element, rad för rad, h[8] = 1
   */
  function computeHomography(src, dst) {
    if (src.length < 4) throw new Error('Minst 4 punkter krävs');
    const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const Atb = new Array(8).fill(0);
    const addRow = (row, rhs) => {
      for (let i = 0; i < 8; i++) {
        Atb[i] += row[i] * rhs;
        for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
      }
    };
    for (let i = 0; i < src.length; i++) {
      const { x, y } = src[i];
      const { x: u, y: v } = dst[i];
      addRow([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
      addRow([0, 0, 0, x, y, 1, -v * x, -v * y], v);
    }
    return [...solve(AtA, Atb), 1];
  }

  function applyHomography(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
  }

  function invert3x3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) throw new Error('Matrisen går inte att invertera');
    const inv = [
      A, -(b * i - c * h), b * f - c * e,
      B, a * i - c * g, -(a * f - c * d),
      C, -(a * h - b * g), a * e - b * d,
    ].map((v) => v / det);
    return inv.map((v) => v / inv[8]);
  }

  /**
   * En färdig kalibrering: kamerapixlar → normaliserade skärmkoordinater.
   * Kamerakoordinaterna normaliseras internt (÷ bredd/höjd) för bättre numerik.
   */
  class ScreenMapping {
    constructor({ H, camWidth, camHeight, pairs, displayId }) {
      this.H = H;
      this.camWidth = camWidth;
      this.camHeight = camHeight;
      this.pairs = pairs;
      this.displayId = displayId;
      this.Hinv = invert3x3(H);
    }

    static fromPairs(pairs, camWidth, camHeight, displayId) {
      const src = pairs.map((p) => ({ x: p.cam.x / camWidth, y: p.cam.y / camHeight }));
      const dst = pairs.map((p) => p.screen);
      const H = computeHomography(src, dst);
      return new ScreenMapping({ H, camWidth, camHeight, pairs, displayId });
    }

    /** Kamerapixel → normaliserad skärmpunkt {x,y} (0–1 inom skärmen). */
    toScreen(camX, camY) {
      return applyHomography(this.H, camX / this.camWidth, camY / this.camHeight);
    }

    /** Normaliserad skärmpunkt → kamerapixel (för att rita skärmens kontur). */
    toCamera(u, v) {
      const p = applyHomography(this.Hinv, u, v);
      return { x: p.x * this.camWidth, y: p.y * this.camHeight };
    }

    /** Medelfel i normaliserade enheter (0 för exakt 4-punkts). */
    residual() {
      let sum = 0;
      for (const p of this.pairs) {
        const s = this.toScreen(p.cam.x, p.cam.y);
        sum += Math.hypot(s.x - p.screen.x, s.y - p.screen.y);
      }
      return sum / this.pairs.length;
    }

    toJSON() {
      return { H: this.H, camWidth: this.camWidth, camHeight: this.camHeight, pairs: this.pairs, displayId: this.displayId };
    }
  }

  function calibrationPoints(count) {
    const m = 0.1; // marginal från kanten
    if (count === 9) {
      const pts = [];
      for (const y of [m, 0.5, 1 - m]) for (const x of [m, 0.5, 1 - m]) pts.push({ x, y });
      return pts;
    }
    return [
      { x: m, y: m },
      { x: 1 - m, y: m },
      { x: 1 - m, y: 1 - m },
      { x: m, y: 1 - m },
    ];
  }

  /**
   * Samlar in en kamerapunkt per kalibreringspunkt.
   * En punkt registreras när lasern hållits stilla en stund (stableFrames
   * bildrutor inom maxSpread px).
   *
   * Spärr: lasern räknas inte alls om den är närmare än minSeparation px från
   * en redan registrerad punkt. Då kan samma ställe aldrig registreras två
   * gånger – även om detekteringen tappar pricken en bildruta.
   */
  class Calibrator {
    constructor(points, { stableFrames = 20, maxSpread = 6, minSeparation = 60, maxMissed = 3 } = {}) {
      this.points = points;
      this.stableFrames = stableFrames;
      this.maxSpread = maxSpread;
      this.minSeparation = minSeparation;
      this.maxMissed = maxMissed; // tål några tappade bildrutor i rad (flimmer)
      this.missed = 0;
      this.index = 0;
      this.samples = [];
      this.pairs = [];
    }

    get done() {
      return this.index >= this.points.length;
    }

    get current() {
      return this.points[this.index];
    }

    _tooClose(x, y) {
      return this.pairs.some((p) => Math.hypot(x - p.cam.x, y - p.cam.y) < this.minSeparation);
    }

    /** @returns {{progress:number, captured?:boolean, done?:boolean, waiting?:boolean}} */
    feed(result) {
      if (this.done) return { progress: 1, done: true };

      if (!result.found) {
        this.missed++;
        if (this.missed > this.maxMissed) this.samples = [];
        return { progress: this.samples.length / this.stableFrames };
      }
      this.missed = 0;

      if (this._tooClose(result.x, result.y)) {
        this.samples = [];
        return { progress: 0, waiting: true };
      }

      this.samples.push({ x: result.x, y: result.y });
      if (this.samples.length > this.stableFrames) this.samples.shift();

      const med = median(this.samples);
      const newest = this.samples[this.samples.length - 1];
      if (Math.hypot(newest.x - med.x, newest.y - med.y) > this.maxSpread) {
        this.samples = [newest];
      }

      const progress = this.samples.length / this.stableFrames;
      if (this.samples.length < this.stableFrames) return { progress };

      const cam = median(this.samples);
      this.pairs.push({ cam, screen: this.current });
      this.index++;
      this.samples = [];
      this.missed = 0;
      return { progress: 1, captured: true, done: this.done };
    }
  }

  /** "uppe till vänster", "i mitten" osv. för en normaliserad punkt. */
  function describePoint(p) {
    const v = p.y < 0.3 ? 'uppe' : p.y > 0.7 ? 'nere' : 'mitten';
    const h = p.x < 0.3 ? 'vänster' : p.x > 0.7 ? 'höger' : 'mitten';
    if (v === 'mitten' && h === 'mitten') return 'i mitten';
    if (h === 'mitten') return `${v} i mitten`;
    if (v === 'mitten') return `mitten till ${h}`;
    return `${v} till ${h}`;
  }

  function median(pts) {
    const xs = pts.map((p) => p.x).sort((a, b) => a - b);
    const ys = pts.map((p) => p.y).sort((a, b) => a - b);
    const m = xs.length >> 1;
    return xs.length % 2
      ? { x: xs[m], y: ys[m] }
      : { x: (xs[m - 1] + xs[m]) / 2, y: (ys[m - 1] + ys[m]) / 2 };
  }

  window.LaserCalibration = { computeHomography, applyHomography, invert3x3, ScreenMapping, Calibrator, calibrationPoints, describePoint };
})();
