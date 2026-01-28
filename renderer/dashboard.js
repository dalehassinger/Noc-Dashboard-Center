// State
let settings = { dashboards: [], fullscreen: true };
let currentIndex = 0;
let rotationTimer = null;
let progressTimer = null;
let progressStartTime = null;
let isSettingsOpen = false;
let editingIndex = -1; // -1 means adding new, >= 0 means editing existing

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const dashboardContainer = document.getElementById('dashboard-container');
const webview = document.getElementById('dashboard-webview');
const loadingIndicator = document.getElementById('loading-indicator');
const settingsIcon = document.getElementById('settings-icon');
const settingsModal = document.getElementById('settings-modal');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const dashboardsContainer = document.getElementById('dashboards-container');

// Initialize
async function init() {
  settings = await window.electronAPI.getSettings();
  setupEventListeners();
  setupIPCListeners();
  updateView();
}

function setupEventListeners() {
  // Settings icon click
  settingsIcon.addEventListener('click', openSettings);

  // Welcome screen button
  document.getElementById('welcome-settings-btn').addEventListener('click', openSettings);

  // Close settings
  document.getElementById('close-settings').addEventListener('click', closeSettings);

  // Add dashboard button
  document.getElementById('add-dashboard-btn').addEventListener('click', addDashboard);

  // Save settings button
  document.getElementById('save-settings-btn').addEventListener('click', saveAndClose);

  // Fullscreen checkbox
  document.getElementById('fullscreen-checkbox').addEventListener('change', (e) => {
    settings.fullscreen = e.target.checked;
  });

  // Webview events
  webview.addEventListener('did-start-loading', () => {
    loadingIndicator.classList.remove('hidden');
  });

  webview.addEventListener('did-stop-loading', () => {
    loadingIndicator.classList.add('hidden');
  });

  webview.addEventListener('did-fail-load', (event) => {
    console.error('Failed to load:', event.errorDescription);
    loadingIndicator.classList.add('hidden');
  });

  // Enter key in URL input
  document.getElementById('new-url').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDashboard();
    }
  });
}

function setupIPCListeners() {
  window.electronAPI.onOpenSettings(() => {
    if (isSettingsOpen) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  window.electronAPI.onRestartRotation(() => {
    restartRotation();
  });

  window.electronAPI.onEscapePressed(() => {
    if (isSettingsOpen) {
      closeSettings();
    } else {
      window.electronAPI.closeApp();
    }
  });

  // Handle settings changes from web interface
  window.electronAPI.onSettingsChanged((newSettings) => {
    settings = newSettings;
    if (!isSettingsOpen) {
      // Only update view if settings modal is not open
      stopRotation();
      updateView();
    } else {
      // Update the settings list if modal is open
      renderDashboardList();
    }
  });
}

function updateView() {
  if (settings.dashboards.length === 0) {
    showWelcomeScreen();
  } else {
    showDashboards();
  }
}

function showWelcomeScreen() {
  stopRotation();
  welcomeScreen.classList.remove('hidden');
  dashboardContainer.classList.add('hidden');
  progressBarContainer.classList.add('hidden');
}

function showDashboards() {
  welcomeScreen.classList.add('hidden');
  dashboardContainer.classList.remove('hidden');
  progressBarContainer.classList.remove('hidden');
  startRotation();
}

function startRotation() {
  if (settings.dashboards.length === 0) return;

  currentIndex = 0;
  loadCurrentDashboard();
}

function restartRotation() {
  stopRotation();
  currentIndex = 0;
  if (settings.dashboards.length > 0) {
    loadCurrentDashboard();
  }
}

function loadCurrentDashboard() {
  const dashboard = settings.dashboards[currentIndex];
  if (!dashboard) return;

  webview.src = dashboard.url;
  startProgressBar(dashboard.duration);
  scheduleNextDashboard(dashboard.duration);
}

function scheduleNextDashboard(duration) {
  clearTimeout(rotationTimer);
  rotationTimer = setTimeout(() => {
    currentIndex = (currentIndex + 1) % settings.dashboards.length;
    loadCurrentDashboard();
  }, duration * 1000);
}

function startProgressBar(duration) {
  progressBar.style.transition = 'none';
  progressBar.style.width = '0%';

  // Force reflow
  progressBar.offsetHeight;

  progressBar.style.transition = `width ${duration}s linear`;
  progressBar.style.width = '100%';
}

function stopRotation() {
  clearTimeout(rotationTimer);
  progressBar.style.transition = 'none';
  progressBar.style.width = '0%';
}

function openSettings() {
  isSettingsOpen = true;
  editingIndex = -1; // Reset editing state
  renderDashboardList();
  settingsModal.classList.remove('hidden');

  // Clear add form and reset button
  document.getElementById('new-description').value = '';
  document.getElementById('new-url').value = '';
  document.getElementById('new-duration').value = '30';
  document.getElementById('add-dashboard-btn').textContent = 'Add Dashboard';

  // Set fullscreen checkbox
  document.getElementById('fullscreen-checkbox').checked = settings.fullscreen !== false;
}

function closeSettings() {
  isSettingsOpen = false;
  settingsModal.classList.add('hidden');
}

async function saveAndClose() {
  const success = await window.electronAPI.saveSettings(settings);
  if (success) {
    // Apply fullscreen setting immediately
    const isFullscreen = settings.fullscreen !== false;
    await window.electronAPI.setFullscreen(isFullscreen);
    updateWindowMode(isFullscreen);
    closeSettings();
    updateView();
  } else {
    alert('Failed to save settings');
  }
}

function updateWindowMode(isFullscreen) {
  const titleBar = document.getElementById('title-bar');
  const resizeHandle = document.getElementById('resize-handle');
  if (isFullscreen) {
    titleBar.classList.add('hidden');
    resizeHandle.classList.add('hidden');
    document.body.classList.remove('windowed');
  } else {
    titleBar.classList.remove('hidden');
    resizeHandle.classList.remove('hidden');
    document.body.classList.add('windowed');
  }
}

function addDashboard() {
  const descriptionInput = document.getElementById('new-description');
  const urlInput = document.getElementById('new-url');
  const durationInput = document.getElementById('new-duration');

  const description = descriptionInput.value.trim();
  const url = urlInput.value.trim();
  const duration = parseInt(durationInput.value, 10);

  if (!url) {
    alert('Please enter a URL');
    urlInput.focus();
    return;
  }

  if (!isValidUrl(url)) {
    alert('Please enter a valid URL (starting with http:// or https://)');
    urlInput.focus();
    return;
  }

  if (isNaN(duration) || duration < 5 || duration > 3600) {
    alert('Duration must be between 5 and 3600 seconds');
    durationInput.focus();
    return;
  }

  if (editingIndex >= 0) {
    // Update existing dashboard
    settings.dashboards[editingIndex] = { description, url, duration };
    editingIndex = -1;
    document.getElementById('add-dashboard-btn').textContent = 'Add Dashboard';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
  } else {
    // Add new dashboard
    settings.dashboards.push({ description, url, duration });
  }
  renderDashboardList();

  // Clear inputs
  descriptionInput.value = '';
  urlInput.value = '';
  durationInput.value = '30';
  descriptionInput.focus();
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function removeDashboard(index) {
  settings.dashboards.splice(index, 1);
  renderDashboardList();
}

function editDashboard(index) {
  const dashboard = settings.dashboards[index];
  editingIndex = index;

  // Populate the form with existing values
  document.getElementById('new-description').value = dashboard.description || '';
  document.getElementById('new-url').value = dashboard.url;
  document.getElementById('new-duration').value = dashboard.duration;

  // Change button text to indicate editing and show cancel button
  document.getElementById('add-dashboard-btn').textContent = 'Update Dashboard';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');

  // Scroll to the form
  document.querySelector('.add-dashboard').scrollIntoView({ behavior: 'smooth' });

  // Focus on the description field
  document.getElementById('new-description').focus();
}

function cancelEdit() {
  editingIndex = -1;
  document.getElementById('new-description').value = '';
  document.getElementById('new-url').value = '';
  document.getElementById('new-duration').value = '30';
  document.getElementById('add-dashboard-btn').textContent = 'Add Dashboard';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function moveDashboard(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= settings.dashboards.length) return;

  const temp = settings.dashboards[index];
  settings.dashboards[index] = settings.dashboards[newIndex];
  settings.dashboards[newIndex] = temp;
  renderDashboardList();
}

function updateDashboardDuration(index, newDuration) {
  const duration = parseInt(newDuration, 10);
  if (!isNaN(duration) && duration >= 5 && duration <= 3600) {
    settings.dashboards[index].duration = duration;
  }
}

function renderDashboardList() {
  if (settings.dashboards.length === 0) {
    dashboardsContainer.innerHTML = '<p class="empty-message">No dashboards configured.</p>';
    return;
  }

  const html = settings.dashboards.map((dashboard, index) => `
    <div class="dashboard-item">
      <div class="dashboard-info">
        <span class="dashboard-number">${index + 1}</span>
        <span class="dashboard-description">${escapeHtml(dashboard.description || 'No description')}</span>
        <span class="dashboard-url" title="${escapeHtml(dashboard.url)}">${escapeHtml(truncateUrl(dashboard.url))}</span>
      </div>
      <div class="dashboard-controls">
        <input type="number" class="duration-input" value="${dashboard.duration}" min="5" max="3600"
               onchange="updateDashboardDuration(${index}, this.value)" title="Duration in seconds">
        <span class="duration-label">sec</span>
        <button class="icon-btn move-btn" onclick="moveDashboard(${index}, -1)" title="Move up" ${index === 0 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
        </button>
        <button class="icon-btn move-btn" onclick="moveDashboard(${index}, 1)" title="Move down" ${index === settings.dashboards.length - 1 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <button class="icon-btn edit-btn" onclick="editDashboard(${index})" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn delete-btn" onclick="removeDashboard(${index})" title="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join('');

  dashboardsContainer.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateUrl(url) {
  return url.length > 50 ? url.substring(0, 47) + '...' : url;
}

// Make functions globally accessible for inline handlers
window.removeDashboard = removeDashboard;
window.moveDashboard = moveDashboard;
window.editDashboard = editDashboard;
window.cancelEdit = cancelEdit;
window.updateDashboardDuration = updateDashboardDuration;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
