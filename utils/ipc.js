// utils/ipc.js - re-export shared IPC constants
const { IPC_CHANNELS } = require("./ipc-constants");

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
  isValidChannel,
};

