// Brygga för överläggsfönstret: tar bara emot meddelanden.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onMessage: (cb) => ipcRenderer.on('overlay:message', (_e, msg) => cb(msg)),
});
