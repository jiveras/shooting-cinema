// Main-processen: fönster, behörigheter, skärmar, överläggsfönstret
// och (etapp 4) riktiga musklick via libnut.

const { app, BrowserWindow, globalShortcut, ipcMain, screen, session, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const openDevTools = process.argv.includes('--devtools');

let mainWindow = null;
let overlayWindow = null;

async function ensureCameraAccess() {
  // macOS kräver uttryckligt kameratillstånd. På Windows/Linux är detta en no-op.
  if (process.platform !== 'darwin') return true;
  const status = systemPreferences.getMediaAccessStatus('camera');
  if (status === 'granted') return true;
  if (status === 'denied' || status === 'restricted') {
    console.warn(
      `[laser-mouse] Kameraåtkomst är "${status}". Slå på den under ` +
        'Systeminställningar → Integritet och säkerhet → Kamera.'
    );
    return false;
  }
  return systemPreferences.askForMediaAccess('camera');
}

// ---- Skärmar ----

function displayList() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Skärm ${i + 1}`,
    bounds: d.bounds, // i logiska punkter (DIP)
    scaleFactor: d.scaleFactor,
    primary: d.id === primaryId,
  }));
}

function notifyDisplaysChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('displays:changed');
}

// ---- Överläggsfönster ----
// Ett ramlöst, genomskinligt fönster som täcker vald skärm. Det tar aldrig
// emot musen (klick går rakt igenom) och tar aldrig fokus, så tangentbordet
// stannar i huvudfönstret.

async function openOverlay(displayId) {
  const display =
    screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    overlayWindow = new BrowserWindow({
      ...display.bounds,
      frame: false,
      transparent: true,
      hasShadow: false,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      enableLargerThanScreen: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(ROOT, 'screen-overlay-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.on('closed', () => {
      overlayWindow = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('overlay:closed');
    });

    const loaded = new Promise((resolve) => overlayWindow.webContents.once('did-finish-load', resolve));
    overlayWindow.loadFile(path.join(ROOT, 'renderer', 'screen-overlay.html'));
    await loaded;
  }

  overlayWindow.setBounds(display.bounds);
  overlayWindow.showInactive();
  return { id: display.id, bounds: display.bounds };
}

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
}

ipcMain.handle('displays:list', () => displayList());
ipcMain.handle('overlay:open', (_e, displayId) => openOverlay(displayId));
ipcMain.handle('overlay:close', () => closeOverlay());
ipcMain.on('overlay:send', (_e, msg) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:message', msg);
  }
});

// ---- Etapp 4: riktiga musklick ----
// libnut (från nut.js-familjen) är förkompilerat mot N-API och fungerar
// därför i Electron utan omkompilering. Det laddas först när man slår på
// musklick, så att resten av appen fungerar även om paketet saknas.

const PANIC_SHORTCUT = 'CommandOrControl+Shift+L';
const MIN_CLICK_INTERVAL_MS = 80;

let libnut = null;
let libnutError = null;
let mouseEnabled = false;
let lastClickAt = 0;

function loadLibnut() {
  if (libnut || libnutError) return libnut;
  try {
    libnut = require(`@nut-tree-fork/libnut-${process.platform}`);
  } catch (e) {
    libnutError = e.message;
    console.error('[laser-mouse] Kunde inte ladda libnut:', e);
  }
  return libnut;
}

// macOS: appen måste ha "Hjälpmedel"-behörighet för att få styra musen.
function hasAccessibility(prompt) {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(prompt);
}

function setMouseEnabled(on, reason) {
  mouseEnabled = on;
  if (on) {
    if (!globalShortcut.isRegistered(PANIC_SHORTCUT)) {
      globalShortcut.register(PANIC_SHORTCUT, () => setMouseEnabled(false, 'shortcut'));
    }
  } else {
    globalShortcut.unregister(PANIC_SHORTCUT);
    if (reason && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mouse:disabled', reason);
    }
  }
}

/** Normaliserad punkt (0–1) på en skärm → globala OS-koordinater. */
function toGlobalPoint(displayId, u, v) {
  const display = screen.getAllDisplays().find((d) => d.id === displayId);
  if (!display) return null;
  const b = display.bounds;
  const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
  let p = {
    x: Math.round(b.x + clamp(u, 0, 1) * (b.width - 1)),
    y: Math.round(b.y + clamp(v, 0, 1) * (b.height - 1)),
  };
  // macOS och libnut använder samma logiska punkter som Electron.
  // Windows med skalning vill ha fysiska pixlar.
  if (process.platform === 'win32') p = screen.dipToScreenPoint(p);
  return p;
}

ipcMain.handle('mouse:enable', () => {
  const lib = loadLibnut();
  if (!lib) return { ok: false, reason: 'missing', detail: libnutError };
  if (!hasAccessibility(false)) {
    hasAccessibility(true); // visar macOS-dialogen
    return { ok: false, reason: 'accessibility' };
  }
  setMouseEnabled(true);
  return { ok: true, shortcut: PANIC_SHORTCUT };
});

ipcMain.handle('mouse:disable', () => {
  setMouseEnabled(false);
  return { ok: true };
});

ipcMain.handle('mouse:click', (_e, { displayId, x, y }) => {
  if (!mouseEnabled || !libnut) return { ok: false };
  const now = Date.now();
  if (now - lastClickAt < MIN_CLICK_INTERVAL_MS) return { ok: false, reason: 'throttled' };
  const p = toGlobalPoint(displayId, x, y);
  if (!p) return { ok: false, reason: 'display' };
  lastClickAt = now;
  try {
    libnut.moveMouse(p.x, p.y);
    libnut.mouseClick('left');
    return { ok: true, x: p.x, y: p.y };
  } catch (e) {
    console.error('[laser-mouse] Klick misslyckades:', e);
    return { ok: false, reason: 'error', detail: e.message };
  }
});

ipcMain.on('mouse:move', (_e, { displayId, x, y }) => {
  if (!mouseEnabled || !libnut) return;
  const p = toGlobalPoint(displayId, x, y);
  if (!p) return;
  try {
    libnut.moveMouse(p.x, p.y);
  } catch (e) {
    console.error('[laser-mouse] Musflytt misslyckades:', e);
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// ---- Spel ----
// Spelen ligger i ../games/<id>/ med index.html + game.json.
// De öppnas i helskärm på vald skärm och tar emot vanliga musklick.

const GAMES_DIR = path.join(ROOT, '..', 'games');
let gameWindow = null;

function listGames() {
  try {
    return fs
      .readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(GAMES_DIR, d.name, 'index.html')))
      .map((d) => {
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, d.name, 'game.json'), 'utf8'));
        } catch { /* game.json saknas – använd katalognamnet */ }
        return { id: d.name, name: meta.name || d.name, description: meta.description || '' };
      });
  } catch {
    return [];
  }
}

function closeGame() {
  if (gameWindow && !gameWindow.isDestroyed()) gameWindow.close();
}

async function openGame(gameId, displayId) {
  const game = listGames().find((g) => g.id === gameId);
  if (!game) return { ok: false, reason: 'Spelet finns inte' };
  const display =
    screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();

  closeGame();
  gameWindow = new BrowserWindow({
    ...display.bounds,
    frame: false,
    show: false,
    backgroundColor: '#06080b',
    acceptFirstMouse: true, // macOS: första klicket ska träffa spelet, inte bara aktivera fönstret
    title: game.name,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  gameWindow.on('closed', () => {
    gameWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('game:closed');
  });
  await gameWindow.loadFile(path.join(GAMES_DIR, game.id, 'index.html'));
  gameWindow.setBounds(display.bounds);
  if (process.platform === 'darwin') {
    gameWindow.setSimpleFullScreen(true); // täcker även menyraden, utan ny Space
  } else {
    gameWindow.setFullScreen(true);
  }
  gameWindow.show();
  return { ok: true, name: game.name };
}

ipcMain.handle('games:list', () => listGames());
ipcMain.handle('games:open', (_e, gameId, displayId) => openGame(gameId, displayId));
ipcMain.handle('games:close', () => closeGame());

// ---- Huvudfönster ----

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    backgroundColor: '#111316',
    title: 'Laser Mouse',
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required', // ljud utan klick först
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  if (openDevTools) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeOverlay();
    closeGame();
  });
}

app.whenReady().then(async () => {
  // Tillåt bara kamera/mikrofon ("media"), neka allt annat.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  screen.on('display-added', notifyDisplaysChanged);
  screen.on('display-removed', notifyDisplaysChanged);
  screen.on('display-metrics-changed', notifyDisplaysChanged);

  await ensureCameraAccess();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
