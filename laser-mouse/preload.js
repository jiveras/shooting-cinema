// Bryggan mellan huvudfönstrets renderer och main-processen.
// Exponerar bara det renderern uttryckligen behöver – inget Node-API läcker ut.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('laserMouse', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  // Skärmar
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  onDisplaysChanged: (cb) => ipcRenderer.on('displays:changed', () => cb()),

  // Överläggsfönstret på vald skärm
  openOverlay: (displayId) => ipcRenderer.invoke('overlay:open', displayId),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  sendOverlay: (msg) => ipcRenderer.send('overlay:send', msg),
  onOverlayClosed: (cb) => ipcRenderer.on('overlay:closed', () => cb()),

  // Etapp 4: riktiga musklick (x, y normaliserade 0–1 på vald skärm)
  mouseEnable: () => ipcRenderer.invoke('mouse:enable'),
  mouseDisable: () => ipcRenderer.invoke('mouse:disable'),
  mouseClick: (displayId, x, y) => ipcRenderer.invoke('mouse:click', { displayId, x, y }),
  mouseMove: (displayId, x, y) => ipcRenderer.send('mouse:move', { displayId, x, y }),
  onMouseDisabled: (cb) => ipcRenderer.on('mouse:disabled', (_e, reason) => cb(reason)),
});
