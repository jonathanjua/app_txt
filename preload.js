const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs').promises;

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  readFile: (path) => fs.readFile(path, 'utf-8'),
  writeFile: (path, content) => fs.writeFile(path, content, 'utf-8'),
});
