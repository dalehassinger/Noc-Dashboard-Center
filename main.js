const { app, BrowserWindow, ipcMain, globalShortcut, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const webServer = require('./web-server');

// Handle Squirrel events for Windows installer
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Ignore certificate errors for self-signed certs (common in internal dashboards)
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow;
let settingsPath;

function getSettingsPath() {
  if (!settingsPath) {
    settingsPath = path.join(app.getPath('userData'), 'settings.json');
  }
  return settingsPath;
}

function loadSettings() {
  try {
    const settingsFile = getSettingsPath();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf8');
      const settings = JSON.parse(data);
      // Ensure webServerPort has a default value
      if (!settings.webServerPort) {
        settings.webServerPort = 3000;
      }
      // Ensure fullscreen has a default value (true)
      if (settings.fullscreen === undefined) {
        settings.fullscreen = true;
      }
      // Ensure pin has a default value
      if (!settings.pin) {
        settings.pin = '1234';
      }
      return settings;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { dashboards: [], webServerPort: 3000, fullscreen: true, pin: '1234' };
}

function saveSettings(settings) {
  try {
    const settingsFile = getSettingsPath();
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

function createWindow() {
  // Remove application menu
  Menu.setApplicationMenu(null);

  // Always start fullscreen with no frame
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    thickFrame: true,  // Enable thick frame for better resize handles on Windows
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });

  mainWindow.loadFile('renderer/dashboard.html');

  // Register global shortcuts
  globalShortcut.register('CommandOrControl+S', () => {
    mainWindow.webContents.send('open-settings');
  });

  globalShortcut.register('CommandOrControl+R', () => {
    mainWindow.webContents.send('restart-rotation');
  });

  globalShortcut.register('Escape', () => {
    mainWindow.webContents.send('escape-pressed');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Accept all certificates (for internal dashboards with self-signed certs)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

app.whenReady().then(() => {
  // Allow webview to load any URL
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['']
      }
    });
  });

  // Set permission handler for webview
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // IPC handlers
  ipcMain.handle('get-settings', () => {
    return loadSettings();
  });

  ipcMain.handle('save-settings', (event, settings) => {
    return saveSettings(settings);
  });

  ipcMain.handle('close-app', () => {
    app.quit();
  });

  ipcMain.handle('set-fullscreen', (_event, isFullscreen) => {
    if (mainWindow) {
      mainWindow.setFullScreen(isFullscreen);
      mainWindow.setResizable(!isFullscreen);
      mainWindow.setMovable(!isFullscreen);
      // Set a reasonable size when exiting fullscreen
      if (!isFullscreen) {
        mainWindow.setSize(1280, 800);
        mainWindow.center();
      }
    }
  });

  ipcMain.handle('get-server-info', () => {
    return webServer.getServerInfo();
  });

  // Start web server for remote settings
  const settings = loadSettings();
  const port = settings.webServerPort || 3000;

  webServer.startServer(port, loadSettings, saveSettings, (newSettings) => {
    // Settings changed from web interface, notify renderer to reload
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('settings-changed', newSettings);
    }

    // Check if port changed and restart server
    const currentInfo = webServer.getServerInfo();
    if (currentInfo && newSettings.webServerPort && newSettings.webServerPort !== currentInfo.port) {
      console.log(`Port changed from ${currentInfo.port} to ${newSettings.webServerPort}, restarting server...`);
      webServer.startServer(newSettings.webServerPort, loadSettings, saveSettings, null)
        .catch(err => console.error('Failed to restart server on new port:', err));
    }
  }).catch(err => {
    console.error('Failed to start web server:', err);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  webServer.stopServer();
});
