// Synthesized gunshot sounds for the games – no audio files needed.
//
// Usage:
//   const guns = new Gunshots(() => audioContext);
//   guns.play('shotgun');
//   Gunshots.nameOf('shotgun', 'en')   // "Shotgun" (names in 'sv' and 'en')
//
// Types: 'shotgun' (with pump action), 'pistol', 'rifle', 'laser', 'off'.
// Everything is built from noise, oscillators, filters and a generated room
// echo (convolver).
//
// Rapid fire: every shot plays in its own "voice". When a new shot is fired,
// the previous voice fades out within a few hundredths of a second (like
// choking a cymbal), so the sounds never pile up.

(function () {
  const TYPES = [
    { id: 'shotgun', name: { sv: 'Hagelgevär', en: 'Shotgun' } },
    { id: 'pistol', name: { sv: 'Pistol', en: 'Pistol' } },
    { id: 'rifle', name: { sv: 'Gevär', en: 'Rifle' } },
    { id: 'laser', name: { sv: 'Laser', en: 'Laser' } },
    { id: 'off', name: { sv: 'Inget', en: 'None' } },
  ];

  const CHOKE_S = 0.04; // how quickly the previous shot fades out

  class Gunshots {
    /** @param {() => BaseAudioContext} getCtx */
    constructor(getCtx) {
      this.getCtx = getCtx;
      this.volume = 0.9;
      this._chains = new WeakMap();
      this._noise = new WeakMap();
      this._voice = null;
    }

    static get types() {
      return TYPES.map((t) => ({ id: t.id, name: { ...t.name } }));
    }

    static nameOf(id, lang = 'sv') {
      const name = (TYPES.find((t) => t.id === id) || TYPES[0]).name;
      return name[lang] || name.sv;
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
      if (!fn) return;
      const t = ctx.currentTime + 0.005;
      this._choke(t);
      this._voice = this._newVoice(ctx);
      fn.call(this, ctx, t, this._voice);
    }

    // ---------- Voices and output ----------

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
      comp.release.value = 0.15;
      master.connect(comp).connect(ctx.destination);

      const reverb = ctx.createConvolver();
      reverb.buffer = this._impulse(ctx, 0.9, 3.5); // small room – no long tail
      reverb.connect(master);

      c = { master, reverb };
      this._chains.set(ctx, c);
      return c;
    }

    // A voice = a dry and a wet bus that can be faded out together.
    _newVoice(ctx) {
      const { master, reverb } = this._chain(ctx);
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      dry.connect(master);
      wet.connect(reverb);
      return { ctx, dry, wet };
    }

    _choke(t) {
      const v = this._voice;
      if (!v) return;
      for (const g of [v.dry, v.wet]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + CHOKE_S);
      }
      // Disconnect once it has gone quiet
      setTimeout(() => {
        try { v.dry.disconnect(); v.wet.disconnect(); } catch { /* already disconnected */ }
      }, 1500);
    }

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

    _send(ctx, node, v, wet) {
      node.connect(v.dry);
      if (wet) {
        const s = ctx.createGain();
        s.gain.value = wet;
        node.connect(s).connect(v.wet);
      }
    }

    // ---------- Building blocks ----------

    /** A noise burst through a filter with a sweeping frequency. */
    _burst(ctx, v, t, { dur, gain, type = 'lowpass', f0, f1 = f0, q = 0.7, attack = 0.002, wet = 0 }) {
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
      src.connect(filt).connect(g);
      this._send(ctx, g, v, wet);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    }

    /** A low-frequency "thump" – the pressure wave you feel in your chest. */
    _thump(ctx, v, t, { f0, f1, dur, gain, wet = 0 }) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      this._send(ctx, g, v, wet);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    /** A metallic click (the mechanism). */
    _click(ctx, v, t, { freq, gain, dur = 0.03 }) {
      this._burst(ctx, v, t, { dur, gain, type: 'bandpass', f0: freq, f1: freq * 0.8, q: 6, attack: 0.001, wet: 0.1 });
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(freq * 0.35, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
      o.connect(g).connect(v.dry);
      o.start(t);
      o.stop(t + dur);
    }

    // ---------- Weapons ----------

    _shotgun(ctx, t, v) {
      // The powder blast: a broad noise burst that darkens quickly
      this._burst(ctx, v, t, { dur: 0.4, gain: 1.0, type: 'lowpass', f0: 7000, f1: 250, attack: 0.0015, wet: 0.45 });
      // The crack at the muzzle
      this._burst(ctx, v, t, { dur: 0.04, gain: 0.7, type: 'highpass', f0: 2500, f1: 1500, attack: 0.001 });
      // The pressure wave
      this._thump(ctx, v, t, { f0: 140, f1: 38, dur: 0.3, gain: 1.0, wet: 0.25 });
      this._thump(ctx, v, t + 0.01, { f0: 80, f1: 30, dur: 0.38, gain: 0.6 });
      // A short rumbling echo
      this._burst(ctx, v, t + 0.06, { dur: 0.45, gain: 0.15, type: 'lowpass', f0: 900, f1: 150, attack: 0.05, wet: 0.5 });
      // Pump action: click-clack
      this._click(ctx, v, t + 0.34, { freq: 2600, gain: 0.45, dur: 0.03 });
      this._burst(ctx, v, t + 0.35, { dur: 0.07, gain: 0.12, type: 'bandpass', f0: 1200, f1: 700, q: 2 });
      this._click(ctx, v, t + 0.48, { freq: 1900, gain: 0.55, dur: 0.04 });
      this._burst(ctx, v, t + 0.49, { dur: 0.06, gain: 0.14, type: 'bandpass', f0: 900, f1: 500, q: 2 });
    }

    _pistol(ctx, t, v) {
      this._burst(ctx, v, t, { dur: 0.16, gain: 0.85, type: 'lowpass', f0: 6000, f1: 600, attack: 0.001, wet: 0.25 });
      this._burst(ctx, v, t, { dur: 0.03, gain: 0.6, type: 'highpass', f0: 3000, f1: 2000, attack: 0.001 });
      this._thump(ctx, v, t, { f0: 220, f1: 70, dur: 0.1, gain: 0.7, wet: 0.1 });
      this._click(ctx, v, t + 0.07, { freq: 3200, gain: 0.2, dur: 0.02 }); // the slide
    }

    _rifle(ctx, t, v) {
      // A sharp supersonic crack
      this._burst(ctx, v, t, { dur: 0.05, gain: 1.0, type: 'highpass', f0: 1800, f1: 1200, attack: 0.0008 });
      this._burst(ctx, v, t, { dur: 0.28, gain: 0.8, type: 'lowpass', f0: 8000, f1: 400, attack: 0.001, wet: 0.45 });
      this._thump(ctx, v, t, { f0: 160, f1: 50, dur: 0.2, gain: 0.7, wet: 0.2 });
      // A short echo
      this._burst(ctx, v, t + 0.25, { dur: 0.3, gain: 0.16, type: 'lowpass', f0: 2500, f1: 300, attack: 0.01, wet: 0.5 });
    }

    _laser(ctx, t, v) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1800, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.18);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f).connect(g);
      this._send(ctx, g, v, 0.2);
      o.start(t);
      o.stop(t + 0.25);
    }
  }

  window.Gunshots = Gunshots;
})();
