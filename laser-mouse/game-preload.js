// Bridge for the game window: the game menu needs the list of games and a way
// to close the window (back to Laser Mouse).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('laserGames', {
  list: () => ipcRenderer.invoke('games:list'),
  close: () => ipcRenderer.invoke('games:close'),
});
