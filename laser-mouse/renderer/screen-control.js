// Display selection, calibration, zeroing, test mode and mouse control.
//
// Flow:
//   Calibrate → the overlay opens on the chosen display and shows points one at a time
//            → the user holds the laser still on each point
//            → a homography is computed and saved per display
//            → test mode starts: a crosshair is shown where the app thinks the laser points.
//   Zero      → a target is shown in the centre; five shots give the median offset
//               between where the laser lands and where the user aimed.
//
// Status texts are stored as { key, params } and rendered with t(), so they
// re-render in the right language when the user switches language.

(function () {
  const { ScreenMapping, Calibrator, calibrationPoints, describePoint } = window.LaserCalibration;

  class ScreenControl {
    constructor({ $, store, camera }) {
      this.$ = $;
      this.store = store;
      this.camera = camera;
      this.bridge = window.laserMouse;
      this.displays = [];
      this.mode = 'idle'; // 'idle' | 'calibrate' | 'test' | 'zero'
      this.mapping = null;
      this.mappingOk = false;
      this.calibrator = null;
      this.lastScreen = null;
      this._pointerShown = false;
      this._status = { key: 'calib.none' };

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
        zero: $('zero-button'),
        zeroReset: $('zero-reset'),
        zeroStatus: $('zero-status'),
      };

      // ---- Sound and voice: calibrate without looking at the screen ----
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

      // ---- Zeroing ----
      // The laser is never exactly on the sight line. When zeroing, the user
      // aims at a target with the sights and fires a few shots; the median
      // offset is saved (per display) and subtracted from every hit.
      this.zero = null; // { dx, dy, spreadPx, shots }, normalized
      this.zeroing = null; // zeroing in progress
      this.el.zero.addEventListener('click', () => this.startZero());
      this.el.zeroReset.addEventListener('click', () => this.resetZero());

      // ---- Real mouse clicks ----
      // The click box is ticked by default, but clicks only go live once the
      // display is calibrated (see _syncMouse).
      this.mouseLive = false;
      this.clickCount = 0;
      this.lastClick = null;
      this._mouseNote = null; // { key, params } shown instead of the live status
      this.el.mouseClick.addEventListener('change', () => this._syncMouse());
      this.el.mouseFollow.addEventListener('change', () => this._syncMouse());
      this.bridge.onMouseDisabled((reason) => {
        this.el.mouseClick.checked = false;
        this.el.mouseFollow.checked = false;
        this.mouseLive = false;
        this._mouseNote = reason === 'shortcut' ? { key: 'mouse.offPanic' } : null;
        this._renderMouse();
        this.sounds.say(t('say.mouseOff'));
      });

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

      // Re-render everything that holds text when the language changes
      i18n.onChange((lang) => {
        this._renderDisplayOptions();
        this._updateUi();
        this._renderMouse();
        this.bridge.sendOverlay({ type: 'lang', lang });
      });
      this._renderMouse();
    }

    async init() {
      await this.refreshDisplays();
    }

    get display() {
      const id = Number(this.el.display.value);
      return this.displays.find((d) => d.id === id) || this.displays[0];
    }

    // ---------- Displays ----------

    async refreshDisplays() {
      this.displays = await this.bridge.listDisplays();
      const saved = Number(this.store.get('displayId'));
      const current = Number(this.el.display.value) || saved;
      this._renderDisplayOptions();
      // Default: the saved display, otherwise the first one that isn't the main display.
      const pick =
        this.displays.find((d) => d.id === current) ||
        this.displays.find((d) => !d.primary) ||
        this.displays[0];
      if (pick) this.el.display.value = pick.id;
      this._loadMapping();
      this._updateUi();
      this._syncMouse();
    }

    _renderDisplayOptions() {
      const selected = this.el.display.value;
      this.el.display.innerHTML = '';
      this.displays.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.id;
        // Electron's generic labels are replaced by a numbered name
        const generic = !d.label || /^(Skärm|Display) \d+$/.test(d.label);
        const name = generic ? t('display.name', { n: i + 1 }) : d.label;
        const primary = d.primary ? ` ${t('display.primary')}` : '';
        opt.textContent = `${name} – ${d.bounds.width}×${d.bounds.height}${primary}`;
        this.el.display.appendChild(opt);
      });
      if (selected) this.el.display.value = selected;
    }

    async _onDisplayChange() {
      await this._mouseOff();
      this.store.set('displayId', String(this.display.id));
      if (this.mode !== 'idle') await this.stop();
      this._loadMapping();
      this._updateUi();
      this._syncMouse();
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
        console.warn('Could not read calibration', e);
      }
      this._status = { key: this.mapping ? 'calib.ok' : 'calib.none' };
      this._loadZero();
    }

    // The calibration is valid for one image format. A resolution change with the
    // same aspect ratio is handled by rescaling; another aspect ratio needs re-calibration.
    _checkAspect(w, h) {
      if (!this.mapping) return false;
      const a = this.mapping.camWidth / this.mapping.camHeight;
      return Math.abs(a - w / h) / a < 0.01;
    }

    // ---------- Zeroing ----------

    _zeroKey() {
      return `zero:${this.display?.id}`;
    }

    _loadZero() {
      this.zero = null;
      try {
        const raw = this.store.get(this._zeroKey());
        if (raw) this.zero = JSON.parse(raw);
      } catch { /* ignore */ }
      this._updateZeroStatus();
    }

    _applyZero(s) {
      if (!this.zero) return s;
      return { x: s.x - this.zero.dx, y: s.y - this.zero.dy };
    }

    /** "116 px too far right and 12 px too high" in the current language. */
    _describeOffset(dx, dy) {
      const b = this.display.bounds;
      const px = Math.round(Math.abs(dx * b.width));
      const py = Math.round(Math.abs(dy * b.height));
      const h = px < 2 ? null : t(dx > 0 ? 'offset.right' : 'offset.left', { px });
      const v = py < 2 ? null : t(dy > 0 ? 'offset.low' : 'offset.high', { px: py });
      return [h, v].filter(Boolean).join(t('offset.and')) || t('offset.centre');
    }

    _updateZeroStatus() {
      const el = this.el.zeroStatus;
      if (!el) return;
      if (this.zeroing) {
        el.textContent = t('zero.progress', { n: this.zeroing.hits.length, total: this.zeroing.total });
      } else if (this.zero && this.display) {
        el.textContent = t('zero.status', {
          offset: this._describeOffset(this.zero.dx, this.zero.dy),
          spread: this.zero.spreadPx,
        });
      } else {
        el.textContent = t('zero.none');
      }
      el.classList.toggle('ok', !!this.zero && !this.zeroing);
      this.el.zeroReset.disabled = !this.zero || !!this.zeroing;
      this.el.zero.disabled = !this.mapping || !!this.zeroing;
    }

    async startZero() {
      if (!this.mapping) return this._setStatus('calib.calibrateFirst');
      if (!this.camera.running) return this._setStatus('calib.startCameraFirst');
      await this.bridge.openOverlay(this.display.id);
      this.mode = 'zero';
      this.zeroing = { target: { x: 0.5, y: 0.5 }, hits: [], total: 5 };
      this._overlayMode('zero');
      this._sendZero();
      this.sounds.start();
      this.sounds.say(t('say.zeroStart'));
      this._updateZeroStatus();
      this._updateUi();
    }

    resetZero() {
      this.zero = null;
      this.store.set(this._zeroKey(), '');
      this._updateZeroStatus();
    }

    _sendZero(result = null) {
      const z = this.zeroing;
      if (!z) return;
      this.bridge.sendOverlay({ type: 'zero', target: z.target, hits: z.hits, total: z.total, result });
    }

    _zeroShot(raw) {
      const z = this.zeroing;
      z.hits.push({ x: raw.x, y: raw.y });
      this.sounds.shot();
      this._updateZeroStatus();
      const left = z.total - z.hits.length;
      if (left > 0) {
        this._sendZero();
        setTimeout(() => this.sounds.say(t('say.left', { n: left })), 250);
        return;
      }
      this._finishZero();
    }

    _finishZero() {
      const z = this.zeroing;
      const med = (arr) => {
        const a = [...arr].sort((p, q) => p - q);
        const m = a.length >> 1;
        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      };
      // Median, so a single flinched shot can't ruin the result
      const dx = med(z.hits.map((h) => h.x - z.target.x));
      const dy = med(z.hits.map((h) => h.y - z.target.y));
      // Group size: median distance from the group centre, in screen pixels
      const b = this.display.bounds;
      const cx = z.target.x + dx;
      const cy = z.target.y + dy;
      const spreadPx = Math.round(med(z.hits.map((h) => Math.hypot((h.x - cx) * b.width, (h.y - cy) * b.height))));

      this.zero = { dx, dy, spreadPx, shots: z.hits.length };
      this.store.set(this._zeroKey(), JSON.stringify(this.zero));
      const text = t('zero.result', { offset: this._describeOffset(dx, dy) });
      this._sendZero({ dx, dy, text, spreadPx });
      this.sounds.done();
      setTimeout(() => this.sounds.say(t('say.zeroDone', { text })), 500);
      this.zeroing = null;
      this._updateZeroStatus();
      // Show the result for a while, then switch to test mode to verify it
      setTimeout(() => {
        if (this.mode === 'zero') this.startTest();
      }, 4500);
    }

    // ---------- Calibration and test mode ----------

    async startCalibration() {
      if (!this.camera.running) return this._setStatus('calib.startCameraFirst');
      await this._mouseOff();
      const d = this.display;
      if (!d) return;
      await this.bridge.openOverlay(d.id);
      // Guard against capturing the same spot twice: ~5 % of the frame width
      const minSeparation = Math.max(40, this.camera.canvas.width * 0.05);
      this.calibrator = new Calibrator(calibrationPoints(Number(this.el.points.value)), { minSeparation });
      this.mode = 'calibrate';
      this.sounds.start();
      this._announcePoint(0);
      this._overlayMode('calibrate');
      this._sendTarget({ progress: 0 });
      this._setStatus('calib.running');
    }

    async startTest() {
      if (!this.mapping) return this._setStatus('calib.calibrateFirst');
      await this.bridge.openOverlay(this.display.id);
      this.mode = 'test';
      this._pointerShown = false;
      this._overlayMode('test');
      this._updateUi();
    }

    async stop() {
      this.sounds.silence();
      if (this.mode === 'calibrate' || this.zeroing) this.sounds.say(t('say.cancelled'));
      this.zeroing = null;
      this._updateZeroStatus();
      if (this.mode === 'calibrate') this._status = { key: this.mapping ? 'calib.abortedKeep' : 'calib.aborted' };
      this.mode = 'idle';
      this.calibrator = null;
      await this.bridge.closeOverlay();
      this._updateUi();
    }

    _overlayMode(mode) {
      this.bridge.sendOverlay({ type: 'lang', lang: i18n.lang });
      this.bridge.sendOverlay({ type: 'mode', mode });
    }

    // ---------- Mouse control ----------

    // Pauses real mouse control (the boxes keep their state) – used while
    // calibrating or switching display. _syncMouse() resumes it.
    async _mouseOff() {
      if (!this.mouseLive) return;
      await this.bridge.mouseDisable();
      this.mouseLive = false;
      this._renderMouse();
    }

    async _syncMouse() {
      const want = this.el.mouseClick.checked || this.el.mouseFollow.checked;
      this._mouseNote = null;
      if (want && !this.mapping) {
        if (this.mouseLive) {
          await this.bridge.mouseDisable();
          this.mouseLive = false;
        }
        this._mouseNote = { key: 'mouse.calibrateFirst' };
        return this._renderMouse();
      }
      if (want && !this.mouseLive) {
        const res = await this.bridge.mouseEnable();
        if (!res.ok) {
          this.el.mouseClick.checked = this.el.mouseFollow.checked = false;
          this.mouseLive = false;
          this._mouseNote =
            res.reason === 'accessibility'
              ? { key: 'mouse.accessibility' }
              : { key: 'mouse.missing', params: { detail: res.detail || '' } };
          return this._renderMouse();
        }
        this.mouseLive = true;
        this.clickCount = 0;
        this.lastClick = null;
      } else if (!want && this.mouseLive) {
        await this.bridge.mouseDisable();
        this.mouseLive = false;
      }
      this._renderMouse();
    }

    _renderMouse() {
      const el = this.el.mouseStatus;
      let text;
      if (this._mouseNote) {
        text = t(this._mouseNote.key, this._mouseNote.params);
      } else if (!this.mouseLive) {
        text = t('mouse.off');
      } else {
        const parts = [];
        if (this.el.mouseClick.checked) parts.push(t('mouse.partClick'));
        if (this.el.mouseFollow.checked) parts.push(t('mouse.partFollow'));
        text = t('mouse.on', { parts: parts.join(', ') });
        if (this.lastClick) {
          text = t('mouse.clicks', { text, n: this.clickCount, x: this.lastClick.x, y: this.lastClick.y });
        }
      }
      el.textContent = text;
      el.classList.toggle('live', this.mouseLive);
    }

    async _realClick(s) {
      const res = await this.bridge.mouseClick(this.display.id, s.x, s.y);
      if (res.ok) {
        this.clickCount++;
        this.lastClick = { x: res.x, y: res.y };
        this._renderMouse();
      }
    }

    // ---------- Per frame ----------

    /** Called for every camera frame from app.js. */
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
        const raw = this.mapping.toScreen(
          (result.x * this.mapping.camWidth) / w,
          (result.y * this.mapping.camHeight) / h
        );
        if (this.mode === 'zero') {
          // While zeroing: uncorrected hits and no mouse clicks
          this.lastScreen = raw;
          if (isShot && this.zeroing) this._zeroShot(raw);
          return;
        }
        const s = this._applyZero(raw);
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

    /** Text for the "screen position" readout in the panel. */
    screenReadout() {
      if (this.mapping && !this.mappingOk) return t('readout.recalibrate');
      const s = this.lastScreen;
      const d = this.display;
      if (!s || !d) return '–';
      const x = Math.round(s.x * d.bounds.width);
      const y = Math.round(s.y * d.bounds.height);
      const inside = s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1;
      return inside ? `${x}, ${y}` : `${x}, ${y} ${t('readout.outside')}`;
    }

    _finishCalibration(w, h) {
      const pairs = this.calibrator.pairs;
      this.calibrator = null;
      try {
        this.mapping = ScreenMapping.fromPairs(pairs, w, h, this.display.id);
        this.store.set(this._key(), JSON.stringify(this.mapping.toJSON()));
        const d = this.display.bounds;
        if (pairs.length > 4) {
          const err = ((this.mapping.residual() * Math.hypot(d.width, d.height)) / Math.SQRT2).toFixed(1);
          this._status = { key: 'calib.okDetailError', params: { n: pairs.length, err } };
        } else {
          this._status = { key: 'calib.okDetail', params: { n: pairs.length } };
        }
        this.sounds.done();
        setTimeout(() => this.sounds.say(t('say.calibDone')), 500);
        this.startTest();
        this._syncMouse();
      } catch (e) {
        console.error(e);
        this._status = { key: 'calib.failed' };
        this.sounds.say(t('say.calibFailed'));
        this.stop();
      }
    }

    _announcePoint(index, delay = 0) {
      const c = this.calibrator;
      if (!c || index >= c.points.length) return;
      const text = t('say.point', { n: index + 1, where: t(`where.${describePoint(c.points[index])}`) });
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

    // Draw the screen outline into the camera view – shows that the calibration is right.
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

    _setStatus(key, params) {
      this._status = { key, params };
      this._updateUi();
    }

    _updateUi() {
      const busy = this.mode !== 'idle';
      this.el.status.textContent = t(this._status.key, this._status.params);
      this.el.status.classList.toggle('ok', !!this.mapping && this.mode !== 'calibrate');
      this.el.test.disabled = !this.mapping || this.mode === 'test';
      this.el.stop.disabled = !busy;
      this.el.calibrate.disabled = this.mode === 'calibrate' || this.mode === 'zero';
      this.el.test.textContent = t(this.mode === 'test' ? 'calib.testing' : 'calib.test');
      this._updateZeroStatus();
    }
  }

  window.ScreenControl = ScreenControl;
})();
