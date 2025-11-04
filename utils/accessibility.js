// accessibility.js - WCAG 2.1 AA Compliance Utilities

/**
 * Accessibility Manager for AI Auto Bot
 * Implements WCAG 2.1 AA standards for screen readers, keyboard navigation, and high contrast
 */

class AccessibilityManager {
  constructor() {
    this.screenReaderAnnouncer = null;
    this.focusTrapStack = [];
    this.keyboardShortcuts = new Map();
    this.highContrastMode = false;
  }

  /**
   * Initialize accessibility features
   */
  init() {
    this.createScreenReaderAnnouncer();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
    this.setupHighContrastMode();
    this.addSkipLinks();
    this.enhanceFormAccessibility();
    this.setupARIALiveRegions();

    // Features initialized successfully
  }

  /**
   * Create ARIA live region for screen reader announcements
   */
  createScreenReaderAnnouncer() {
    if (this.screenReaderAnnouncer) {
      return;
    }

    const announcer = document.createElement('div');
    announcer.id = 'screen-reader-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;

    document.body.appendChild(announcer);
    this.screenReaderAnnouncer = announcer;
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' or 'assertive'
   */
  announce(message, priority = 'polite') {
    if (!this.screenReaderAnnouncer) {
      this.createScreenReaderAnnouncer();
    }

    this.screenReaderAnnouncer.setAttribute('aria-live', priority);
    this.screenReaderAnnouncer.textContent = '';

    // Small delay to ensure screen readers notice the change
    setTimeout(() => {
      this.screenReaderAnnouncer.textContent = message;
    }, 100);
  }

  /**
   * Setup keyboard navigation for entire app
   */
  setupKeyboardNavigation() {
    // Tab trap for modal dialogs
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleEscapeKey();
      }

      if (e.key === 'Tab') {
        this.handleTabKey(e);
      }
    });

    // Add visible focus indicators
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });
  }

  /**
   * Handle Escape key to close modals/dialogs
   */
  handleEscapeKey() {
    const modals = document.querySelectorAll('.modal-overlay:not(.hidden), [role="dialog"]:not([aria-hidden="true"])');
    if (modals.length > 0) {
      const topModal = modals[modals.length - 1];
      const closeBtn = topModal.querySelector('[data-close-modal], .close-modal, [aria-label*="Close"]');
      if (closeBtn) {
        closeBtn.click();
        this.announce('Dialog closed');
      }
    }
  }

  /**
   * Handle Tab key for focus trapping in modals
   * @param {KeyboardEvent} e
   */
  handleTabKey(e) {
    if (this.focusTrapStack.length === 0) {
      return;
    }

    const currentTrap = this.focusTrapStack[this.focusTrapStack.length - 1];
    const focusableElements = currentTrap.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Setup focus management for modals
   */
  setupFocusManagement() {
    // Observe DOM for modal changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.matches('.modal-overlay, [role="dialog"]') && !node.classList.contains('hidden')) {
              this.trapFocus(node);
            }
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches('.modal-overlay, [role="dialog"]')) {
              this.releaseFocus(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  /**
   * Trap focus within an element (for modals)
   * @param {HTMLElement} element
   */
  trapFocus(element) {
    this.focusTrapStack.push(element);

    // Store previously focused element
    element.dataset.previousFocus = document.activeElement ? document.activeElement.id || 'body' : 'body';

    // Focus first focusable element
    const focusable = element.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }
  }

  /**
   * Release focus trap
   * @param {HTMLElement} element
   */
  releaseFocus(element) {
    const index = this.focusTrapStack.indexOf(element);
    if (index > -1) {
      this.focusTrapStack.splice(index, 1);
    }

    // Restore focus to previous element
    if (element.dataset.previousFocus) {
      const previousElement = document.getElementById(element.dataset.previousFocus) || document.body;
      setTimeout(() => previousElement.focus(), 100);
    }
  }

  /**
   * Add skip links for keyboard users
   */
  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);

    // Add main-content ID if not exists
    const mainContent = document.querySelector('main, .app-content, #app-container');
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
    }
  }

  /**
   * Enhance form accessibility with ARIA labels
   */
  enhanceFormAccessibility() {
    // Add ARIA labels to inputs without labels
    document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])').forEach((input) => {
      const placeholder = input.getAttribute('placeholder');
      const name = input.getAttribute('name');
      const id = input.getAttribute('id');

      if (placeholder) {
        input.setAttribute('aria-label', placeholder);
      } else if (name) {
        input.setAttribute('aria-label', name.replace(/([A-Z])/g, ' $1').trim());
      } else if (id) {
        input.setAttribute('aria-label', id.replace(/([A-Z])/g, ' $1').trim());
      }
    });

    // Add ARIA labels to buttons without labels
    document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])').forEach((button) => {
      if (!button.textContent.trim() && !button.querySelector('img, svg')) {
        button.setAttribute('aria-label', 'Action button');
      }
    });

    // Add role="status" to loading spinners
    document.querySelectorAll('.spinner, .loading, [class*="loading"]').forEach((spinner) => {
      spinner.setAttribute('role', 'status');
      if (!spinner.getAttribute('aria-label')) {
        spinner.setAttribute('aria-label', 'Loading');
      }
    });
  }

  /**
   * Setup ARIA live regions for dynamic content
   */
  setupARIALiveRegions() {
    // Add aria-live to toast/notification containers
    document.querySelectorAll('.toast-container, .notification-container, #toast-container').forEach((container) => {
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
    });

    // Add aria-live to progress indicators
    document.querySelectorAll('.progress, [role="progressbar"]').forEach((progress) => {
      progress.setAttribute('aria-live', 'polite');
    });
  }

  /**
   * Setup high contrast mode support
   */
  setupHighContrastMode() {
    // Detect system high contrast mode
    const supportsHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    if (supportsHighContrast) {
      this.enableHighContrast();
    }

    // Listen for high contrast preference changes
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      if (e.matches) {
        this.enableHighContrast();
      } else {
        this.disableHighContrast();
      }
    });

    // Manual toggle
    const toggleBtn = document.getElementById('high-contrast-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleHighContrast();
      });
    }
  }

  /**
   * Enable high contrast mode
   */
  enableHighContrast() {
    document.body.classList.add('high-contrast');
    this.highContrastMode = true;
    localStorage.setItem('highContrastMode', 'true');
    this.announce('High contrast mode enabled');
  }

  /**
   * Disable high contrast mode
   */
  disableHighContrast() {
    document.body.classList.remove('high-contrast');
    this.highContrastMode = false;
    localStorage.setItem('highContrastMode', 'false');
    this.announce('High contrast mode disabled');
  }

  /**
   * Toggle high contrast mode
   */
  toggleHighContrast() {
    if (this.highContrastMode) {
      this.disableHighContrast();
    } else {
      this.enableHighContrast();
    }
  }

  /**
   * Add keyboard shortcut
   * @param {string} key - Key combination (e.g., 'Ctrl+S')
   * @param {Function} handler - Handler function
   * @param {string} description - Description for help menu
   */
  addShortcut(key, handler, description) {
    this.keyboardShortcuts.set(key, { handler, description });

    document.addEventListener('keydown', (e) => {
      const combo = [
        e.ctrlKey && 'Ctrl',
        e.altKey && 'Alt',
        e.shiftKey && 'Shift',
        e.key
      ].filter(Boolean).join('+');

      if (combo === key) {
        e.preventDefault();
        handler(e);
      }
    });
  }

  /**
   * Get all registered keyboard shortcuts
   * @returns {Map} Keyboard shortcuts map
   */
  getShortcuts() {
    return this.keyboardShortcuts;
  }

  /**
   * Show keyboard shortcuts help dialog
   */
  showShortcutsHelp() {
    const shortcuts = Array.from(this.keyboardShortcuts.entries())
      .map(([key, { description }]) => `<li><kbd>${key}</kbd>: ${description}</li>`)
      .join('');

    const helpDialog = document.createElement('div');
    helpDialog.className = 'modal-overlay';
    helpDialog.setAttribute('role', 'dialog');
    helpDialog.setAttribute('aria-labelledby', 'shortcuts-title');
    helpDialog.setAttribute('aria-modal', 'true');
    helpDialog.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
        <ul class="shortcuts-list" style="list-style: none; padding: 0;">
          ${shortcuts}
          <li><kbd>Escape</kbd>: Close dialog</li>
          <li><kbd>Tab</kbd>: Navigate forward</li>
          <li><kbd>Shift+Tab</kbd>: Navigate backward</li>
        </ul>
        <button class="close-modal" aria-label="Close shortcuts help">Close</button>
      </div>
    `;

    document.body.appendChild(helpDialog);

    helpDialog.querySelector('.close-modal').addEventListener('click', () => {
      helpDialog.remove();
    });

    this.announce('Keyboard shortcuts help opened');
  }

  /**
   * Add focus visible styles
   */
  addFocusStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Keyboard navigation focus indicators */
      .keyboard-navigation *:focus {
        outline: 3px solid #007bff !important;
        outline-offset: 2px !important;
      }

      .keyboard-navigation button:focus,
      .keyboard-navigation a:focus,
      .keyboard-navigation input:focus,
      .keyboard-navigation select:focus,
      .keyboard-navigation textarea:focus {
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3) !important;
      }

      /* High contrast mode styles */
      .high-contrast {
        --bg-primary: #000000;
        --text-primary: #ffffff;
        --border-color: #ffffff;
        --focus-color: #ffff00;
      }

      .high-contrast * {
        border-color: var(--border-color) !important;
      }

      .high-contrast *:focus {
        outline: 3px solid var(--focus-color) !important;
        outline-offset: 2px !important;
      }

      /* Skip links */
      .skip-links {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10000;
      }

      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: #000;
        color: #fff;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 0 0 4px 0;
        font-weight: bold;
        z-index: 100;
      }

      .skip-link:focus {
        top: 0;
        outline: 3px solid #ffff00;
      }

      /* Screen reader only class */
      .sr-only {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize accessibility manager
let accessibilityManager = null;

function initAccessibility() {
  if (accessibilityManager) {
    return accessibilityManager;
  }

  accessibilityManager = new AccessibilityManager();
  accessibilityManager.init();
  accessibilityManager.addFocusStyles();

  // Add global keyboard shortcuts
  accessibilityManager.addShortcut('?', () => {
    accessibilityManager.showShortcutsHelp();
  }, 'Show keyboard shortcuts');

  accessibilityManager.addShortcut('Alt+C', () => {
    accessibilityManager.toggleHighContrast();
  }, 'Toggle high contrast mode');

  // Expose to window for renderer usage
  window.accessibilityManager = accessibilityManager;

  return accessibilityManager;
}

// Auto-initialize after DOM load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
  } else {
    // Only auto-init if not in test environment
    if (typeof process === 'undefined' || !process.env.JEST_WORKER_ID) {
      initAccessibility();
    }
  }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccessibilityManager, initAccessibility };
}
