// The bridge between the main window's renderer and the main process.
// Exposes only what the renderer explicitly needs – no Node API leaks through.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('laserMouse', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  // Displays
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  onDisplaysChanged: (cb) => ipcRenderer.on('displays:changed', () => cb()),

  // The overlay window on the chosen display
  openOverlay: (displayId) => ipcRenderer.invoke('overlay:open', displayId),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  sendOverlay: (msg) => ipcRenderer.send('overlay:send', msg),
  onOverlayClosed: (cb) => ipcRenderer.on('overlay:closed', () => cb()),

  // Real mouse clicks (x, y normalized 0–1 on the chosen display)
  mouseEnable: () => ipcRenderer.invoke('mouse:enable'),
  mouseDisable: () => ipcRenderer.invoke('mouse:disable'),
  mouseClick: (displayId, x, y) => ipcRenderer.invoke('mouse:click', { displayId, x, y }),
  mouseMove: (displayId, x, y) => ipcRenderer.send('mouse:move', { displayId, x, y }),
  onMouseDisabled: (cb) => ipcRenderer.on('mouse:disabled', (_e, reason) => cb(reason)),

  // Games in ../games
  openGames: (displayId, lang) => ipcRenderer.invoke('games:open', displayId, lang),
  closeGame: () => ipcRenderer.invoke('games:close'),
  onGameClosed: (cb) => ipcRenderer.on('game:closed', () => cb()),
});
