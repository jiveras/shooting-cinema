// Fasta prickar: lär in ljusa punkter som INTE är lasern (lysdioder,
// reflexer, lampor) och be detektorn ignorera dem.
//
// Inlärning: med lasern släckt tittar vi ~2 s. Prickar som syns i minst
// en tredjedel av bildrutorna (även blinkande lysdioder) blir zoner.
// Zonerna sparas per kameraupplösning.

(function () {
  const LEARN_MS = 2000;
  const MERGE_PX = 15; // träffar närmare än så räknas som samma prick
  const MIN_SHARE = 0.3; // andel av bildrutorna pricken måste synas i

  class StaticSpots {
    constructor({ store, detector }) {
      this.store = store;
      this.detector = detector;
      this.size = null;
      this.learning = null; // { until, frames, clusters }
      this.onChange = () => {};
    }

    get zones() {
      return this.detector.ignoreZones;
    }

    _key() {
      return `ignoreZones:${this.size}`;
    }

    /** Anropas när kamerans upplösning är känd/ändrad. */
    setSize(w, h) {
      const size = `${w}x${h}`;
      if (size === this.size) return;
      this.size = size;
      let zones = [];
      try {
        zones = JSON.parse(this.store.get(this._key()) || '[]');
      } catch {
        zones = [];
      }
      this.detector.ignoreZones = zones;
      this.onChange();
    }

    startLearning() {
      this.learning = { until: performance.now() + LEARN_MS, frames: 0, clusters: [] };
      this.onChange();
    }

    clear() {
      this.detector.ignoreZones = [];
      this.store.set(this._key(), '[]');
      this.onChange();
    }

    /** Per bildruta. Returnerar true när en inlärning just blev klar. */
    feed(result) {
      const L = this.learning;
      if (!L) return false;

      L.frames++;
      for (const b of result.blobs || []) {
        if (b.ignored) continue; // redan känd
        let c = L.clusters.find((k) => Math.hypot(k.x - b.x, k.y - b.y) < MERGE_PX);
        if (!c) {
          c = { x: b.x, y: b.y, n: 0, pixels: 0, lastFrame: -1 };
          L.clusters.push(c);
        }
        if (c.lastFrame === L.frames) continue;
        c.lastFrame = L.frames;
        c.x += (b.x - c.x) / (c.n + 1);
        c.y += (b.y - c.y) / (c.n + 1);
        c.pixels = Math.max(c.pixels, b.pixels);
        c.n++;
      }

      if (performance.now() < L.until) return false;

      const added = L.clusters
        .filter((c) => c.n >= L.frames * MIN_SHARE)
        .map((c) => ({
          x: Math.round(c.x * 10) / 10,
          y: Math.round(c.y * 10) / 10,
          r: Math.round(Math.max(15, 2 * Math.sqrt(c.pixels / Math.PI) + 8)),
        }));
      this.detector.ignoreZones = [...this.zones, ...added];
      this.store.set(this._key(), JSON.stringify(this.zones));
      this.lastAdded = added.length;
      this.learning = null;
      this.onChange();
      return true;
    }

    /** Rita zonerna i kamerabilden. */
    draw(ctx) {
      if (!this.zones.length) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(160, 170, 185, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (const z of this.zones) {
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        const d = z.r * 0.5;
        ctx.moveTo(z.x - d, z.y - d);
        ctx.lineTo(z.x + d, z.y + d);
        ctx.moveTo(z.x + d, z.y - d);
        ctx.lineTo(z.x - d, z.y + d);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  window.StaticSpots = StaticSpots;
})();
