// utils/toast.js - Modern toast notification system

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (0 = permanent)
 */
function showToast(message, type = 'info', duration = 5000) {
  const container = getOrCreateToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = getIconForType(type);
  const closeBtn = '<button class="toast-close" aria-label="Close">&times;</button>';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    ${closeBtn}
  `;

  // Add to container with animation
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  // Close button handler
  const closeBtnEl = toast.querySelector('.toast-close');
  closeBtnEl.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  return toast;
}

function removeToast(toast) {
  toast.classList.remove('toast-show');
  toast.classList.add('toast-hide');

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

function getOrCreateToastContainer() {
  let container = document.getElementById('toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  return container;
}

function getIconForType(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return icons[type] || icons.info;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Convenience methods
function showSuccess(message, duration) {
  return showToast(message, 'success', duration);
}

function showError(message, duration) {
  return showToast(message, 'error', duration);
}

function showWarning(message, duration) {
  return showToast(message, 'warning', duration);
}

function showInfo(message, duration) {
  return showToast(message, 'info', duration);
}

// Export for use in renderer
if (typeof window !== 'undefined') {
  window.Toast = {
    show: showToast,
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo
  };
}
