const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;

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
