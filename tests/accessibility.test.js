// tests/accessibility.test.js - WCAG 2.1 AA Compliance Tests

/**
 * @jest-environment jsdom
 */

const { AccessibilityManager } = require('../utils/accessibility.js');

describe('Accessibility Manager - WCAG 2.1 AA', () => {
  let manager;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    manager = new AccessibilityManager();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('creates ARIA live region', () => {
    manager.createScreenReaderAnnouncer();
    
    const announcer = document.getElementById('screen-reader-announcer');
    expect(announcer).not.toBeNull();
    expect(announcer.getAttribute('role')).toBe('status');
    expect(announcer.getAttribute('aria-live')).toBe('polite');
  });

  test('manages focus trap stack', () => {
    const modal = document.createElement('div');
    document.body.appendChild(modal);
    
    manager.trapFocus(modal);
    expect(manager.focusTrapStack).toContain(modal);
    
    manager.releaseFocus(modal);
    expect(manager.focusTrapStack).not.toContain(modal);
  });

  test('adds skip links', () => {
    manager.addSkipLinks();
    
    const mainLink = document.querySelector('a[href="#main-content"]');
    expect(mainLink).not.toBeNull();
  });

  test('enhances forms with ARIA labels', () => {
    const input = document.createElement('input');
    input.placeholder = 'Test';
    document.body.appendChild(input);
    
    manager.enhanceFormAccessibility();
    
    expect(input.getAttribute('aria-label')).toBe('Test');
  });

  test('enables high contrast mode', () => {
    manager.enableHighContrast();
    
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    expect(manager.highContrastMode).toBe(true);
  });

  test('registers keyboard shortcuts', () => {
    const handler = jest.fn();
    manager.addShortcut('Ctrl+S', handler, 'Save');
    
    expect(manager.keyboardShortcuts.has('Ctrl+S')).toBe(true);
  });

  test('adds focus styles', () => {
    manager.addFocusStyles();
    
    const styles = Array.from(document.querySelectorAll('style'));
    const hasStyles = styles.some(s => s.textContent.includes('keyboard-navigation'));
    
    expect(hasStyles).toBe(true);
  });
});
