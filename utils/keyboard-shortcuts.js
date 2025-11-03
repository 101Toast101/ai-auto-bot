// utils/keyboard-shortcuts.js - Global keyboard shortcuts

/**
 * Initialize keyboard shortcuts
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);

  // Show shortcuts help with Ctrl+/
  registerShortcut('ctrl+/', showShortcutsHelp);
}

/**
 * Handle keyboard shortcut events
 */
function handleKeyboardShortcut(e) {
  // Don't trigger shortcuts when typing in input fields
  if (isTypingInInput(e.target)) {
    return;
  }

  const key = getShortcutKey(e);

  // Define shortcuts
  const shortcuts = {
    'ctrl+n': () => document.getElementById('postNowBtn')?.click(),
    'ctrl+p': () => document.getElementById('previewPostBtn')?.click(),
    'ctrl+b': () => document.getElementById('bulkGenerateBtn')?.click(),
    'ctrl+s': () => document.getElementById('saveConfigBtn')?.click(),
    'ctrl+l': () => document.getElementById('loadConfigBtn')?.click(),
    'ctrl+r': () => document.getElementById('resetLayoutBtn')?.click(),
    'ctrl+shift+d': () => document.getElementById('darkModeToggle')?.click(),
    'ctrl+shift+s': () => document.getElementById('scheduledPostsTab')?.click(),
    'ctrl+shift+l': () => document.getElementById('libraryTab')?.click(),
    'ctrl+shift+g': () => document.getElementById('generalTab')?.click(),
    'ctrl+shift+t': () => document.getElementById('tokensTab')?.click(),
    'escape': closeModals,
    'ctrl+/': (e) => {
      e.preventDefault();
      showShortcutsHelp();
    }
  };

  const handler = shortcuts[key];
  if (handler) {
    e.preventDefault();
    handler(e);
  }
}

/**
 * Check if user is typing in an input field
 */
function isTypingInInput(element) {
  return element.tagName === 'INPUT' ||
         element.tagName === 'TEXTAREA' ||
         element.isContentEditable;
}

/**
 * Get normalized shortcut key from event
 */
function getShortcutKey(e) {
  const parts = [];

  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  const key = e.key.toLowerCase();
  if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
    parts.push(key);
  }

  return parts.join('+');
}

/**
 * Register a custom shortcut
 */
function registerShortcut(shortcut, handler) {
  // Store custom shortcuts for later reference
  if (!window._customShortcuts) {
    window._customShortcuts = {};
  }
  window._customShortcuts[shortcut] = handler;
}

/**
 * Close all open modals
 */
function closeModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (modal.style.display !== 'none') {
      modal.style.display = 'none';
    }
  });
}

/**
 * Show keyboard shortcuts help modal
 */
function showShortcutsHelp() {
  const shortcuts = [
    { keys: 'Ctrl+N', desc: 'Post Now' },
    { keys: 'Ctrl+P', desc: 'Preview Post' },
    { keys: 'Ctrl+B', desc: 'Bulk Generate' },
    { keys: 'Ctrl+S', desc: 'Save Configuration' },
    { keys: 'Ctrl+L', desc: 'Load Configuration' },
    { keys: 'Ctrl+R', desc: 'Reset Layout' },
    { keys: 'Ctrl+Shift+D', desc: 'Toggle Dark Mode' },
    { keys: 'Ctrl+Shift+S', desc: 'Scheduled Posts Tab' },
    { keys: 'Ctrl+Shift+L', desc: 'Library Tab' },
    { keys: 'Ctrl+Shift+G', desc: 'General Tab' },
    { keys: 'Ctrl+Shift+T', desc: 'Tokens Tab' },
    { keys: 'Escape', desc: 'Close Modals' },
    { keys: 'Ctrl+/', desc: 'Show This Help' }
  ];

  const html = `
    <div class="shortcuts-help">
      <h2>⌨️ Keyboard Shortcuts</h2>
      <table class="shortcuts-table">
        ${shortcuts.map(s => `
          <tr>
            <td class="shortcut-keys"><kbd>${s.keys.replace(/\+/g, '</kbd> + <kbd>')}</kbd></td>
            <td class="shortcut-desc">${s.desc}</td>
          </tr>
        `).join('')}
      </table>
      <p class="shortcuts-hint">Press <kbd>Escape</kbd> to close this dialog</p>
    </div>
  `;

  // Create or get modal
  let modal = document.getElementById('shortcutsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'shortcutsModal';
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${html}</div>`;
    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  modal.style.display = 'flex';
}

// Auto-initialize when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKeyboardShortcuts);
} else {
  initKeyboardShortcuts();
}

// Export for manual control
if (typeof window !== 'undefined') {
  window.KeyboardShortcuts = {
    init: initKeyboardShortcuts,
    register: registerShortcut,
    showHelp: showShortcutsHelp
  };
}
