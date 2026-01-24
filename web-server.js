const express = require('express');
const path = require('path');
const os = require('os');

let server = null;
let currentPort = null;

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses;
}

function createServer(loadSettings, saveSettings, onSettingsChanged) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'web')));

  // Serve settings page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'settings.html'));
  });

  // API: Get settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = loadSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load settings' });
    }
  });

  // API: Save settings
  app.post('/api/settings', (req, res) => {
    try {
      const settings = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Invalid settings format' });
      }

      if (!Array.isArray(settings.dashboards)) {
        return res.status(400).json({ error: 'Dashboards must be an array' });
      }

      const success = saveSettings(settings);

      if (success) {
        if (onSettingsChanged) {
          onSettingsChanged(settings);
        }
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to save settings' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // API: Server status
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'running',
      port: currentPort,
      addresses: getNetworkAddresses()
    });
  });

  return app;
}

function startServer(port, loadSettings, saveSettings, onSettingsChanged) {
  return new Promise((resolve, reject) => {
    if (server) {
      stopServer().then(() => {
        startNewServer(port, loadSettings, saveSettings, onSettingsChanged, resolve, reject);
      });
    } else {
      startNewServer(port, loadSettings, saveSettings, onSettingsChanged, resolve, reject);
    }
  });
}

function startNewServer(port, loadSettings, saveSettings, onSettingsChanged, resolve, reject) {
  const app = createServer(loadSettings, saveSettings, onSettingsChanged);

  server = app.listen(port, '0.0.0.0', () => {
    currentPort = port;
    const addresses = getNetworkAddresses();
    console.log(`Web settings server running on port ${port}`);
    console.log('Access from:');
    console.log(`  Local: http://localhost:${port}`);
    addresses.forEach(addr => {
      console.log(`  Network: http://${addr}:${port}`);
    });
    resolve({ port, addresses });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      reject(new Error(`Port ${port} is already in use`));
    } else {
      reject(error);
    }
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        currentPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function getServerInfo() {
  if (!server || !currentPort) {
    return null;
  }

  return {
    port: currentPort,
    addresses: getNetworkAddresses()
  };
}

module.exports = {
  startServer,
  stopServer,
  getServerInfo,
  getNetworkAddresses
};
