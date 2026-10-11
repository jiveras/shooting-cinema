// Syntetiserade skottljud för spelen – inga ljudfiler behövs.
//
// Användning:
//   const guns = new Gunshots(() => audioContext);
//   guns.play('shotgun');
//
// Typer: 'shotgun' (hagelgevär med pumprepetering), 'pistol', 'rifle',
// 'laser', 'off'. Allt byggs av brus, oscillatorer, filter och ett
// genererat rumseko (convolver).

(function () {
  const TYPES = [
    { id: 'shotgun', name: 'Hagelgevär' },
    { id: 'pistol', name: 'Pistol' },
    { id: 'rifle', name: 'Gevär' },
    { id: 'laser', name: 'Laser' },
    { id: 'off', name: 'Inget' },
  ];

  class Gunshots {
    /** @param {() => BaseAudioContext} getCtx */
    constructor(getCtx) {
      this.getCtx = getCtx;
      this.volume = 0.9;
      this._chains = new WeakMap();
      this._noise = new WeakMap();
    }

    static get types() {
      return TYPES.map((t) => ({ ...t }));
    }

    static nameOf(id) {
      return (TYPES.find((t) => t.id === id) || TYPES[0]).name;
    }

    static next(id) {
      const i = TYPES.findIndex((t) => t.id === id);
      return TYPES[(i + 1) % TYPES.length].id;
    }

    play(type) {
      if (!type || type === 'off') return;
      let ctx;
      try {
        ctx = this.getCtx();
      } catch {
        return;
      }
      if (!ctx) return;
      const fn = this['_' + type];
      if (fn) fn.call(this, ctx, ctx.currentTime + 0.005);
    }

    // ---------- Byggstenar ----------

    // Utgång: kompressor för "punch" + rumseko på en send-buss.
    _chain(ctx) {
      let c = this._chains.get(ctx);
      if (c) return c;
      const master = ctx.createGain();
      master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 6;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      master.connect(comp).connect(ctx.destination);

      const reverb = ctx.createConvolver();
      reverb.buffer = this._impulse(ctx, 2.2, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 1;
      reverb.connect(wet).connect(master);

      c = { master, reverb };
      this._chains.set(ctx, c);
      return c;
    }

    // Genererat rumseko: stereobrus som dör ut exponentiellt.
    _impulse(ctx, seconds, decay) {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    _noiseBuf(ctx) {
      let b = this._noise.get(ctx);
      if (b) return b;
      const len = ctx.sampleRate * 2;
      b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise.set(ctx, b);
      return b;
    }

    /** Brusstöt genom ett filter med svepande frekvens. */
    _burst(ctx, t, { dur, gain, type = 'lowpass', f0, f1 = f0, q = 0.7, attack = 0.002, wet = 0 }) {
      const { master, reverb } = this._chain(ctx);
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuf(ctx);
      const filt = ctx.createBiquadFilter();
      filt.type = type;
      filt.Q.value = q;
      filt.frequency.setValueAtTime(f0, t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt).connect(g).connect(master);
      if (wet) {
        const s = ctx.createGain();
        s.gain.value = wet;
        g.connect(s).connect(reverb);
      }
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    }

    /** Lågfrekvent "dunk" – tryckvågen i bröstet. */
    _thump(ctx, t, { f0, f1, dur, gain, wet = 0 }) {
      const { master, reverb } = this._chain(ctx);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      if (wet) {
        const s = ctx.createGain();
        s.gain.value = wet;
        g.connect(s).connect(reverb);
      }
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    /** Metalliskt klick (mekanism). */
    _click(ctx, t, { freq, gain, dur = 0.03 }) {
      this._burst(ctx, t, { dur, gain, type: 'bandpass', f0: freq, f1: freq * 0.8, q: 6, attack: 0.001, wet: 0.1 });
      const { master } = this._chain(ctx);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(freq * 0.35, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur);
    }

    // ---------- Vapen ----------

    _shotgun(ctx, t) {
      // Krutsmällen: bred brusstöt som mörknar snabbt
      this._burst(ctx, t, { dur: 0.7, gain: 1.0, type: 'lowpass', f0: 7000, f1: 250, attack: 0.0015, wet: 0.55 });
      // Knallen i mynningen
      this._burst(ctx, t, { dur: 0.05, gain: 0.7, type: 'highpass', f0: 2500, f1: 1500, attack: 0.001 });
      // Tryckvågen
      this._thump(ctx, t, { f0: 140, f1: 38, dur: 0.45, gain: 1.0, wet: 0.3 });
      this._thump(ctx, t + 0.01, { f0: 80, f1: 30, dur: 0.6, gain: 0.6 });
      // Mullrande eko
      this._burst(ctx, t + 0.08, { dur: 1.2, gain: 0.18, type: 'lowpass', f0: 900, f1: 120, attack: 0.08, wet: 0.6 });
      // Pumprepetering: klick-klack
      this._click(ctx, t + 0.55, { freq: 2600, gain: 0.45, dur: 0.035 });
      this._burst(ctx, t + 0.56, { dur: 0.09, gain: 0.12, type: 'bandpass', f0: 1200, f1: 700, q: 2 });
      this._click(ctx, t + 0.74, { freq: 1900, gain: 0.55, dur: 0.045 });
      this._burst(ctx, t + 0.75, { dur: 0.08, gain: 0.14, type: 'bandpass', f0: 900, f1: 500, q: 2 });
    }

    _pistol(ctx, t) {
      this._burst(ctx, t, { dur: 0.22, gain: 0.85, type: 'lowpass', f0: 6000, f1: 600, attack: 0.001, wet: 0.3 });
      this._burst(ctx, t, { dur: 0.03, gain: 0.6, type: 'highpass', f0: 3000, f1: 2000, attack: 0.001 });
      this._thump(ctx, t, { f0: 220, f1: 70, dur: 0.12, gain: 0.7, wet: 0.15 });
      this._click(ctx, t + 0.09, { freq: 3200, gain: 0.2, dur: 0.02 }); // slutstycket
    }

    _rifle(ctx, t) {
      // Skarp överljudsknall
      this._burst(ctx, t, { dur: 0.06, gain: 1.0, type: 'highpass', f0: 1800, f1: 1200, attack: 0.0008 });
      this._burst(ctx, t, { dur: 0.4, gain: 0.8, type: 'lowpass', f0: 8000, f1: 400, attack: 0.001, wet: 0.5 });
      this._thump(ctx, t, { f0: 160, f1: 50, dur: 0.25, gain: 0.7, wet: 0.2 });
      // Eko från en avlägsen skogskant
      this._burst(ctx, t + 0.42, { dur: 0.5, gain: 0.22, type: 'lowpass', f0: 2500, f1: 300, attack: 0.01, wet: 0.7 });
      this._burst(ctx, t + 0.9, { dur: 0.6, gain: 0.09, type: 'lowpass', f0: 1500, f1: 200, attack: 0.02, wet: 0.8 });
    }

    _laser(ctx, t) {
      const { master, reverb } = this._chain(ctx);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1800, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.22);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(f).connect(g).connect(master);
      const s = ctx.createGain();
      s.gain.value = 0.25;
      g.connect(s).connect(reverb);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  window.Gunshots = Gunshots;
})();
