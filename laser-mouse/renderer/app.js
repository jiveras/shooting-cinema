// Wires the user interface to the camera, the detector and the screen control.

(function () {
  const $ = (id) => document.getElementById(id);
  const cameraSelect = $('camera-select');
  const resolutionSelect = $('resolution-select');
  const toggleButton = $('toggle-button');
  const message = $('message');
  const statusResolution = $('status-resolution');
  const statusFps = $('status-fps');
  const statusVersions = $('status-versions');

  const store = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    },
  };

  // ---- Language (Swedish by default) ----
  i18n.init(store);
  i18n.apply();
  const langSelect = $('lang-select');
  langSelect.value = i18n.lang;
  langSelect.addEventListener('change', () => i18n.set(langSelect.value));

  const camera = new window.LaserCamera($('video'), $('canvas'));

  // ---- Laser detection ----

  const SETTINGS_KEY = 'detectorSettings.v2';
  const sliderIds = ['minContrast', 'minBrightness', 'minWarmth', 'ringRadius', 'minPixels', 'maxPixels'];

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
  showMask.addEventListener('change', () => store.set('showMask', showMask.checked ? '1' : '0'));
  $('reset-settings').addEventListener('click', () => {
    detector.update(window.LaserDetector.defaults);
    saveSettings();
    syncControls();
  });
  syncControls();

  // A shot = the laser appears after being absent for a few frames
  // (a laser training cartridge flashes when the firing pin strikes).
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

  // ---- Display, calibration, zeroing and mouse control ----
  const screenControl = new window.ScreenControl({ $, store, camera });

  // ---- Games ----
  const gameSelect = $('game-select');
  let games = [];
  let gameOpen = false;

  function renderGames() {
    const selected = gameSelect.value || store.get('gameId');
    gameSelect.innerHTML = '';
    for (const g of games) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = i18n.pick(g.name);
      gameSelect.appendChild(opt);
    }
    if (selected && games.some((g) => g.id === selected)) gameSelect.value = selected;
    syncGameUi();
  }

  function syncGameUi() {
    const g = games.find((x) => x.id === gameSelect.value);
    $('game-desc').textContent = g ? i18n.pick(g.description) : t('games.none');
    $('game-start').disabled = !g;
    $('game-stop').disabled = !gameOpen;
  }

  async function loadGames() {
    games = (await window.laserMouse.listGames?.()) || [];
    renderGames();
  }

  // Re-scan games/ whenever the window gets focus, so games added while the
  // app is running show up without a restart.
  window.addEventListener('focus', () => loadGames().catch(console.error));

  gameSelect.addEventListener('change', () => {
    store.set('gameId', gameSelect.value);
    syncGameUi();
  });
  $('game-start').addEventListener('click', async () => {
    // The game opens in the same language as Laser Mouse
    const res = await window.laserMouse.openGame(gameSelect.value, screenControl.display?.id, i18n.lang);
    gameOpen = !!res?.ok;
    syncGameUi();
  });
  $('game-stop').addEventListener('click', () => window.laserMouse.closeGame());
  window.laserMouse.onGameClosed?.(() => {
    gameOpen = false;
    syncGameUi();
  });

  // ---- Static spots (ignore zones) ----
  const spots = new window.StaticSpots({ store, detector });
  const spotsStatus = $('spots-status');
  spots.onChange = () => {
    const n = spots.zones.length;
    if (spots.learning) {
      spotsStatus.textContent = t('spots.learning');
    } else {
      spotsStatus.textContent = n === 0 ? t('spots.none') : n === 1 ? t('spots.one') : t('spots.many', { n });
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

  // ---- Per frame ----
  camera.onFrame((ctx, w, h) => {
    spots.setSize(w, h);
    const t0 = performance.now();
    const img = ctx.getImageData(0, 0, w, h);
    const result = detector.detect(img, showMask.checked);
    if (showMask.checked) ctx.putImageData(img, 0, 0);
    detectMs = detectMs * 0.9 + (performance.now() - t0) * 0.1;

    // While learning static spots, no hit is used at all (the laser should be off).
    if (spots.learning) {
      if (spots.feed(result)) {
        screenControl.sounds.captured();
        const a = spots.lastAdded;
        screenControl.sounds.say(a === 0 ? t('say.spotsNone') : a === 1 ? t('say.spotsOne') : t('say.spotsMany', { n: a }));
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

  // Update the panel at a calmer pace than the frame rate.
  setInterval(() => {
    const state = $('laser-state');
    state.textContent = last.found ? t('laser.found') : t('laser.none');
    state.classList.toggle('on', last.found);
    $('laser-pos').textContent = last.found ? `${Math.round(last.x)}, ${Math.round(last.y)}` : '–';
    $('laser-pixels').textContent = last.pixels ? last.pixels : '–';
    $('laser-contrast').textContent = last.found ? Math.round(last.contrast) : '–';
    $('laser-total').textContent = last.total;
    $('shot-count').textContent = shotCount;
    $('screen-pos').textContent = screenControl.screenReadout();
    $('status-detect').textContent = camera.running ? t('status.detect', { ms: detectMs.toFixed(1) }) : '– ms';
  }, 100);

  // ---- Camera exposure (if the camera supports it) ----
  // A shorter exposure gives a darker image, but the laser dot doesn't bloom
  // and everything else fades away. Not every camera/platform supports it.
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
      const box = document.createElement('input');
      box.type = 'checkbox';
      auto.append(box, ' ', t('exposure.auto'));
      host.appendChild(auto);
      box.checked = settings.exposureMode !== 'manual';
      box.addEventListener('change', () =>
        camera.apply({ exposureMode: box.checked ? 'continuous' : 'manual' }).catch(console.warn)
      );
      addSlider('exposureTime', t('exposure.time'), caps.exposureTime, settings.exposureTime ?? caps.exposureTime.max,
        (v) => { box.checked = false; return camera.apply({ exposureMode: 'manual', exposureTime: v }); });
    }
    if (caps.exposureCompensation) {
      addSlider('exposureCompensation', t('exposure.compensation'), caps.exposureCompensation,
        settings.exposureCompensation ?? 0, (v) => camera.apply({ exposureCompensation: v }));
    }
    if (caps.brightness) {
      addSlider('brightness', t('exposure.brightness'), caps.brightness, settings.brightness ?? caps.brightness.min,
        (v) => camera.apply({ brightness: v }));
    }

    if (parts.length === 0) {
      const small = document.createElement('small');
      small.textContent = t('exposure.unsupported');
      host.appendChild(small);
    }
  }

  // ---- Camera ----

  // The message over the camera view is stored as a key so it can be re-translated.
  let messageState = null;
  function showMessage(key, params) {
    messageState = key ? { key, params } : null;
    renderMessage();
  }
  function renderMessage() {
    message.textContent = messageState ? t(messageState.key, messageState.params) : '';
    message.hidden = !messageState;
  }

  function renderToggle() {
    toggleButton.textContent = t(camera.running ? 'toolbar.stop' : 'toolbar.start');
  }

  function selectedResolution() {
    const [width, height] = resolutionSelect.value.split('x').map(Number);
    return { width, height };
  }

  let cameraList = [];
  async function populateCameras(activeId) {
    cameraList = await window.LaserCamera.listCameras();
    renderCameraOptions(activeId);
    cameraSelect.disabled = cameraList.length === 0;
    return cameraList;
  }

  function renderCameraOptions(activeId = cameraSelect.value) {
    cameraSelect.innerHTML = '';
    cameraList.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || t('camera.fallbackName', { n: i + 1 });
      cameraSelect.appendChild(opt);
    });
    if (activeId) cameraSelect.value = activeId;
  }

  async function startCamera(deviceId) {
    showMessage('camera.starting');
    try {
      const info = await camera.start({ deviceId, ...selectedResolution() });
      store.set('cameraId', info.deviceId || '');
      store.set('resolution', resolutionSelect.value);
      statusResolution.textContent = `${info.width} × ${info.height}`;
      renderToggle();
      showMessage(null);
      buildExposureControls();
      return info;
    } catch (err) {
      console.error(err);
      renderToggle();
      if (err.name === 'NotAllowedError') {
        showMessage('camera.denied');
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        showMessage('camera.notFound');
      } else {
        showMessage('camera.failed', { msg: err.message });
      }
      return null;
    }
  }

  // Frame rate in the status bar.
  setInterval(() => {
    statusFps.textContent = camera.running ? `${camera.fps.toFixed(1)} fps` : '– fps';
  }, 500);

  cameraSelect.addEventListener('change', () => startCamera(cameraSelect.value));
  resolutionSelect.addEventListener('change', () => startCamera(cameraSelect.value));
  toggleButton.addEventListener('click', () => {
    if (camera.running) {
      camera.stop();
      renderToggle();
      statusResolution.textContent = '–';
    } else {
      startCamera(cameraSelect.value);
    }
  });

  // Refresh the camera list when a webcam is plugged in or out.
  navigator.mediaDevices.addEventListener('devicechange', () => {
    populateCameras(cameraSelect.value).catch(console.error);
  });

  // ---- Language change: re-render everything built in code ----
  i18n.onChange(() => {
    renderToggle();
    renderMessage();
    renderCameraOptions();
    renderGames();
    spots.onChange();
    if (camera.running) buildExposureControls();
  });

  async function init() {
    const v = window.laserMouse?.versions;
    if (v) statusVersions.textContent = `Electron ${v.electron} · ${window.laserMouse.platform}`;

    const savedRes = store.get('resolution');
    if (savedRes) resolutionSelect.value = savedRes;

    // Start with the saved (or default) camera first to get permission –
    // only then do the camera names become readable in the list.
    const savedId = store.get('cameraId') || undefined;
    let info = await startCamera(savedId);
    if (!info && savedId) info = await startCamera(undefined);

    const cameras = await populateCameras(info?.deviceId);
    if (cameras.length === 0) showMessage('camera.none');

    await screenControl.init();
    await loadGames();
  }

  init();
})();
