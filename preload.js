const { contextBridge, ipcRenderer } = require('electron');

// Leitura em fluxo: processa arquivo em chunks (evita carregar GB na RAM)
function readFileStream(filePath, onProgress) {
  const chunks = [];
  let endPayload = null;
  const chunkHandler = (_, chunk) => chunks.push(chunk);
  const progressHandler = (_, p) => onProgress && onProgress(p);
  const endHandler = (_, payload) => { endPayload = payload; };
  ipcRenderer.on('fs:readStreamChunk', chunkHandler);
  ipcRenderer.on('fs:readStreamProgress', progressHandler);
  ipcRenderer.once('fs:readStreamEnd', endHandler);
  const cleanup = () => {
    ipcRenderer.removeListener('fs:readStreamChunk', chunkHandler);
    ipcRenderer.removeListener('fs:readStreamProgress', progressHandler);
  };
  return ipcRenderer
    .invoke('fs:readFileStreamStart', filePath)
    .then((result) => {
      cleanup();
      return {
        content: chunks.join(''),
        truncated: (endPayload || result).truncated || false,
        bytesRead: (endPayload || result).bytesRead || 0,
      };
    })
    .catch((err) => {
      cleanup();
      throw err;
    });
}

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  readFileStream,
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
