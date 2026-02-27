// State
let settings = { dashboards: [], fullscreen: true };
let currentIndex = 0;
let rotationTimer = null;
let progressTimer = null;
let progressStartTime = null;
let isSettingsOpen = false;
let isPinModalOpen = false;
let editingIndex = -1; // -1 means adding new, >= 0 means editing existing
let dragSrcIndex = null;
let dragHandleArmedIndex = null;
let pointerDragActive = false;
let pointerDragIndex = null;

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
  settingsIcon.addEventListener('click', promptForPin);

  // Welcome screen button
  document.getElementById('welcome-settings-btn').addEventListener('click', promptForPin);

  // Close settings
  document.getElementById('close-settings').addEventListener('click', closeSettings);

  // Add dashboard button
  document.getElementById('add-dashboard-btn').addEventListener('click', addDashboard);

  // Save settings button
  document.getElementById('save-settings-btn').addEventListener('click', saveAndClose);

  // Change PIN button
  document.getElementById('change-pin-btn').addEventListener('click', changePin);

  // PIN modal buttons
  document.getElementById('pin-submit-btn').addEventListener('click', submitPin);
  document.getElementById('pin-cancel-btn').addEventListener('click', closePinModal);
  document.getElementById('pin-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitPin();
  });

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

  // Delegated drag/drop handlers for reliable row reordering
  dashboardsContainer.addEventListener('mousedown', onDashboardListMouseDown);
  dashboardsContainer.addEventListener('dragover', onDashboardListDragOver);
  dashboardsContainer.addEventListener('drop', onDashboardListDrop);
  dashboardsContainer.addEventListener('dragend', onDragEnd);
}

function setupIPCListeners() {
  window.electronAPI.onOpenSettings(() => {
    if (isSettingsOpen) {
      closeSettings();
    } else {
      promptForPin();
    }
  });

  window.electronAPI.onRestartRotation(() => {
    restartRotation();
  });

  window.electronAPI.onEscapePressed(() => {
    if (isPinModalOpen) {
      closePinModal();
    } else if (isSettingsOpen) {
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

function getEnabledDashboards() {
  return settings.dashboards.filter(d => d.enabled !== false);
}

function updateView() {
  if (getEnabledDashboards().length === 0) {
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
  const enabled = getEnabledDashboards();
  if (enabled.length === 0) return;

  currentIndex = 0;
  loadCurrentDashboard();
}

function restartRotation() {
  stopRotation();
  currentIndex = 0;
  if (getEnabledDashboards().length > 0) {
    loadCurrentDashboard();
  }
}

function loadCurrentDashboard() {
  const enabled = getEnabledDashboards();
  if (enabled.length === 0) return;

  const dashboard = enabled[currentIndex % enabled.length];
  if (!dashboard) return;

  webview.src = dashboard.url;
  startProgressBar(dashboard.duration);
  scheduleNextDashboard(dashboard.duration);
}

function scheduleNextDashboard(duration) {
  clearTimeout(rotationTimer);
  rotationTimer = setTimeout(() => {
    const enabled = getEnabledDashboards();
    if (enabled.length === 0) return;
    currentIndex = (currentIndex + 1) % enabled.length;
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

function promptForPin() {
  if (isSettingsOpen || isPinModalOpen) return;
  isPinModalOpen = true;
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  pinModal.classList.remove('hidden');
  pinInput.value = '';
  pinError.classList.add('hidden');
  pinInput.focus();
}

function closePinModal() {
  isPinModalOpen = false;
  document.getElementById('pin-modal').classList.add('hidden');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').classList.add('hidden');
}

function submitPin() {
  const pinInput = document.getElementById('pin-input');
  const pinError = document.getElementById('pin-error');
  const enteredPin = pinInput.value;
  const correctPin = settings.pin || '1234';

  if (enteredPin === correctPin) {
    closePinModal();
    openSettings();
  } else {
    pinError.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
}

function changePin() {
  const currentPin = document.getElementById('current-pin').value;
  const newPin = document.getElementById('new-pin').value;
  const confirmPin = document.getElementById('confirm-pin').value;

  if (currentPin !== (settings.pin || '1234')) {
    alert('Current PIN is incorrect');
    return;
  }

  if (!/^\d{4}$/.test(newPin)) {
    alert('New PIN must be exactly 4 digits');
    return;
  }

  if (newPin !== confirmPin) {
    alert('New PINs do not match');
    return;
  }

  settings.pin = newPin;

  // Clear the fields
  document.getElementById('current-pin').value = '';
  document.getElementById('new-pin').value = '';
  document.getElementById('confirm-pin').value = '';

  alert('PIN changed successfully');
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
    // Update existing dashboard - preserve enabled state
    const wasEnabled = settings.dashboards[editingIndex].enabled;
    settings.dashboards[editingIndex] = { description, url, duration, enabled: wasEnabled !== false };
    editingIndex = -1;
    document.getElementById('add-dashboard-btn').textContent = 'Add Dashboard';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
  } else {
    // Add new dashboard
    settings.dashboards.push({ description, url, duration, enabled: true });
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

function toggleDashboard(index, enabled) {
  settings.dashboards[index].enabled = enabled;
  renderDashboardList();
}

function onDragStart(event, index) {
  if (dragHandleArmedIndex !== index) {
    event.preventDefault();
    return;
  }
  dragSrcIndex = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(index));
  setTimeout(() => {
    const items = document.querySelectorAll('#dashboards-container .dashboard-item');
    if (items[index]) items[index].classList.add('dragging');
  }, 0);
}

function armRowDrag(index, event) {
  if (event.button !== 0) return;
  dragHandleArmedIndex = index;
}

function clearArmedRowDrag() {
  dragHandleArmedIndex = null;
}

function beginPointerReorder(index, event) {
  if (event.button !== 0) return;
  event.preventDefault();

  pointerDragActive = true;
  pointerDragIndex = index;
  document.body.classList.add('reordering-active');
  renderDashboardList();

  document.addEventListener('mousemove', onPointerReorderMove);
  document.addEventListener('mouseup', endPointerReorder);
}

function onPointerReorderMove(event) {
  if (!pointerDragActive || pointerDragIndex === null) return;

  const elUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
  const targetRow = elUnderPointer ? elUnderPointer.closest('.dashboard-item') : null;
  if (!targetRow) return;

  const targetIndex = parseInt(targetRow.dataset.index, 10);
  if (!Number.isInteger(targetIndex) || targetIndex === pointerDragIndex) return;

  const moved = settings.dashboards.splice(pointerDragIndex, 1)[0];
  settings.dashboards.splice(targetIndex, 0, moved);
  pointerDragIndex = targetIndex;
  renderDashboardList();
}

function endPointerReorder() {
  if (!pointerDragActive) return;

  pointerDragActive = false;
  pointerDragIndex = null;
  document.body.classList.remove('reordering-active');
  renderDashboardList();

  document.removeEventListener('mousemove', onPointerReorderMove);
  document.removeEventListener('mouseup', endPointerReorder);
}

function onDragOver(event, el) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('#dashboards-container .dashboard-item').forEach(item => item.classList.remove('drag-over'));
  el.classList.add('drag-over');
}

function onDrop(event, targetIndex) {
  event.preventDefault();
  if (dragSrcIndex === null) {
    const srcFromTransfer = parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (Number.isInteger(srcFromTransfer)) {
      dragSrcIndex = srcFromTransfer;
    }
  }
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
  const moved = settings.dashboards.splice(dragSrcIndex, 1)[0];
  settings.dashboards.splice(targetIndex, 0, moved);
  dragSrcIndex = null;
  clearArmedRowDrag();
  renderDashboardList();
}

function onDragEnd(event) {
  dragSrcIndex = null;
  clearArmedRowDrag();
  document.querySelectorAll('#dashboards-container .dashboard-item').forEach(item => {
    item.classList.remove('dragging', 'drag-over');
  });
}

function onDashboardListMouseDown(event) {
  const handle = event.target.closest('.drag-handle');
  if (!handle) return;

  const row = handle.closest('.dashboard-item');
  if (!row) return;

  const index = parseInt(row.dataset.index, 10);
  if (!Number.isInteger(index)) return;

  armRowDrag(index, event);
}

function onDashboardListDragOver(event) {
  const row = event.target.closest('.dashboard-item');
  if (!row) return;
  onDragOver(event, row);
}

function onDashboardListDrop(event) {
  const row = event.target.closest('.dashboard-item');
  if (!row) {
    event.preventDefault();
    return;
  }

  const targetIndex = parseInt(row.dataset.index, 10);
  if (!Number.isInteger(targetIndex)) {
    event.preventDefault();
    return;
  }

  onDrop(event, targetIndex);
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
    <div class="dashboard-item${dashboard.enabled === false ? ' disabled' : ''}${pointerDragActive && pointerDragIndex === index ? ' dragging' : ''}"
         data-index="${index}"
         draggable="false">
      <div class="drag-handle" title="Drag to reorder" onmousedown="beginPointerReorder(${index}, event)">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
          <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
          <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
        </svg>
      </div>
      <div class="dashboard-info">
        <span class="dashboard-number">${index + 1}</span>
        <span class="dashboard-description">${escapeHtml(dashboard.description || 'No description')}</span>
        <span class="dashboard-url" title="${escapeHtml(dashboard.url)}">${escapeHtml(truncateUrl(dashboard.url))}</span>
      </div>
      <div class="dashboard-controls">
        <label class="toggle-switch" title="${dashboard.enabled !== false ? 'Enabled' : 'Disabled'}">
          <input type="checkbox" ${dashboard.enabled !== false ? 'checked' : ''} onchange="toggleDashboard(${index}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <input type="number" class="duration-input" value="${dashboard.duration}" min="5" max="3600"
               onchange="updateDashboardDuration(${index}, this.value)" title="Duration in seconds">
        <span class="duration-label">sec</span>
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
window.editDashboard = editDashboard;
window.cancelEdit = cancelEdit;
window.updateDashboardDuration = updateDashboardDuration;
window.toggleDashboard = toggleDashboard;
window.onDragStart = onDragStart;
window.onDragOver = onDragOver;
window.onDrop = onDrop;
window.onDragEnd = onDragEnd;
window.armRowDrag = armRowDrag;
window.beginPointerReorder = beginPointerReorder;

document.addEventListener('mouseup', clearArmedRowDrag);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
