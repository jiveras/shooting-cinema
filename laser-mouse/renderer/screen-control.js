// Etapp 3: skärmval, kalibreringsflöde och testläge (utan klick).
//
// Flöde:
//   Kalibrera → överlägg öppnas på vald skärm och visar punkter en i taget
//            → användaren håller lasern stilla på varje punkt
//            → homografi räknas ut och sparas per skärm
//            → testläge startar: kryss visas där appen tror att lasern pekar.

(function () {
  const { ScreenMapping, Calibrator, calibrationPoints, describePoint } = window.LaserCalibration;

  class ScreenControl {
    constructor({ $, store, camera }) {
      this.$ = $;
      this.store = store;
      this.camera = camera;
      this.bridge = window.laserMouse;
      this.displays = [];
      this.mode = 'idle'; // 'idle' | 'calibrate' | 'test'
      this.mapping = null;
      this.mappingOk = false;
      this.calibrator = null;
      this.lastScreen = null;
      this._pointerShown = false;
      this._status = '';

      this.el = {
        display: $('display-select'),
        points: $('points-select'),
        calibrate: $('calibrate-button'),
        test: $('test-button'),
        stop: $('stop-button'),
        status: $('calib-status'),
        sound: $('sound-enabled'),
        voice: $('voice-enabled'),
        mouseClick: $('mouse-click'),
        mouseFollow: $('mouse-follow'),
        mouseStatus: $('mouse-status'),
      };

      // ---- Etapp 4: riktiga musklick ----
      // Alltid AV vid start, av säkerhetsskäl.
      this.mouseLive = false;
      this.clickCount = 0;
      this._mouseStatus = 'Av';
      this.el.mouseClick.addEventListener('change', () => this._syncMouse());
      this.el.mouseFollow.addEventListener('change', () => this._syncMouse());
      this.bridge.onMouseDisabled((reason) => {
        this.el.mouseClick.checked = false;
        this.el.mouseFollow.checked = false;
        this.mouseLive = false;
        this._setMouseStatus(reason === 'shortcut' ? 'Av (nödstopp med ⌘⇧L)' : 'Av');
        this.sounds.say('Musklick av');
      });

      // Ljud och röst – så att man kan kalibrera utan att titta på skärmen.
      this.sounds = new window.LaserSounds();
      this.el.sound.checked = store.get('soundEnabled') !== '0';
      this.el.voice.checked = store.get('voiceEnabled') !== '0';
      const syncSound = () => {
        this.sounds.enabled = this.el.sound.checked;
        this.sounds.voice = this.el.voice.checked;
        store.set('soundEnabled', this.el.sound.checked ? '1' : '0');
        store.set('voiceEnabled', this.el.voice.checked ? '1' : '0');
        if (!this.el.sound.checked) this.sounds.stopProgress();
      };
      this.el.sound.addEventListener('change', syncSound);
      this.el.voice.addEventListener('change', syncSound);
      syncSound();

      this.el.points.value = store.get('calibPoints') || '4';
      this.el.points.addEventListener('change', () => store.set('calibPoints', this.el.points.value));
      this.el.display.addEventListener('change', () => this._onDisplayChange());
      this.el.calibrate.addEventListener('click', () => this.startCalibration());
      this.el.test.addEventListener('click', () => this.startTest());
      this.el.stop.addEventListener('click', () => this.stop());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.mode !== 'idle') this.stop();
      });

      this.bridge.onDisplaysChanged(() => this.refreshDisplays());
      this.bridge.onOverlayClosed(() => {
        this.mode = 'idle';
        this._updateUi();
      });
    }

    async init() {
      await this.refreshDisplays();
    }

    get display() {
      const id = Number(this.el.display.value);
      return this.displays.find((d) => d.id === id) || this.displays[0];
    }

    async refreshDisplays() {
      this.displays = await this.bridge.listDisplays();
      const saved = Number(this.store.get('displayId'));
      const current = Number(this.el.display.value) || saved;
      this.el.display.innerHTML = '';
      this.displays.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.id;
        const name = d.label && !/^Skärm \d+$/.test(d.label) ? d.label : `Skärm ${i + 1}`;
        opt.textContent = `${name} – ${d.bounds.width}×${d.bounds.height}${d.primary ? ' (huvudskärm)' : ''}`;
        this.el.display.appendChild(opt);
      });
      // Förval: sparad skärm, annars första som inte är huvudskärm.
      const pick =
        this.displays.find((d) => d.id === current) ||
        this.displays.find((d) => !d.primary) ||
        this.displays[0];
      if (pick) this.el.display.value = pick.id;
      this._loadMapping();
      this._updateUi();
    }

    async _mouseOff() {
      if (!this.mouseLive && !this.el.mouseClick.checked && !this.el.mouseFollow.checked) return;
      this.el.mouseClick.checked = this.el.mouseFollow.checked = false;
      await this._syncMouse();
    }

    async _onDisplayChange() {
      await this._mouseOff();
      this.store.set('displayId', String(this.display.id));
      const wasActive = this.mode;
      if (wasActive !== 'idle') await this.stop();
      this._loadMapping();
      this._updateUi();
    }

    _key() {
      return `calibration:${this.display?.id}`;
    }

    _loadMapping() {
      this.mapping = null;
      try {
        const raw = this.store.get(this._key());
        if (raw) this.mapping = new ScreenMapping(JSON.parse(raw));
      } catch (e) {
        console.warn('Kunde inte läsa kalibrering', e);
      }
      this._status = this.mapping ? 'Kalibrerad ✓' : 'Inte kalibrerad för den här skärmen';
    }

    // Kalibreringen gäller samma bildformat. Byter man upplösning med samma
    // proportioner skalar vi bara om; andra proportioner kräver ny kalibrering.
    _checkAspect(w, h) {
      if (!this.mapping) return false;
      const a = this.mapping.camWidth / this.mapping.camHeight;
      return Math.abs(a - w / h) / a < 0.01;
    }

    async startCalibration() {
      if (!this.camera.running) return this._setStatus('Starta kameran först.');
      await this._mouseOff();
      const d = this.display;
      if (!d) return;
      await this.bridge.openOverlay(d.id);
      // Spärr mot dubbelregistrering: ~5 % av bildbredden
      const minSeparation = Math.max(40, this.camera.canvas.width * 0.05);
      this.calibrator = new Calibrator(calibrationPoints(Number(this.el.points.value)), { minSeparation });
      this.mode = 'calibrate';
      this.sounds.start();
      this._announcePoint(0);
      this.bridge.sendOverlay({ type: 'mode', mode: 'calibrate' });
      this._sendTarget({ progress: 0 });
      this._setStatus('Kalibrerar… sikta på punkterna på skärmen. Esc avbryter.');
      this._updateUi();
    }

    async startTest() {
      if (!this.mapping) return this._setStatus('Kalibrera först.');
      await this.bridge.openOverlay(this.display.id);
      this.mode = 'test';
      this._pointerShown = false;
      this.bridge.sendOverlay({ type: 'mode', mode: 'test' });
      this._updateUi();
    }

    async stop() {
      this.sounds.silence();
      if (this.mode === 'calibrate') this.sounds.say('Avbrutet');
      if (this.mode === 'calibrate') this._setStatus(this.mapping ? 'Kalibrerad ✓ (avbröt ny kalibrering)' : 'Kalibrering avbruten');
      this.mode = 'idle';
      this.calibrator = null;
      await this.bridge.closeOverlay();
      this._updateUi();
    }

    async _syncMouse() {
      const want = this.el.mouseClick.checked || this.el.mouseFollow.checked;
      if (want && !this.mapping) {
        this.el.mouseClick.checked = this.el.mouseFollow.checked = false;
        return this._setMouseStatus('Kalibrera först');
      }
      if (want && !this.mouseLive) {
        const res = await this.bridge.mouseEnable();
        if (!res.ok) {
          this.el.mouseClick.checked = this.el.mouseFollow.checked = false;
          this.mouseLive = false;
          if (res.reason === 'accessibility') {
            return this._setMouseStatus(
              'macOS behöver ge appen "Hjälpmedel"-behörighet. Slå på Electron under ' +
                'Systeminställningar → Integritet och säkerhet → Hjälpmedel, starta om appen och försök igen.'
            );
          }
          return this._setMouseStatus(
            `Musstyrningen kunde inte laddas – kör "npm install" igen. ${res.detail || ''}`
          );
        }
        this.mouseLive = true;
        this.clickCount = 0;
      } else if (!want && this.mouseLive) {
        await this.bridge.mouseDisable();
        this.mouseLive = false;
      }
      this._setMouseStatus(this._mouseText());
    }

    _mouseText() {
      if (!this.mouseLive) return 'Av';
      const parts = [];
      if (this.el.mouseClick.checked) parts.push('klickar vid skott');
      if (this.el.mouseFollow.checked) parts.push('pekaren följer lasern');
      return `PÅ – ${parts.join(', ')}`;
    }

    _setMouseStatus(text) {
      this._mouseStatus = text;
      this.el.mouseStatus.textContent = text;
      this.el.mouseStatus.classList.toggle('live', this.mouseLive);
    }

    async _realClick(s) {
      const res = await this.bridge.mouseClick(this.display.id, s.x, s.y);
      if (res.ok) {
        this.clickCount++;
        this._setMouseStatus(`${this._mouseText()} · ${this.clickCount} klick, senast ${res.x}, ${res.y}`);
      }
    }

    /** Anropas för varje bildruta från app.js. */
    frame(ctx, result, isShot, w, h) {
      if (this.mode === 'calibrate' && this.calibrator) {
        const r = this.calibrator.feed(result);
        if (r.captured) {
          this.bridge.sendOverlay({ type: 'flash' });
          this.sounds.captured();
          if (!r.done) this._announcePoint(this.calibrator.index, 350);
        } else if (r.waiting) {
          this.sounds.tooClose();
        } else {
          this.sounds.progress(r.progress);
        }
        if (r.done) this._finishCalibration(w, h);
        else this._sendTarget(r);
        this._drawCaptured(ctx);
        return;
      }

      this.mappingOk = this._checkAspect(w, h);
      if (!this.mapping || !this.mappingOk) {
        this.lastScreen = null;
        return;
      }

      this._drawOutline(ctx, w, h);

      if (result.found) {
        const s = this.mapping.toScreen(
          (result.x * this.mapping.camWidth) / w,
          (result.y * this.mapping.camHeight) / h
        );
        this.lastScreen = s;
        const inside = s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1;
        if (this.mouseLive && inside) {
          if (this.el.mouseFollow.checked) this.bridge.mouseMove(this.display.id, s.x, s.y);
          if (isShot && this.el.mouseClick.checked) this._realClick(s);
        }
        if (this.mode === 'test') {
          this.bridge.sendOverlay({ type: 'pointer', found: true, x: s.x, y: s.y });
          this._pointerShown = true;
          if (isShot) {
            this.bridge.sendOverlay({ type: 'shot', x: s.x, y: s.y });
            this.sounds.shot();
          }
        }
      } else {
        this.lastScreen = null;
        if (this.mode === 'test' && this._pointerShown) {
          this.bridge.sendOverlay({ type: 'pointer', found: false });
          this._pointerShown = false;
        }
      }
    }

    /** Text för avläsningen i panelen. */
    screenReadout() {
      if (this.mapping && !this.mappingOk) return 'Kalibrera om (nytt bildformat)';
      const s = this.lastScreen;
      const d = this.display;
      if (!s || !d) return '–';
      const x = Math.round(s.x * d.bounds.width);
      const y = Math.round(s.y * d.bounds.height);
      const inside = s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1;
      return inside ? `${x}, ${y}` : `${x}, ${y} (utanför)`;
    }

    _finishCalibration(w, h) {
      const pairs = this.calibrator.pairs;
      this.calibrator = null;
      try {
        this.mapping = ScreenMapping.fromPairs(pairs, w, h, this.display.id);
        this.store.set(this._key(), JSON.stringify(this.mapping.toJSON()));
        const d = this.display.bounds;
        const errPx = pairs.length > 4
          ? ` · medelfel ${(this.mapping.residual() * Math.hypot(d.width, d.height) / Math.SQRT2).toFixed(1)} px`
          : '';
        this._setStatus(`Kalibrerad ✓ (${pairs.length} punkter${errPx})`);
        this.sounds.done();
        setTimeout(() => this.sounds.say('Klart. Testläge.'), 500);
        this.startTest();
      } catch (e) {
        console.error(e);
        this._setStatus(`Kalibreringen misslyckades: ${e.message}. Försök igen.`);
        this.sounds.say('Kalibreringen misslyckades. Försök igen.');
        this.stop();
      }
    }

    _announcePoint(index, delay = 0) {
      const c = this.calibrator;
      if (!c || index >= c.points.length) return;
      const text = `Punkt ${index + 1}, ${describePoint(c.points[index])}`;
      setTimeout(() => this.sounds.say(text), delay);
    }

    _sendTarget(r) {
      const c = this.calibrator;
      if (!c || c.done) return;
      this.bridge.sendOverlay({
        type: 'target',
        x: c.current.x,
        y: c.current.y,
        index: c.index,
        total: c.points.length,
        progress: r.progress || 0,
        waiting: !!r.waiting,
        captured: c.pairs.map((p) => p.screen),
      });
    }

    // Rita skärmens kontur i kamerabilden – visar att kalibreringen stämmer.
    _drawOutline(ctx, w, h) {
      const m = this.mapping;
      const sx = w / m.camWidth;
      const sy = h / m.camHeight;
      const pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
        const p = m.toCamera(u, v);
        return [p.x * sx, p.y * sy];
      });
      ctx.save();
      ctx.strokeStyle = 'rgba(63, 182, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    _drawCaptured(ctx) {
      if (!this.calibrator) return;
      ctx.save();
      ctx.strokeStyle = '#2fd27a';
      ctx.lineWidth = 2;
      for (const p of this.calibrator.pairs) {
        ctx.beginPath();
        ctx.arc(p.cam.x, p.cam.y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _setStatus(text) {
      this._status = text;
      this._updateUi();
    }

    _updateUi() {
      const busy = this.mode !== 'idle';
      this.el.status.textContent = this._status;
      this.el.status.classList.toggle('ok', !!this.mapping && this.mode !== 'calibrate');
      this.el.test.disabled = !this.mapping || this.mode === 'test';
      this.el.stop.disabled = !busy;
      this.el.calibrate.disabled = this.mode === 'calibrate';
      this.el.test.textContent = this.mode === 'test' ? 'Testar…' : 'Testa';
    }
  }

  window.ScreenControl = ScreenControl;
})();
