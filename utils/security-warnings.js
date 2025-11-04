// utils/security-warnings.js
// Security awareness and anti-phishing utilities

/**
 * Show security tips dialog on first run
 * Educates users about phishing, keyloggers, and safe practices
 */
function showSecurityTipsDialog() {
  const hasSeenTips = localStorage.getItem('hasSeenSecurityTips');

  if (hasSeenTips) {
    return; // Don't show again
  }

  const dialog = document.createElement('div');
  dialog.className = 'security-dialog-overlay';
  dialog.innerHTML = `
    <div class="security-dialog">
      <div class="security-dialog-header">
        <span style="font-size: 2rem;">🛡️</span>
        <h2>Security Tips - Please Read</h2>
      </div>

      <div class="security-dialog-content">
        <div class="security-tip">
          <h3>🔐 Protect Your API Keys</h3>
          <ul>
            <li>Never share your API keys with anyone</li>
            <li>Use official provider websites to generate keys</li>
            <li>Clear clipboard after pasting keys (we'll help with this)</li>
          </ul>
        </div>

        <div class="security-tip">
          <h3>🎣 Beware of Phishing</h3>
          <ul>
            <li>Always verify the URL when logging in to social platforms</li>
            <li>Official domains: instagram.com, tiktok.com, youtube.com, twitter.com</li>
            <li>We'll show you the URL before opening OAuth windows</li>
          </ul>
        </div>

        <div class="security-tip">
          <h3>🦠 Malware Protection</h3>
          <ul>
            <li>Keep your antivirus software up to date</li>
            <li>Only download this app from official sources (GitHub)</li>
            <li>Your credentials are encrypted locally - never sent to us</li>
          </ul>
        </div>

        <div class="security-tip">
          <h3>🔒 What This App Does</h3>
          <ul>
            <li>✅ Stores credentials encrypted on YOUR computer only</li>
            <li>✅ Calls official APIs directly (OpenAI, Instagram, etc.)</li>
            <li>❌ Never sends your data to our servers (we don't have any!)</li>
            <li>❌ No tracking, no telemetry, no analytics</li>
          </ul>
        </div>
      </div>

      <div class="security-dialog-footer">
        <label>
          <input type="checkbox" id="dontShowAgain">
          Don't show this again
        </label>
        <button id="securityDialogClose" class="btn-primary">I Understand</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Handle close button
  document.getElementById('securityDialogClose').addEventListener('click', () => {
    const dontShow = document.getElementById('dontShowAgain').checked;
    if (dontShow) {
      localStorage.setItem('hasSeenSecurityTips', 'true');
    }
    dialog.remove();
  });
}

/**
 * Mask API key input field after entry
 * Helps prevent screen capture and shoulder surfing
 */
function maskApiKeyInput(inputElement, showToggleButton = true) {
  if (!inputElement) {
    return;
  }

  // Create wrapper for input + toggle button
  const wrapper = document.createElement('div');
  wrapper.className = 'api-key-input-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  wrapper.style.width = '100%';

  // Insert wrapper
  inputElement.parentNode.insertBefore(wrapper, inputElement);
  wrapper.appendChild(inputElement);

  // Change input type to password (masked)
  inputElement.type = 'password';
  inputElement.setAttribute('data-masked', 'true');

  if (showToggleButton) {
    // Add show/hide toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'api-key-toggle-btn';
    toggleBtn.innerHTML = '👁️';
    toggleBtn.title = 'Show/Hide API Key';
    toggleBtn.style.position = 'absolute';
    toggleBtn.style.right = '10px';
    toggleBtn.style.top = '50%';
    toggleBtn.style.transform = 'translateY(-50%)';
    toggleBtn.style.border = 'none';
    toggleBtn.style.background = 'transparent';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.fontSize = '1.2rem';

    toggleBtn.addEventListener('click', () => {
      if (inputElement.type === 'password') {
        inputElement.type = 'text';
        toggleBtn.innerHTML = '🙈';
        toggleBtn.title = 'Hide API Key';
      } else {
        inputElement.type = 'password';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Show API Key';
      }
    });

    wrapper.appendChild(toggleBtn);
  }
}

/**
 * Clear clipboard after paste (anti-keylogger)
 * Prevents clipboard sniffing malware from reading sensitive data
 */
function clearClipboardAfterPaste(inputElement, delay = 2000) {
  if (!inputElement) {
    return;
  }

  inputElement.addEventListener('paste', () => {
    // Show notification that clipboard will be cleared
    setTimeout(() => {
      try {
        // Clear clipboard by copying empty string
        navigator.clipboard.writeText('').catch(() => {
          // Fallback: Some browsers don't allow this - silently ignore
        });

        // Show subtle notification
        const notification = document.createElement('div');
        notification.textContent = '🔒 Clipboard cleared for security';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.background = '#4CAF50';
        notification.style.color = 'white';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '10000';
        notification.style.fontSize = '14px';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.5s';
          setTimeout(() => notification.remove(), 500);
        }, 2000);
      } catch (err) {
        console.error('Failed to clear clipboard:', err);
      }
    }, delay);
  });
}

/**
 * Initialize all security features on page load
 */
function initSecurityFeatures() {
  // Show security tips on first run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => showSecurityTipsDialog(), 1000);
    });
  } else {
    setTimeout(() => showSecurityTipsDialog(), 1000);
  }

  // Auto-apply masking and clipboard protection to API key inputs
  const apiKeyInputs = [
    'openaiApiKey',
    'runwayApiKey',
    'lumaApiKey',
    'providerClientSecret'
  ];

  apiKeyInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      maskApiKeyInput(input, true);
      clearClipboardAfterPaste(input, 2000);
    }
  });

  // Add CSS for security dialog
  if (!document.getElementById('security-dialog-styles')) {
    const style = document.createElement('style');
    style.id = 'security-dialog-styles';
    style.textContent = `
      .security-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .security-dialog {
        background: #2a2a2a;
        border-radius: 10px;
        padding: 30px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
        animation: slideUp 0.3s;
      }

      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .security-dialog-header {
        text-align: center;
        margin-bottom: 20px;
        border-bottom: 2px solid #4CAF50;
        padding-bottom: 15px;
      }

      .security-dialog-header h2 {
        margin: 10px 0 0 0;
        color: #4CAF50;
      }

      .security-dialog-content {
        margin: 20px 0;
      }

      .security-tip {
        background: #1e1e1e;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        border-left: 4px solid #4CAF50;
      }

      .security-tip h3 {
        margin-top: 0;
        color: #fff;
        font-size: 1.1rem;
      }

      .security-tip ul {
        margin: 10px 0 0 20px;
        padding: 0;
        color: #ccc;
      }

      .security-tip li {
        margin: 5px 0;
        line-height: 1.5;
      }

      .security-dialog-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #444;
      }

      .security-dialog-footer label {
        color: #ccc;
        font-size: 0.9rem;
        cursor: pointer;
      }

      .security-dialog-footer input[type="checkbox"] {
        margin-right: 8px;
        cursor: pointer;
      }

      .api-key-input-wrapper {
        position: relative;
        display: inline-block;
        width: 100%;
      }

      .api-key-toggle-btn:hover {
        opacity: 0.7;
      }
    `;
    document.head.appendChild(style);
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showSecurityTipsDialog,
    maskApiKeyInput,
    clearClipboardAfterPaste,
    initSecurityFeatures
  };
}
