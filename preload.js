const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  closeApp: () => ipcRenderer.invoke('close-app'),

  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', callback);
  },
  onRestartRotation: (callback) => {
    ipcRenderer.on('restart-rotation', callback);
  },
  onEscapePressed: (callback) => {
    ipcRenderer.on('escape-pressed', callback);
  },
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-changed', (event, settings) => callback(settings));
  },
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  setFullscreen: (isFullscreen) => ipcRenderer.invoke('set-fullscreen', isFullscreen),

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
