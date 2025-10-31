const ipc = require('../utils/ipc');
const ipcConsts = require('../utils/ipc-constants');

test('utils/ipc exports same IPC_CHANNELS as utils/ipc-constants', () => {
  expect(ipc.IPC_CHANNELS).toEqual(ipcConsts.IPC_CHANNELS);
});
