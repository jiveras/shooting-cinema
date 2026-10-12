// Bridge for the overlay window: it only receives messages.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onMessage: (cb) => ipcRenderer.on('overlay:message', (_e, msg) => cb(msg)),
});
