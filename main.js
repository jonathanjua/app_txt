const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const https = require('https');
const url = require('url');

let mainWindow;
let tray = null;

const iconPath = path.join(__dirname, 'assets', 'icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Reduz uso de memória e CPU no renderer
      backgroundThrottling: true,
    },
    title: 'Editor de Texto',
    show: false,
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (event) => {
    if (tray && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Ícone na bandeja do sistema (tray) / menu bar (macOS)
  const trayIcon = nativeImage.createFromPath(iconPath);
  if (!trayIcon.isEmpty()) {
    const size = process.platform === 'darwin' ? 22 : 16;
    tray = new Tray(trayIcon.resize({ width: size, height: size }));
    tray.setToolTip('Editor de Texto');

    const updateTrayMenu = () => {
      tray?.setContextMenu(Menu.buildFromTemplate([
        {
          label: mainWindow?.isVisible() ? 'Ocultar' : 'Mostrar',
          click: () => {
            if (mainWindow?.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow?.show();
              mainWindow?.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Sair',
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]));
    };
    updateTrayMenu();
    mainWindow.on('show', updateTrayMenu);
    mainWindow.on('hide', updateTrayMenu);

    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  }
}

app.whenReady().then(() => {
  // Remove o menu padrão do Electron
  Menu.setApplicationMenu(null);
  app.isQuitting = false;
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Diálogos de arquivo
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Arquivos de texto', extensions: ['txt', 'md', 'json', 'js', 'html', 'css'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || undefined,
    filters: [
      { name: 'Arquivos de texto', extensions: ['txt', 'md', 'json', 'js', 'html', 'css'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:readFile', (_, filePath) => fs.readFile(filePath, 'utf-8'));
ipcMain.handle('fs:writeFile', (_, filePath, content) => fs.writeFile(filePath, content, 'utf-8'));

// --- Google Drive (OAuth + API) ---
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT_PORT = 3131;
const REDIRECT_PATH = '/callback';

function drivePath(name) {
  return path.join(app.getPath('userData'), name);
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function driveGetStatus() {
  const cred = await readJsonSafe(drivePath('drive-credentials.json'));
  const tokens = await readJsonSafe(drivePath('drive-tokens.json'));
  return {
    hasCredentials: !!(cred && cred.client_id && cred.client_secret),
    hasTokens: !!(tokens && tokens.refresh_token),
  };
}

ipcMain.handle('drive:getStatus', driveGetStatus);

ipcMain.handle('drive:saveCredentials', async (_, clientId, clientSecret) => {
  if (!clientId || !clientSecret) return false;
  await fs.writeFile(
    drivePath('drive-credentials.json'),
    JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }, null, 2),
    'utf-8'
  );
  return true;
});

function tokenRequest(postData) {
  return new Promise((resolve, reject) => {
    const body = typeof postData === 'string' ? postData : new URLSearchParams(postData).toString();
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.error) reject(new Error(j.error_description || j.error));
            else resolve(j);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

ipcMain.handle('drive:connect', async () => {
  const cred = await readJsonSafe(drivePath('drive-credentials.json'));
  if (!cred || !cred.client_id || !cred.client_secret) {
    throw new Error('Configure Client ID e Client Secret primeiro.');
  }
  const redirectUri = `http://127.0.0.1:${REDIRECT_PORT}${REDIRECT_PATH}`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: cred.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  return new Promise((resolve, reject) => {
    let server = null;
    let authWindow = null;

    const cleanup = () => {
      if (server) {
        server.close();
        server = null;
      }
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
        authWindow = null;
      }
    };

    server = http.createServer(async (req, res) => {
      const u = url.parse(req.url, true);
      if (u.pathname !== REDIRECT_PATH) {
        res.writeHead(404).end();
        return;
      }
      const code = u.query && u.query.code;
      if (!code) {
        res.writeHead(400).end('Falta parâmetro code.');
        cleanup();
        reject(new Error('Resposta OAuth sem code.'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Concluído</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><p>Conectado. Pode fechar esta janela.</p></body></html>'
      );
      cleanup();

      try {
        const tokenRes = await tokenRequest({
          code,
          client_id: cred.client_id,
          client_secret: cred.client_secret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });
        await fs.writeFile(
          drivePath('drive-tokens.json'),
          JSON.stringify(
            {
              access_token: tokenRes.access_token,
              refresh_token: tokenRes.refresh_token,
              expiry: Date.now() + (tokenRes.expires_in || 3600) * 1000,
            },
            null,
            2
          ),
          'utf-8'
        );
        resolve(true);
      } catch (e) {
        reject(e);
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      authWindow = new BrowserWindow({
        width: 500,
        height: 650,
        show: true,
        webPreferences: { nodeIntegration: false },
      });
      authWindow.loadURL(authUrl);
      authWindow.on('closed', () => {
        if (server) {
          server.close();
          reject(new Error('Janela de login fechada.'));
        }
      });
    });
    server.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
});

async function driveGetAccessToken() {
  const cred = await readJsonSafe(drivePath('drive-credentials.json'));
  const tokens = await readJsonSafe(drivePath('drive-tokens.json'));
  if (!cred || !tokens || !tokens.refresh_token) throw new Error('Não conectado ao Google Drive.');
  const now = Date.now();
  if (tokens.expiry && now < tokens.expiry - 60000) return tokens.access_token;
  const res = await tokenRequest({
    client_id: cred.client_id,
    client_secret: cred.client_secret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  });
  const newTokens = {
    ...tokens,
    access_token: res.access_token,
    expiry: Date.now() + (res.expires_in || 3600) * 1000,
  };
  await fs.writeFile(drivePath('drive-tokens.json'), JSON.stringify(newTokens, null, 2), 'utf-8');
  return newTokens.access_token;
}

function driveApiRequest(accessToken, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            try {
              const j = JSON.parse(data);
              reject(new Error(j.error?.message || data || `HTTP ${res.statusCode}`));
            } catch {
              reject(new Error(data || `HTTP ${res.statusCode}`));
            }
            return;
          }
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

ipcMain.handle('drive:upload', async (_, filename, content) => {
  const accessToken = await driveGetAccessToken();
  const boundary = '-------' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: filename || 'documento.txt', mimeType: 'text/plain' });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  const res = await driveApiRequest(accessToken, {
    path: '/upload/drive/v3/files?uploadType=multipart',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body, 'utf-8'),
    },
  }, body);
  return res && res.id ? res.id : null;
});

ipcMain.handle('drive:list', async () => {
  const accessToken = await driveGetAccessToken();
  const res = await driveApiRequest(accessToken, {
    path: '/drive/v3/files?pageSize=50&q=mimeType%3D%27text%2Fplain%27&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)',
    method: 'GET',
  });
  return (res && res.files) ? res.files : [];
});

ipcMain.handle('drive:download', async (_, fileId) => {
  const accessToken = await driveGetAccessToken();
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(data || `HTTP ${res.statusCode}`));
          else resolve(data);
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
});
