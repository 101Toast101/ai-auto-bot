// ========================================
// utils/ipc.js
// Complete IPC Channel Constants
// ========================================

/**
 * All IPC channels used in the application.
 * These must match between main.js, preload.js, and renderer.js
 */
const IPC_CHANNELS = {
  // File operations
  READ_FILE: 'READ_FILE',
  WRITE_FILE: 'WRITE_FILE',
  
  // Encryption operations
  ENCRYPT_DATA: 'ENCRYPT_DATA',
  DECRYPT_DATA: 'DECRYPT_DATA',
  
  // Scheduler operations
  START_SCHEDULER: 'START_SCHEDULER'
};

/**
 * Validates if a channel name is valid
 * @param {string} channel - Channel name to validate
 * @returns {boolean} - True if valid
 */
function isValidChannel(channel) {
  return Object.values(IPC_CHANNELS).includes(channel);
}

module.exports = {
  IPC_CHANNELS,
  isValidChannel
};






