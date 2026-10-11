// Ljud- och röståterkoppling, så att man kan kalibrera och skjuta
// utan att titta på skärmen. Alla ljud syntetiseras med Web Audio –
// inga ljudfiler behövs.

(function () {
  class Sounds {
    constructor() {
      this.enabled = true;
      this.voice = true;
      this._ctx = null;
      this._tone = null; // pågående "lås"-ton
      this._lastBuzz = 0;
      this._svVoice = null;
      if ('speechSynthesis' in window) {
        const pick = () => {
          const voices = speechSynthesis.getVoices();
          this._svVoice =
            voices.find((v) => v.lang === 'sv-SE') || voices.find((v) => v.lang.startsWith('sv')) || null;
        };
        pick();
        speechSynthesis.addEventListener('voiceschanged', pick);
      }
    }

    get ctx() {
      if (!this._ctx) this._ctx = new AudioContext();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }

    // Kort ton med mjuk in-/uttoning
    _beep(freq, start, dur, { type = 'sine', gain = 0.18 } = {}) {
      const ctx = this.ctx;
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    /** Stigande ton medan lasern hålls stilla (progress 0–1). */
    progress(p) {
      if (!this.enabled) return;
      if (p <= 0) return this.stopProgress();
      const ctx = this.ctx;
      if (!this._tone) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.05);
        osc.connect(g).connect(ctx.destination);
        osc.start();
        this._tone = { osc, g };
      }
      const f = 330 * Math.pow(2, p * 1.4); // ca 330 → 870 Hz
      this._tone.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
    }

    stopProgress() {
      if (!this._tone) return;
      const { osc, g } = this._tone;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0, t, 0.02);
      osc.stop(t + 0.15);
      this._tone = null;
    }

    /** Punkt registrerad: två glada toner. */
    captured() {
      this.stopProgress();
      if (!this.enabled) return;
      this._beep(880, 0, 0.12);
      this._beep(1320, 0.1, 0.22);
    }

    /** Lasern står kvar på en redan registrerad punkt. */
    tooClose() {
      if (!this.enabled) return;
      const now = performance.now();
      if (now - this._lastBuzz < 1500) return;
      this._lastBuzz = now;
      this.stopProgress();
      this._beep(160, 0, 0.18, { type: 'square', gain: 0.06 });
      this._beep(160, 0.22, 0.18, { type: 'square', gain: 0.06 });
    }

    start() {
      if (!this.enabled) return;
      this._beep(660, 0, 0.15);
    }

    /** Kalibrering klar: stigande treklang. */
    done() {
      this.stopProgress();
      if (!this.enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => this._beep(f, i * 0.11, 0.3));
    }

    /** Skott i testläget: kort "pang" av filtrerat brus. */
    shot() {
      if (!this.enabled) return;
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 0.15);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(ctx.destination);
      src.start();
    }

    /** Säg något på svenska (avbryter pågående tal). */
    say(text) {
      if (!this.voice || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'sv-SE';
      if (this._svVoice) u.voice = this._svVoice;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    }

    silence() {
      this.stopProgress();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  }

  window.LaserSounds = Sounds;
})();
