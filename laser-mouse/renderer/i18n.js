// Internationalization for Laser Mouse: Swedish (default) and English.
//
// Usage:
//   i18n.init(store)               read the saved language
//   t('calib.ok')                  translated string
//   t('spots.many', { n: 3 })      with {placeholders}
//   i18n.apply()                   translate [data-i18n] elements in the DOM
//   i18n.onChange(fn)              re-render dynamic texts on language change
//
// Static markup uses data-i18n="key" (textContent) or data-i18n-html="key"
// (innerHTML, only for trusted strings from this file).

(function () {
  const STRINGS = {
    sv: {
      'lang.name': 'Svenska',
      'app.tagline': 'Laser → musklick',

      // Toolbar
      'toolbar.language': 'Språk',
      'toolbar.camera': 'Kamera',
      'toolbar.searchingCameras': 'Söker kameror…',
      'toolbar.resolution': 'Upplösning',
      'toolbar.stop': 'Stoppa',
      'toolbar.start': 'Starta',

      // Camera
      'camera.starting': 'Startar kameran…',
      'camera.denied':
        'Appen fick inte använda kameran. På Mac: Systeminställningar → Integritet och säkerhet → Kamera, slå på för Electron/Terminal och starta om.',
      'camera.notFound': 'Hittade ingen kamera som matchar. Testa en annan kamera eller upplösning.',
      'camera.failed': 'Kunde inte starta kameran: {msg}',
      'camera.none': 'Ingen webbkamera hittades.',
      'camera.fallbackName': 'Kamera {n}',

      // Display & calibration
      'calib.title': 'Skärm & kalibrering',
      'calib.display': 'Skärm',
      'calib.points': 'Kalibreringspunkter',
      'calib.points4': '4 punkter (snabbt)',
      'calib.points9': '9 punkter (noggrannare)',
      'calib.calibrate': 'Kalibrera',
      'calib.test': 'Testa',
      'calib.testing': 'Testar…',
      'calib.close': 'Stäng',
      'calib.sound': 'Ljud',
      'calib.voice': 'Röst',
      'calib.help': 'Kameran ska se skärmen du kalibrerar. Håll lasern stilla på varje punkt tills ringen fylls. Esc avbryter.',
      'calib.none': 'Inte kalibrerad för den här skärmen',
      'calib.ok': 'Kalibrerad ✓',
      'calib.okDetail': 'Kalibrerad ✓ ({n} punkter)',
      'calib.okDetailError': 'Kalibrerad ✓ ({n} punkter · medelfel {err} px)',
      'calib.running': 'Kalibrerar… sikta på punkterna på skärmen. Esc avbryter.',
      'calib.abortedKeep': 'Kalibrerad ✓ (avbröt ny kalibrering)',
      'calib.aborted': 'Kalibrering avbruten',
      'calib.failed': 'Kalibreringen misslyckades. Försök igen.',
      'calib.startCameraFirst': 'Starta kameran först.',
      'calib.calibrateFirst': 'Kalibrera först.',
      'display.name': 'Skärm {n}',
      'display.primary': '(huvudskärm)',

      // Zeroing
      'zero.title': 'Inskjutning',
      'zero.help':
        'Lasern sitter inte exakt i siktlinjen. Sikta med kornet mitt på målet som visas och skjut fem skott – appen flyttar sedan alla träffar så att de hamnar där du siktade. Gör om om du flyttar lasern eller ditt skjutavstånd.',
      'zero.start': 'Inskjutning',
      'zero.reset': 'Nollställ',
      'zero.none': 'Ingen inskjutning',
      'zero.progress': 'Inskjutning: skott {n} av {total}',
      'zero.status': 'Lasern hamnar {offset} – korrigeras. Träffbild {spread} px.',
      'zero.result': 'Lasern hamnade {offset}. Det korrigeras nu.',
      'offset.right': '{px} px för långt till höger',
      'offset.left': '{px} px för långt till vänster',
      'offset.low': '{px} px för lågt',
      'offset.high': '{px} px för högt',
      'offset.and': ' och ',
      'offset.centre': 'mitt i prick',

      // Mouse
      'tabs.play': 'Spel & inskjutning',
      'tabs.settings': 'Inställningar',
      'mouse.title': 'Riktiga musklick',
      'mouse.click': 'Klicka vid skott',
      'mouse.follow': 'Muspekaren följer lasern',
      'mouse.help':
        'Skott = lasern tänds efter att ha varit släckt. Nödstopp: <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>L</kbd> (fungerar även när en annan app har fokus).',
      'mouse.off': 'Av',
      'mouse.offPanic': 'Av (nödstopp med ⌘⇧L)',
      'mouse.on': 'PÅ – {parts}',
      'mouse.partClick': 'klickar vid skott',
      'mouse.partFollow': 'pekaren följer lasern',
      'mouse.clicks': '{text} · {n} klick, senast {x}, {y}',
      'mouse.calibrateFirst': 'Kalibrera först',
      'mouse.accessibility':
        'macOS behöver ge appen "Hjälpmedel"-behörighet. Slå på Electron under Systeminställningar → Integritet och säkerhet → Hjälpmedel, starta om appen och försök igen.',
      'mouse.missing': 'Musstyrningen kunde inte laddas – kör "npm install" igen. {detail}',

      // Games
      'games.title': 'Spel',
      'games.help': 'Öppnar spelmenyn i helskärm. Där väljer och byter du spel med bössan.',
      'games.start': 'Starta spel på vald skärm',
      'games.close': 'Stäng',

      // Readout
      'laser.found': 'Laser hittad',
      'laser.none': 'Ingen laser',
      'readout.camPos': 'Kameraposition',
      'readout.screenPos': 'Skärmposition',
      'readout.blob': 'Klumpstorlek',
      'readout.contrast': 'Kontrast',
      'readout.total': 'Laserpixlar totalt',
      'readout.shots': 'Skott',
      'readout.resetShots': 'Nollställ skott',
      'readout.outside': '(utanför)',
      'readout.recalibrate': 'Kalibrera om (nytt bildformat)',

      // Sensitivity
      'sens.title': 'Känslighet',
      'sens.minContrast': 'Kontrast mot omgivning',
      'sens.minContrastHelp':
        'Viktigaste reglaget. Hur mycket ljusare pricken måste vara än allt runt den. Höj om annat triggar, sänk om lasern tappas.',
      'sens.minBrightness': 'Ljusstyrka (röd)',
      'sens.minBrightnessHelp': 'Minsta ljusstyrka i röd kanal.',
      'sens.minWarmth': 'Rödhet',
      'sens.minWarmthHelp': 'Röd minus blå. Höj för att utesluta vita reflexer.',
      'sens.ringRadius': 'Ringradie',
      'sens.ringRadiusHelp': 'Hur långt ut vi jämför. Ska vara större än pricken.',
      'sens.minPixels': 'Min klumpstorlek',
      'sens.maxPixels': 'Max klumpstorlek',

      // View
      'view.title': 'Visning',
      'view.mask': 'Visa mask (laserpixlar i grönt)',
      'view.reset': 'Återställ standardvärden',

      // Static spots
      'spots.title': 'Fasta prickar',
      'spots.help':
        'Lysdioder, reflexer eller lampor som syns som ljusa prickar. Släck lasern och tryck – appen tittar i 2 sekunder och ignorerar sedan de prickar den såg. Lasern själv ignoreras aldrig, hur länge du än håller still.',
      'spots.learn': 'Lär in fasta prickar',
      'spots.clear': 'Rensa',
      'spots.learning': 'Lär in… håll lasern släckt',
      'spots.none': 'Inga ignoreras',
      'spots.one': '1 prick ignoreras',
      'spots.many': '{n} prickar ignoreras',

      // Exposure
      'exposure.title': 'Kameraexponering',
      'exposure.starting': 'Startar kameran…',
      'exposure.auto': 'Automatisk exponering',
      'exposure.time': 'Exponeringstid',
      'exposure.compensation': 'Exponeringskompensation',
      'exposure.brightness': 'Ljushet',
      'exposure.unsupported':
        'Din kamera/plattform låter inte appen styra exponeringen. Det löser sig med bandpassfiltret, eller med ett verktyg för kamerainställningar.',

      // Status bar
      'status.detect': 'detektering {ms} ms',

      // Spoken guidance
      'say.point': 'Punkt {n}, {where}',
      'say.calibDone': 'Klart. Testläge.',
      'say.calibFailed': 'Kalibreringen misslyckades. Försök igen.',
      'say.cancelled': 'Avbrutet',
      'say.mouseOff': 'Musklick av',
      'say.zeroStart': 'Inskjutning. Sikta med kornet mitt på målet och skjut fem skott.',
      'say.left': '{n} kvar',
      'say.zeroDone': 'Klart. {text}',
      'say.spotsNone': 'Inga nya prickar',
      'say.spotsOne': 'En prick ignoreras',
      'say.spotsMany': '{n} prickar ignoreras',
      'where.topLeft': 'uppe till vänster',
      'where.topCenter': 'uppe i mitten',
      'where.topRight': 'uppe till höger',
      'where.midLeft': 'mitten till vänster',
      'where.center': 'i mitten',
      'where.midRight': 'mitten till höger',
      'where.bottomLeft': 'nere till vänster',
      'where.bottomCenter': 'nere i mitten',
      'where.bottomRight': 'nere till höger',

      // Screen overlay
      'overlay.point': 'Punkt {n} av {total}',
      'overlay.aim': 'Sikta mitt i ringen och håll stilla',
      'overlay.move': 'Flytta lasern till nästa punkt',
      'overlay.zeroTitle': 'Inskjutning',
      'overlay.zeroDone': 'Inskjutning klar',
      'overlay.zeroAim': 'Sikta med kornet mitt på målet och skjut · skott {n} av {total}',
      'overlay.zeroLegend': 'Träffbild: {px} px · grått = där lasern träffade, grönt = korrigerat',
    },

    en: {
      'lang.name': 'English',
      'app.tagline': 'Laser → mouse click',

      // Toolbar
      'toolbar.language': 'Language',
      'toolbar.camera': 'Camera',
      'toolbar.searchingCameras': 'Looking for cameras…',
      'toolbar.resolution': 'Resolution',
      'toolbar.stop': 'Stop',
      'toolbar.start': 'Start',

      // Camera
      'camera.starting': 'Starting the camera…',
      'camera.denied':
        'The app was not allowed to use the camera. On a Mac: System Settings → Privacy & Security → Camera, enable it for Electron/Terminal and restart.',
      'camera.notFound': 'No matching camera found. Try another camera or resolution.',
      'camera.failed': 'Could not start the camera: {msg}',
      'camera.none': 'No webcam found.',
      'camera.fallbackName': 'Camera {n}',

      // Display & calibration
      'calib.title': 'Display & calibration',
      'calib.display': 'Display',
      'calib.points': 'Calibration points',
      'calib.points4': '4 points (quick)',
      'calib.points9': '9 points (more accurate)',
      'calib.calibrate': 'Calibrate',
      'calib.test': 'Test',
      'calib.testing': 'Testing…',
      'calib.close': 'Close',
      'calib.sound': 'Sound',
      'calib.voice': 'Voice',
      'calib.help': 'The camera must see the display you calibrate. Hold the laser still on each point until the ring fills. Esc cancels.',
      'calib.none': 'Not calibrated for this display',
      'calib.ok': 'Calibrated ✓',
      'calib.okDetail': 'Calibrated ✓ ({n} points)',
      'calib.okDetailError': 'Calibrated ✓ ({n} points · mean error {err} px)',
      'calib.running': 'Calibrating… aim at the points on the display. Esc cancels.',
      'calib.abortedKeep': 'Calibrated ✓ (new calibration cancelled)',
      'calib.aborted': 'Calibration cancelled',
      'calib.failed': 'Calibration failed. Please try again.',
      'calib.startCameraFirst': 'Start the camera first.',
      'calib.calibrateFirst': 'Calibrate first.',
      'display.name': 'Display {n}',
      'display.primary': '(main display)',

      // Zeroing
      'zero.title': 'Zeroing',
      'zero.help':
        'The laser is never exactly on your sight line. Aim at the centre of the target with your sights and fire five shots – the app then shifts every hit to where you aimed. Redo it if you move the laser or change your shooting distance.',
      'zero.start': 'Zero',
      'zero.reset': 'Reset',
      'zero.none': 'Not zeroed',
      'zero.progress': 'Zeroing: shot {n} of {total}',
      'zero.status': 'The laser lands {offset} – corrected. Group size {spread} px.',
      'zero.result': 'The laser landed {offset}. This is now corrected.',
      'offset.right': '{px} px too far right',
      'offset.left': '{px} px too far left',
      'offset.low': '{px} px too low',
      'offset.high': '{px} px too high',
      'offset.and': ' and ',
      'offset.centre': 'dead centre',

      // Mouse
      'tabs.play': 'Games & zeroing',
      'tabs.settings': 'Settings',
      'mouse.title': 'Real mouse clicks',
      'mouse.click': 'Click on shot',
      'mouse.follow': 'Pointer follows the laser',
      'mouse.help':
        'Shot = the laser turns on after being off. Emergency stop: <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>L</kbd> (works even when another app has focus).',
      'mouse.off': 'Off',
      'mouse.offPanic': 'Off (emergency stop ⌘⇧L)',
      'mouse.on': 'ON – {parts}',
      'mouse.partClick': 'clicking on shots',
      'mouse.partFollow': 'pointer follows the laser',
      'mouse.clicks': '{text} · {n} clicks, last at {x}, {y}',
      'mouse.calibrateFirst': 'Calibrate first',
      'mouse.accessibility':
        'macOS needs to grant the app "Accessibility" permission. Enable Electron under System Settings → Privacy & Security → Accessibility, restart the app and try again.',
      'mouse.missing': 'Mouse control could not be loaded – run "npm install" again. {detail}',

      // Games
      'games.title': 'Games',
      'games.help': 'Opens the game menu full screen. Pick and switch games with the gun from there.',
      'games.start': 'Start games on selected display',
      'games.close': 'Close',

      // Readout
      'laser.found': 'Laser found',
      'laser.none': 'No laser',
      'readout.camPos': 'Camera position',
      'readout.screenPos': 'Screen position',
      'readout.blob': 'Blob size',
      'readout.contrast': 'Contrast',
      'readout.total': 'Total laser pixels',
      'readout.shots': 'Shots',
      'readout.resetShots': 'Reset shots',
      'readout.outside': '(outside)',
      'readout.recalibrate': 'Re-calibrate (new image format)',

      // Sensitivity
      'sens.title': 'Sensitivity',
      'sens.minContrast': 'Contrast to surroundings',
      'sens.minContrastHelp':
        'The most important slider. How much brighter the dot must be than everything around it. Raise it if other things trigger, lower it if the laser is lost.',
      'sens.minBrightness': 'Brightness (red)',
      'sens.minBrightnessHelp': 'Minimum brightness in the red channel.',
      'sens.minWarmth': 'Redness',
      'sens.minWarmthHelp': 'Red minus blue. Raise it to exclude white reflections.',
      'sens.ringRadius': 'Ring radius',
      'sens.ringRadiusHelp': 'How far out we compare. Must be larger than the dot.',
      'sens.minPixels': 'Min blob size',
      'sens.maxPixels': 'Max blob size',

      // View
      'view.title': 'View',
      'view.mask': 'Show mask (laser pixels in green)',
      'view.reset': 'Restore defaults',

      // Static spots
      'spots.title': 'Static spots',
      'spots.help':
        'LEDs, reflections or lamps that show up as bright spots. Turn the laser off and press – the app watches for 2 seconds and then ignores the spots it saw. The laser itself is never ignored, however long you hold it still.',
      'spots.learn': 'Learn static spots',
      'spots.clear': 'Clear',
      'spots.learning': 'Learning… keep the laser off',
      'spots.none': 'None ignored',
      'spots.one': '1 spot ignored',
      'spots.many': '{n} spots ignored',

      // Exposure
      'exposure.title': 'Camera exposure',
      'exposure.starting': 'Starting the camera…',
      'exposure.auto': 'Auto exposure',
      'exposure.time': 'Exposure time',
      'exposure.compensation': 'Exposure compensation',
      'exposure.brightness': 'Brightness',
      'exposure.unsupported':
        "Your camera/platform doesn't let the app control exposure. A band-pass filter or a camera settings tool solves it.",

      // Status bar
      'status.detect': 'detection {ms} ms',

      // Spoken guidance
      'say.point': 'Point {n}, {where}',
      'say.calibDone': 'Done. Test mode.',
      'say.calibFailed': 'Calibration failed. Please try again.',
      'say.cancelled': 'Cancelled',
      'say.mouseOff': 'Mouse clicks off',
      'say.zeroStart': 'Zeroing. Aim at the centre of the target with your sights and fire five shots.',
      'say.left': '{n} left',
      'say.zeroDone': 'Done. {text}',
      'say.spotsNone': 'No new spots',
      'say.spotsOne': 'One spot ignored',
      'say.spotsMany': '{n} spots ignored',
      'where.topLeft': 'top left',
      'where.topCenter': 'top centre',
      'where.topRight': 'top right',
      'where.midLeft': 'middle left',
      'where.center': 'centre',
      'where.midRight': 'middle right',
      'where.bottomLeft': 'bottom left',
      'where.bottomCenter': 'bottom centre',
      'where.bottomRight': 'bottom right',

      // Screen overlay
      'overlay.point': 'Point {n} of {total}',
      'overlay.aim': 'Aim at the centre of the ring and hold still',
      'overlay.move': 'Move the laser to the next point',
      'overlay.zeroTitle': 'Zeroing',
      'overlay.zeroDone': 'Zeroing complete',
      'overlay.zeroAim': 'Aim at the centre with your sights and fire · shot {n} of {total}',
      'overlay.zeroLegend': 'Group size: {px} px · grey = where the laser hit, green = corrected',
    },
  };

  const LANGS = Object.keys(STRINGS);
  const STORAGE_KEY = 'lang';

  const i18n = {
    lang: 'sv',
    langs: LANGS,
    _listeners: [],
    _store: null,

    /** Read the saved language (Swedish by default). */
    init(store) {
      this._store = store || null;
      let saved = null;
      try {
        saved = store ? store.get(STORAGE_KEY) : null;
      } catch { /* storage unavailable */ }
      this.lang = LANGS.includes(saved) ? saved : 'sv';
      document.documentElement.lang = this.lang;
      return this.lang;
    },

    t(key, params) {
      let s = STRINGS[this.lang][key];
      if (s === undefined) s = STRINGS.sv[key];
      if (s === undefined) return key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
      return s;
    },

    set(lang) {
      if (!LANGS.includes(lang) || lang === this.lang) return;
      this.lang = lang;
      document.documentElement.lang = lang;
      try {
        if (this._store) this._store.set(STORAGE_KEY, lang);
      } catch { /* storage unavailable */ }
      this.apply();
      for (const fn of this._listeners) fn(lang);
    },

    onChange(fn) {
      this._listeners.push(fn);
    },

    /** Translate all [data-i18n] / [data-i18n-html] elements under root. */
    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = this.t(el.dataset.i18n);
      });
      root.querySelectorAll('[data-i18n-html]').forEach((el) => {
        el.innerHTML = this.t(el.dataset.i18nHtml);
      });
    },

    /** Pick the right language from a value that may be { sv, en } or a plain string. */
    pick(value) {
      if (value && typeof value === 'object') return value[this.lang] || value.sv || value.en || '';
      return value || '';
    },
  };

  window.i18n = i18n;
  window.t = (key, params) => i18n.t(key, params);
})();
