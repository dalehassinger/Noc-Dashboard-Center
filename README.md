# NOC Dashboard Center

A full-screen dashboard rotation application designed for Network Operations Centers (NOC). Display multiple web-based dashboards on a continuous rotation cycle, perfect for monitoring screens, TV displays, and kiosk setups.

## Release Notes

### Version 1.1.0 - January 27, 2026

**New Features:**
- **Fullscreen Toggle** - Added option to switch between fullscreen and windowed mode from the settings panel
- **Windowed Mode Support** - When fullscreen is disabled:
  - Draggable title bar for moving the window
  - Resizable window with visual resize handle indicator
  - Window defaults to 1280x800 centered on screen
- **Improved Edit Functionality** - Dashboard editing now uses a form-based approach:
  - Click the pencil icon to edit a dashboard
  - Form fields populate with current values
  - Update or Cancel buttons for clear workflow
  - Same editing experience in both the app and web interface

**Improvements:**
- Application always starts in fullscreen mode for consistent NOC display behavior
- Settings modal and all interactive elements work correctly in frameless window mode
- Edit button now visible and functional in dashboard list

---

## Features

- **Full-screen dashboard rotation** - Automatically cycles through configured dashboards
- **Fullscreen/Windowed mode** - Toggle between fullscreen and windowed mode; app always starts fullscreen
- **Configurable display duration** - Set how long each dashboard is displayed (5-3600 seconds)
- **Remote settings management** - Edit dashboards from any device on your network via web browser
- **Self-signed certificate support** - Works with internal dashboards using self-signed SSL certificates
- **Keyboard shortcuts** - Quick access to settings and controls
- **Progress bar** - Visual indicator showing time remaining on current dashboard
- **Dark theme** - Easy on the eyes for 24/7 monitoring environments

## Screenshots

The application runs in full-screen mode, cycling through your configured dashboards with a subtle progress bar at the bottom.

## Installation

### Prerequisites

- Node.js 18+ and npm
- Git

### Clone the Repository

```bash
git clone https://github.com/dalehassinger/Noc-Dashboard-Center.git
cd Noc-Dashboard-Center
```

### macOS

```bash
# Install dependencies
npm install

# Run the application
npm start

# Build a standalone app (optional)
npm run make
```

The built application will be in the `out/` directory.

### Linux (Ubuntu/Debian)

```bash
# Install Node.js if not already installed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies for Electron
sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0

# Install project dependencies
npm install

# Run the application
npm start
```

### Raspberry Pi (Raspberry Pi OS)

The Raspberry Pi is ideal for dedicated NOC display screens.

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js (use NodeSource for latest version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Electron dependencies
sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0

# Clone and setup
git clone https://github.com/dalehassinger/Noc-Dashboard-Center.git
cd Noc-Dashboard-Center
npm install
```

#### Raspberry Pi: Disable Screen Blanking

To prevent the screen from going blank:

```bash
# Edit the autostart config
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
```

Add these lines:
```
@xset s off
@xset -dpms
@xset s noblank
```

#### Raspberry Pi: Autostart on Boot

**Method 1: Using autostart (Desktop environment)**

```bash
# Create autostart directory if it doesn't exist
mkdir -p ~/.config/autostart

# Create desktop entry
cat > ~/.config/autostart/noc-dashboard.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=NOC Dashboard Center
Exec=/bin/bash -c "cd /home/pi/Noc-Dashboard-Center && npm start"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

**Method 2: Using systemd (Recommended for headless with display)**

```bash
# Create systemd service
sudo nano /etc/systemd/system/noc-dashboard.service
```

Add the following content:
```ini
[Unit]
Description=NOC Dashboard Center
After=graphical.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
WorkingDirectory=/home/pi/Noc-Dashboard-Center
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable noc-dashboard.service
sudo systemctl start noc-dashboard.service

# Check status
sudo systemctl status noc-dashboard.service
```

**Method 3: Using crontab**

```bash
crontab -e
```

Add this line:
```
@reboot sleep 30 && cd /home/pi/Noc-Dashboard-Center && DISPLAY=:0 npm start
```

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Open/close settings |
| `Ctrl+R` / `Cmd+R` | Restart dashboard rotation |
| `Escape` | Close settings or exit application |

### Local Settings

1. Move your mouse to reveal the gear icon in the top-right corner
2. Click the gear icon or press `Ctrl+S` / `Cmd+S`
3. Add dashboards:
   - Enter a description (e.g., "Network Status")
   - Enter the dashboard URL
   - Set the display duration in seconds
   - Click "Add Dashboard"
4. Manage dashboards:
   - Reorder using the up/down arrows
   - Adjust duration directly in the list
   - Edit dashboards by clicking the pencil icon (form fields populate with current values)
   - Delete unwanted dashboards
5. Display Settings:
   - **Full Screen Mode** - Toggle between fullscreen and windowed mode
   - When windowed, drag the title bar to move and use window edges to resize
6. Click "Save & Close" to apply changes

### Remote Settings (Web Interface)

The application includes a built-in web server for remote configuration.

1. **Find your access URL**: When the app starts, check the terminal output:
   ```
   Web settings server running on port 3000
   Access from:
     Local: http://localhost:3000
     Network: http://192.168.1.100:3000
   ```

2. **Access from any device**: Open a web browser on your phone, tablet, or computer and navigate to the network URL (e.g., `http://192.168.1.100:3000`)

3. **Manage dashboards**: The web interface provides the same functionality as local settings:
   - Add new dashboards with description, URL, and duration
   - Edit existing dashboards
   - Reorder and delete dashboards
   - Changes sync automatically to the running application

4. **Change server port**: In the web interface under "Server Settings", you can change the web server port. The server will restart on the new port.

### Configuration Storage

Settings are stored locally in:
- **macOS**: `~/Library/Application Support/noc-dashboard-center/settings.json`
- **Linux/Pi**: `~/.config/noc-dashboard-center/settings.json`

### Settings Format

```json
{
  "dashboards": [
    {
      "description": "Network Status",
      "url": "https://vcf.example.com/dashboard/network",
      "duration": 30
    },
    {
      "description": "Server Health",
      "url": "https://monitoring.example.com/servers",
      "duration": 45
    }
  ],
  "webServerPort": 3000,
  "fullscreen": true
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `dashboards` | Array of dashboard configurations | `[]` |
| `webServerPort` | Port for the remote settings web server | `3000` |
| `fullscreen` | Display in fullscreen mode | `true` |

## Troubleshooting

### Dashboard shows certificate error
The application is configured to accept self-signed certificates, which is common for internal monitoring tools. No action needed.

### Web server not accessible from other devices
- Ensure the devices are on the same network
- Check firewall settings: `sudo ufw allow 3000/tcp` (Linux)
- Verify the correct IP address in terminal output

### Raspberry Pi: Black screen on boot
- Ensure the desktop environment is starting
- Check service logs: `journalctl -u noc-dashboard.service`
- Verify DISPLAY environment variable is set

### Application won't start
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Development

```bash
# Run in development mode
npm start

# Build distributables
npm run make

# Package without building installers
npm run package
```

## License

MIT License - feel free to use and modify for your NOC needs.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
