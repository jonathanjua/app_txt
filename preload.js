const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  drive: {
    getStatus: () => ipcRenderer.invoke('drive:getStatus'),
    saveCredentials: (clientId, clientSecret) => ipcRenderer.invoke('drive:saveCredentials', clientId, clientSecret),
    connect: () => ipcRenderer.invoke('drive:connect'),
    upload: (filename, content) => ipcRenderer.invoke('drive:upload', filename, content),
    list: () => ipcRenderer.invoke('drive:list'),
    download: (fileId) => ipcRenderer.invoke('drive:download', fileId),
  },
});
