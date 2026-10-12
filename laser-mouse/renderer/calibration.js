// Calibration and coordinate mapping.
//
// A homography is a 3×3 matrix that describes how a flat surface (the screen
// or wall) looks when seen at an angle by the camera. With at least 4 known
// point pairs we can compute it, and then map any camera point to a screen point.
//
// Screen coordinates are normalized: (0,0) = top-left corner, (1,1) =
// bottom-right. That makes the calibration independent of resolution and scaling.

(function () {
  /** Solves A·x = b (n×n) with Gaussian elimination and partial pivoting. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) throw new Error('The points cannot be solved (are they on a line?)');
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
   * Homography from src→dst by least squares (exact for 4 points).
   * @param {{x,y}[]} src  @param {{x,y}[]} dst
   * @returns {number[]} 9 elements, row by row, h[8] = 1
   */
  function computeHomography(src, dst) {
    if (src.length < 4) throw new Error('At least 4 points are required');
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
    if (Math.abs(det) < 1e-15) throw new Error('The matrix cannot be inverted');
    const inv = [
      A, -(b * i - c * h), b * f - c * e,
      B, a * i - c * g, -(a * f - c * d),
      C, -(a * h - b * g), a * e - b * d,
    ].map((v) => v / det);
    return inv.map((v) => v / inv[8]);
  }

  /**
   * A finished calibration: camera pixels → normalized screen coordinates.
   * Camera coordinates are normalized internally (÷ width/height) for better numerics.
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

    /** Camera pixel → normalized screen point {x,y} (0–1 inside the screen). */
    toScreen(camX, camY) {
      return applyHomography(this.H, camX / this.camWidth, camY / this.camHeight);
    }

    /** Normalized screen point → camera pixel (used to draw the screen outline). */
    toCamera(u, v) {
      const p = applyHomography(this.Hinv, u, v);
      return { x: p.x * this.camWidth, y: p.y * this.camHeight };
    }

    /** Mean error in normalized units (0 for an exact 4-point calibration). */
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
    const m = 0.1; // margin from the edge
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
   * Collects one camera point per calibration point.
   * A point is captured when the laser has been held still for a while
   * (stableFrames frames within maxSpread px).
   *
   * Guard: the laser is ignored entirely when it is closer than minSeparation
   * px to an already captured point. That way the same spot can never be
   * captured twice – even if the detection drops the dot for a frame.
   */
  class Calibrator {
    constructor(points, { stableFrames = 20, maxSpread = 6, minSeparation = 60, maxMissed = 3 } = {}) {
      this.points = points;
      this.stableFrames = stableFrames;
      this.maxSpread = maxSpread;
      this.minSeparation = minSeparation;
      this.maxMissed = maxMissed; // tolerate a few dropped frames in a row (flicker)
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

  /**
   * Where a normalized point is on the screen, as a key for the spoken
   * guidance: 'topLeft', 'topCenter', … 'center' … 'bottomRight'.
   * The text itself comes from i18n ('where.<key>').
   */
  function describePoint(p) {
    const v = p.y < 0.3 ? 'top' : p.y > 0.7 ? 'bottom' : 'mid';
    const h = p.x < 0.3 ? 'Left' : p.x > 0.7 ? 'Right' : 'Center';
    if (v === 'mid' && h === 'Center') return 'center';
    return v + h;
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
