// Kopplar ihop gränssnittet med kameran.

(function () {
  const $ = (id) => document.getElementById(id);
  const cameraSelect = $('camera-select');
  const resolutionSelect = $('resolution-select');
  const toggleButton = $('toggle-button');
  const message = $('message');
  const statusResolution = $('status-resolution');
  const statusFps = $('status-fps');
  const statusVersions = $('status-versions');

  const camera = new window.LaserCamera($('video'), $('canvas'));

  const store = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignorera */ }
    },
  };

  // ---- Etapp 2: laserdetektering ----

  const SETTINGS_KEY = 'detectorSettings.v2';
  const sliderIds = ['minContrast', 'minBrightness', 'minWarmth', 'ringRadius', 'minPixels', 'maxPixels'];
  const checkIds = [];

  function loadSettings() {
    try {
      return { ...window.LaserDetector.defaults, ...JSON.parse(store.get(SETTINGS_KEY) || '{}') };
    } catch {
      return window.LaserDetector.defaults;
    }
  }

  const detector = new window.LaserDetector(loadSettings());
  const showMask = $('showMask');
  showMask.checked = store.get('showMask') === '1';

  function syncControls() {
    for (const id of sliderIds) {
      $(id).value = detector.settings[id];
      document.querySelector(`output[data-for="${id}"]`).textContent = detector.settings[id];
    }
    for (const id of checkIds) $(id).checked = !!detector.settings[id];
  }

  function saveSettings() {
    store.set(SETTINGS_KEY, JSON.stringify(detector.settings));
  }

  for (const id of sliderIds) {
    $(id).addEventListener('input', (e) => {
      detector.update({ [id]: Number(e.target.value) });
      document.querySelector(`output[data-for="${id}"]`).textContent = e.target.value;
      saveSettings();
    });
  }
  for (const id of checkIds) {
    $(id).addEventListener('change', (e) => {
      detector.update({ [id]: e.target.checked });
      saveSettings();
    });
  }
  showMask.addEventListener('change', () => store.set('showMask', showMask.checked ? '1' : '0'));
  $('reset-settings').addEventListener('click', () => {
    detector.update(window.LaserDetector.defaults);
    saveSettings();
    syncControls();
  });
  syncControls();

  // Skott = lasern dyker upp efter att ha varit borta några bildrutor.
  // (Tänkt för vapenattrappen som blinkar lasern vid avtryck.)
  const MIN_GAP_FRAMES = 3;
  const shotList = [];
  let present = false;
  let absentFrames = MIN_GAP_FRAMES;
  let shotCount = 0;
  let detectMs = 0;
  let last = { found: false, x: 0, y: 0, pixels: 0, total: 0, contrast: 0 };

  $('reset-shots').addEventListener('click', () => {
    shotList.length = 0;
    shotCount = 0;
  });

  // ---- Etapp 3: skärm och kalibrering ----
  const screenControl = new window.ScreenControl({ $, store, camera });

  // ---- Fasta prickar (ignorera-zoner) ----
  const spots = new window.StaticSpots({ store, detector });
  const spotsStatus = $('spots-status');
  spots.onChange = () => {
    const n = spots.zones.length;
    if (spots.learning) {
      spotsStatus.textContent = 'Lär in… håll lasern släckt';
    } else {
      spotsStatus.textContent = n === 0 ? 'Inga ignoreras' : `${n} ${n === 1 ? 'prick' : 'prickar'} ignoreras`;
    }
    spotsStatus.classList.toggle('ok', n > 0 && !spots.learning);
    $('learn-spots').disabled = !!spots.learning;
    $('clear-spots').disabled = n === 0 || !!spots.learning;
  };
  $('learn-spots').addEventListener('click', () => {
    if (!camera.running) return;
    screenControl.sounds.start();
    spots.startLearning();
  });
  $('clear-spots').addEventListener('click', () => spots.clear());
  spots.onChange();

  camera.onFrame((ctx, w, h) => {
    spots.setSize(w, h);
    const t0 = performance.now();
    const img = ctx.getImageData(0, 0, w, h);
    const result = detector.detect(img, showMask.checked);
    if (showMask.checked) ctx.putImageData(img, 0, 0);
    detectMs = detectMs * 0.9 + (performance.now() - t0) * 0.1;

    // Under inlärning används ingen träff alls (lasern ska vara släckt).
    if (spots.learning) {
      if (spots.feed(result)) {
        screenControl.sounds.captured();
        const a = spots.lastAdded;
        screenControl.sounds.say(a === 0 ? 'Inga nya prickar' : `${a} ${a === 1 ? 'prick' : 'prickar'} ignoreras`);
      }
      spots.draw(ctx);
      return;
    }

    const now = performance.now();
    let isShot = false;
    if (result.found) {
      if (!present && absentFrames >= MIN_GAP_FRAMES) {
        isShot = true;
        shotList.push({ x: result.x, y: result.y, t: now });
        if (shotList.length > 50) shotList.shift();
        shotCount++;
      }
      present = true;
      absentFrames = 0;
    } else {
      present = false;
      absentFrames++;
    }

    spots.draw(ctx);
    screenControl.frame(ctx, result, isShot, w, h);
    window.LaserOverlay.shots(ctx, shotList, now);
    if (result.found) window.LaserOverlay.crosshair(ctx, result.x, result.y, '#00e5ff');
    last = result;
  });

  // Uppdatera panelen i lugnare takt än bildfrekvensen.
  setInterval(() => {
    const state = $('laser-state');
    state.textContent = last.found ? 'Laser hittad' : 'Ingen laser';
    state.classList.toggle('on', last.found);
    $('laser-pos').textContent = last.found ? `${Math.round(last.x)}, ${Math.round(last.y)}` : '–';
    $('laser-pixels').textContent = last.pixels ? last.pixels : '–';
    $('laser-contrast').textContent = last.found ? Math.round(last.contrast) : '–';
    $('laser-total').textContent = last.total;
    $('shot-count').textContent = shotCount;
    $('screen-pos').textContent = screenControl.screenReadout();
    $('status-detect').textContent = camera.running ? `detektering ${detectMs.toFixed(1)} ms` : '– ms';
  }, 100);

  // ---- Kameraexponering (om kameran stöder det) ----
  // Kortare exponering = mörkare bild men laserpricken blåses inte ut,
  // och allt annat försvinner. Stöds inte av alla kameror/plattformar.
  function buildExposureControls() {
    const host = $('exposure-controls');
    host.innerHTML = '';
    const caps = camera.capabilities();
    const settings = camera.settings();
    const parts = [];

    const addSlider = (key, label, range, value, onInput) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider';
      const lab = document.createElement('label');
      lab.textContent = label + ' ';
      const out = document.createElement('output');
      out.textContent = value;
      lab.appendChild(out);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = range.min;
      input.max = range.max;
      input.step = range.step || 1;
      input.value = value;
      input.addEventListener('input', async () => {
        out.textContent = input.value;
        try { await onInput(Number(input.value)); } catch (e) { console.warn(key, e); }
      });
      wrap.append(lab, input);
      host.appendChild(wrap);
      parts.push(key);
    };

    if (caps.exposureMode && caps.exposureMode.includes('manual') && caps.exposureTime) {
      const auto = document.createElement('label');
      auto.className = 'check';
      auto.innerHTML = '<input type="checkbox" checked /> Automatisk exponering';
      host.appendChild(auto);
      const box = auto.querySelector('input');
      box.checked = settings.exposureMode !== 'manual';
      box.addEventListener('change', () =>
        camera.apply({ exposureMode: box.checked ? 'continuous' : 'manual' }).catch(console.warn)
      );
      addSlider('exposureTime', 'Exponeringstid', caps.exposureTime, settings.exposureTime ?? caps.exposureTime.max,
        (v) => { box.checked = false; return camera.apply({ exposureMode: 'manual', exposureTime: v }); });
    }
    if (caps.exposureCompensation) {
      addSlider('exposureCompensation', 'Exponeringskompensation', caps.exposureCompensation,
        settings.exposureCompensation ?? 0, (v) => camera.apply({ exposureCompensation: v }));
    }
    if (caps.brightness) {
      addSlider('brightness', 'Ljushet', caps.brightness, settings.brightness ?? caps.brightness.min,
        (v) => camera.apply({ brightness: v }));
    }

    if (parts.length === 0) {
      host.innerHTML = '<small>Din kamera/plattform låter inte appen styra exponeringen. ' +
        'Det löser sig med bandpassfiltret, eller med ett verktyg för kamerainställningar.</small>';
    }
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function selectedResolution() {
    const [width, height] = resolutionSelect.value.split('x').map(Number);
    return { width, height };
  }

  async function populateCameras(activeId) {
    const cameras = await window.LaserCamera.listCameras();
    cameraSelect.innerHTML = '';
    cameras.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Kamera ${i + 1}`;
      cameraSelect.appendChild(opt);
    });
    if (activeId) cameraSelect.value = activeId;
    cameraSelect.disabled = cameras.length === 0;
    return cameras;
  }

  async function startCamera(deviceId) {
    showMessage('Startar kameran…');
    try {
      const info = await camera.start({ deviceId, ...selectedResolution() });
      store.set('cameraId', info.deviceId || '');
      store.set('resolution', resolutionSelect.value);
      statusResolution.textContent = `${info.width} × ${info.height}`;
      toggleButton.textContent = 'Stoppa';
      showMessage('');
      buildExposureControls();
      return info;
    } catch (err) {
      console.error(err);
      toggleButton.textContent = 'Starta';
      if (err.name === 'NotAllowedError') {
        showMessage(
          'Appen fick inte använda kameran. På Mac: Systeminställningar → ' +
            'Integritet och säkerhet → Kamera, slå på för Electron/Terminal och starta om.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        showMessage('Hittade ingen kamera som matchar. Testa en annan kamera eller upplösning.');
      } else {
        showMessage(`Kunde inte starta kameran: ${err.message}`);
      }
      return null;
    }
  }

  // Uppdatera fps i statusraden.
  setInterval(() => {
    statusFps.textContent = camera.running ? `${camera.fps.toFixed(1)} fps` : '– fps';
  }, 500);

  cameraSelect.addEventListener('change', () => startCamera(cameraSelect.value));
  resolutionSelect.addEventListener('change', () => startCamera(cameraSelect.value));
  toggleButton.addEventListener('click', () => {
    if (camera.running) {
      camera.stop();
      toggleButton.textContent = 'Starta';
      statusResolution.textContent = '–';
    } else {
      startCamera(cameraSelect.value);
    }
  });

  // Byt kamera automatiskt om man kopplar in/ur en webbkamera.
  navigator.mediaDevices.addEventListener('devicechange', () => {
    populateCameras(cameraSelect.value).catch(console.error);
  });

  async function init() {
    const v = window.laserMouse?.versions;
    if (v) statusVersions.textContent = `Electron ${v.electron} · ${window.laserMouse.platform}`;

    const savedRes = store.get('resolution');
    if (savedRes) resolutionSelect.value = savedRes;

    // Starta först med sparad (eller standard-)kamera för att få tillstånd –
    // då blir kameranamnen läsbara i listan.
    const savedId = store.get('cameraId') || undefined;
    let info = await startCamera(savedId);
    if (!info && savedId) info = await startCamera(undefined);

    const cameras = await populateCameras(info?.deviceId);
    if (cameras.length === 0) showMessage('Ingen webbkamera hittades.');

    await screenControl.init();
  }

  init();
})();
