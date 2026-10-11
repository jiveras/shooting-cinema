// Etapp 2: hitta laserpricken i en bildruta.
//
// Princip – "punktdetektor":
// En laserprick är en LITEN punkt som är MYCKET ljusare än allt runt omkring,
// åt alla håll. Ett ansikte, en lampa eller en röd tröja är stora och jämnt
// ljusa inuti – och en kant (t.ex. kind mot hår) har ljust på ena sidan.
//
//  1. Förfilter: pixeln måste vara ljus i röd kanal och inte blåstickig.
//  2. Ringtest: vi tittar på 8 punkter i en ring runt pixeln (radie R).
//     Pixeln måste vara minst `minContrast` ljusare än den LJUSASTE av dem.
//     Då faller stora ljusa ytor och kanter bort – bara riktiga punkter kvar.
//  3. Träffpixlar grupperas i klumpar (8×8-celler + flood fill).
//     För små/stora klumpar sorteras bort.
//  4. Klumpar inom en inlärd "ignorera"-zon (fasta prickar: lysdioder,
//     reflexer, lampor) hoppas över.
//  5. Av återstående klumpar väljs den med högst kontrast; dess tyngdpunkt
//     är laserns position (med decimalprecision).
//
// Med 650 nm-filter framför linsen blir detta nästan trivialt.

(function () {
  const DEFAULTS = {
    minBrightness: 170, // minsta värde i röd kanal (0–255)
    minContrast: 50, // hur mycket ljusare än omgivningen (ringen)
    minWarmth: 5, // röd minus blå – utesluter blåvita reflexer
    ringRadius: 12, // ringens radie i px; ska vara större än pricken
    minPixels: 2,
    maxPixels: 1500,
  };

  const CELL = 8;
  // 8 riktningar runt pixeln
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
      this.ignoreZones = []; // [{x, y, r}] i kamerapixlar
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
      // Förberäknade index-offset (i pixlar) för ringens 8 punkter
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
     * @param {ImageData} img  bildrutan; ändras om paintMask är true
     * @param {boolean} paintMask  färga laserpixlar gröna (för felsökning)
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

      // Hoppa över kanten där ringen skulle hamna utanför bilden
      for (let y = R; y < h - R; y++) {
        const rowCell = ((y / CELL) | 0) * cols;
        let p = (y * w + R) * 4;
        for (let x = R; x < w - R; x++, p += 4) {
          const r = d[p];
          if (r < minB) continue;
          if (r - d[p + 2] < minW) continue;

          // Ringtest: ljusaste punkten i ringen (max av r,g,b-medel ≈ r räcker)
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

      // Gruppera intilliggande celler till klumpar
      const rows = this._rows;
      const visited = this._visited;
      const stack = this._stack;
      visited.fill(0);

      let best = null;
      const blobs = []; // alla klumpar av rätt storlek (för inlärning av fasta prickar)
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

    // Separat pass för masken, så att färgningen inte stör ringtestet.
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
