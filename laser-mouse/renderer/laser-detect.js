// Find the laser dot in a frame.
//
// Principle – a "point detector":
// A laser dot is a SMALL spot that is MUCH brighter than everything around it,
// in every direction. A face, a lamp or a red shirt is large and evenly bright
// inside – and an edge (e.g. a cheek against hair) is bright on one side only.
//
//  1. Pre-filter: the pixel must be bright in the red channel and not bluish.
//  2. Ring test: look at 8 points on a ring around the pixel (radius R).
//     The pixel must be at least `minContrast` brighter than the BRIGHTEST of them.
//     Large bright areas and edges fail – only real points remain.
//  3. Hit pixels are grouped into blobs (8×8 cells + flood fill).
//     Blobs that are too small or too large are dropped.
//  4. Blobs inside a learned "ignore" zone (static spots: LEDs, reflections,
//     lamps) are skipped.
//  5. Of the remaining blobs, the one with the highest contrast wins; its
//     centroid is the laser position (with sub-pixel precision).
//
// With a 650 nm filter in front of the lens this becomes almost trivial.

(function () {
  const DEFAULTS = {
    minBrightness: 170, // minimum value in the red channel (0–255)
    minContrast: 50, // how much brighter than the surroundings (the ring)
    minWarmth: 5, // red minus blue – excludes bluish-white reflections
    ringRadius: 12, // ring radius in px; must be larger than the dot
    minPixels: 2,
    maxPixels: 1500,
  };

  const CELL = 8;
  // 8 directions around the pixel
  const DIRS = [
    [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071],
    [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
  ];

  class LaserDetector {
    constructor(settings = {}) {
      this.settings = { ...DEFAULTS, ...settings };
      this._w = 0;
      this._h = 0;
      this._ringRadius = -1;
      this.ignoreZones = []; // [{x, y, r}] in camera pixels
    }

    static get defaults() {
      return { ...DEFAULTS };
    }

    update(settings) {
      Object.assign(this.settings, settings);
    }

    _resize(w, h) {
      this._w = w;
      this._h = h;
      this._cols = Math.ceil(w / CELL);
      this._rows = Math.ceil(h / CELL);
      const n = this._cols * this._rows;
      this._count = new Uint32Array(n);
      this._sumX = new Float64Array(n);
      this._sumY = new Float64Array(n);
      this._peak = new Float32Array(n);
      this._visited = new Uint8Array(n);
      this._stack = new Int32Array(n);
      this._ringRadius = -1;
    }

    _buildRing(R, w) {
      // Precomputed index offsets (in pixels) for the ring's 8 points
      this._ringDX = new Int32Array(8);
      this._ringDY = new Int32Array(8);
      this._ringOff = new Int32Array(8);
      for (let k = 0; k < 8; k++) {
        const dx = Math.round(DIRS[k][0] * R);
        const dy = Math.round(DIRS[k][1] * R);
        this._ringDX[k] = dx;
        this._ringDY[k] = dy;
        this._ringOff[k] = (dy * w + dx) * 4;
      }
      this._ringRadius = R;
    }

    /**
     * @param {ImageData} img  the frame; modified if paintMask is true
     * @param {boolean} paintMask  paint laser pixels green (for debugging)
     */
    detect(img, paintMask = false) {
      const { width: w, height: h, data: d } = img;
      if (w !== this._w || h !== this._h) this._resize(w, h);

      const s = this.settings;
      const R = Math.max(2, Math.round(s.ringRadius));
      if (R !== this._ringRadius) this._buildRing(R, w);
      const ringOff = this._ringOff;

      const cols = this._cols;
      const count = this._count;
      const sumX = this._sumX;
      const sumY = this._sumY;
      const peak = this._peak;
      count.fill(0);
      sumX.fill(0);
      sumY.fill(0);
      peak.fill(0);

      const minB = s.minBrightness;
      const minC = s.minContrast;
      const minW = s.minWarmth;
      let total = 0;

      // Skip the border where the ring would fall outside the image
      for (let y = R; y < h - R; y++) {
        const rowCell = ((y / CELL) | 0) * cols;
        let p = (y * w + R) * 4;
        for (let x = R; x < w - R; x++, p += 4) {
          const r = d[p];
          if (r < minB) continue;
          if (r - d[p + 2] < minW) continue;

          // Ring test: the brightest point on the ring (the red channel is enough)
          let ringMax = 0;
          for (let k = 0; k < 8; k++) {
            const v = d[p + ringOff[k]];
            if (v > ringMax) ringMax = v;
          }
          const contrast = r - ringMax;
          if (contrast < minC) continue;

          const c = rowCell + ((x / CELL) | 0);
          count[c]++;
          sumX[c] += x;
          sumY[c] += y;
          if (contrast > peak[c]) peak[c] = contrast;
          total++;
        }
      }

      if (paintMask && total > 0) this._paint(d, w, h, R, minB, minC, minW);

      if (total === 0) return { found: false, x: 0, y: 0, pixels: 0, total, contrast: 0, blobs: [] };

      // Group adjacent cells into blobs
      const rows = this._rows;
      const visited = this._visited;
      const stack = this._stack;
      visited.fill(0);

      let best = null;
      const blobs = []; // all blobs of the right size (for learning static spots)
      const zones = this.ignoreZones;
      for (let start = 0; start < count.length; start++) {
        if (count[start] === 0 || visited[start]) continue;
        let n = 0, sx = 0, sy = 0, pk = 0, top = 0;
        stack[top++] = start;
        visited[start] = 1;
        while (top > 0) {
          const k = stack[--top];
          n += count[k];
          sx += sumX[k];
          sy += sumY[k];
          if (peak[k] > pk) pk = peak[k];
          const kc = k % cols;
          const kr = (k / cols) | 0;
          for (let dr = -1; dr <= 1; dr++) {
            const rr = kr + dr;
            if (rr < 0 || rr >= rows) continue;
            for (let dc = -1; dc <= 1; dc++) {
              const cc = kc + dc;
              if (cc < 0 || cc >= cols) continue;
              const j = rr * cols + cc;
              if (count[j] > 0 && !visited[j]) {
                visited[j] = 1;
                stack[top++] = j;
              }
            }
          }
        }
        if (n < s.minPixels || n > s.maxPixels) continue;
        const bx = sx / n;
        const by = sy / n;
        const ignored = zones.some((z) => (bx - z.x) ** 2 + (by - z.y) ** 2 < z.r * z.r);
        blobs.push({ x: bx, y: by, pixels: n, contrast: pk, ignored });
        if (ignored) continue;
        if (!best || pk > best.contrast || (pk === best.contrast && n > best.pixels)) {
          best = { found: true, x: bx, y: by, pixels: n, total, contrast: pk };
        }
      }

      const out = best || { found: false, x: 0, y: 0, pixels: 0, total, contrast: 0 };
      out.blobs = blobs;
      return out;
    }

    // Separate pass for the mask, so the painting doesn't disturb the ring test.
    _paint(d, w, h, R, minB, minC, minW) {
      const ringOff = this._ringOff;
      const hits = [];
      for (let y = R; y < h - R; y++) {
        let p = (y * w + R) * 4;
        for (let x = R; x < w - R; x++, p += 4) {
          const r = d[p];
          if (r < minB || r - d[p + 2] < minW) continue;
          let ringMax = 0;
          for (let k = 0; k < 8; k++) {
            const v = d[p + ringOff[k]];
            if (v > ringMax) ringMax = v;
          }
          if (r - ringMax >= minC) hits.push(p);
        }
      }
      for (const p of hits) {
        d[p] = 0;
        d[p + 1] = 255;
        d[p + 2] = 0;
      }
    }
  }

  window.LaserDetector = LaserDetector;
})();
