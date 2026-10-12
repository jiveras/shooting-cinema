// Sound and voice feedback, so you can calibrate and shoot without looking
// at the screen. All sounds are synthesized with Web Audio – no audio files.
// Speech uses the system voices in the current UI language (i18n.lang).

(function () {
  const VOICE_LANG = { sv: 'sv-SE', en: 'en-GB' };

  class Sounds {
    constructor() {
      this.enabled = true;
      this.voice = true;
      this._ctx = null;
      this._tone = null; // the "lock-on" tone in progress
      this._lastBuzz = 0;
      this._voices = [];
      if ('speechSynthesis' in window) {
        const load = () => {
          this._voices = speechSynthesis.getVoices();
        };
        load();
        speechSynthesis.addEventListener('voiceschanged', load);
      }
    }

    get ctx() {
      if (!this._ctx) this._ctx = new AudioContext();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }

    // Short tone with a soft fade in/out
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

    /** Rising tone while the laser is held still (progress 0–1). */
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
      const f = 330 * Math.pow(2, p * 1.4); // about 330 → 870 Hz
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

    /** Point captured: two cheerful notes. */
    captured() {
      this.stopProgress();
      if (!this.enabled) return;
      this._beep(880, 0, 0.12);
      this._beep(1320, 0.1, 0.22);
    }

    /** The laser is still on a point that has already been captured. */
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

    /** Calibration done: a rising arpeggio. */
    done() {
      this.stopProgress();
      if (!this.enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => this._beep(f, i * 0.11, 0.3));
    }

    /** Shot in test mode: a short "bang" of filtered noise. */
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

    /** Pick a system voice for the current language (prefer the exact locale). */
    _voiceFor(lang) {
      const locale = VOICE_LANG[lang] || lang;
      return (
        this._voices.find((v) => v.lang === locale) ||
        this._voices.find((v) => v.lang.replace('_', '-').startsWith(lang)) ||
        null
      );
    }

    /** Speak a text in the current UI language (interrupts ongoing speech). */
    say(text) {
      if (!this.voice || !('speechSynthesis' in window)) return;
      const lang = (window.i18n && window.i18n.lang) || 'sv';
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = VOICE_LANG[lang] || lang;
      const voice = this._voiceFor(lang);
      if (voice) u.voice = voice;
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
