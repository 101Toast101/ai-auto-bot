const fs = require('fs');
const path = require('path');

const tokenStorePath = path.resolve(__dirname, '..', 'tokenStore.cjs');
const tokenStore = require(tokenStorePath);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const KEY_FILE = path.join(DATA_DIR, '.encryption_key');

function backupIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    const bak = filePath + '.bak_test';
    fs.copyFileSync(filePath, bak);
    return bak;
  }
  return null;
}

function restoreBackup(bakPath) {
  if (!bakPath) {return;}
  const orig = bakPath.replace(/\.bak_test$/, '');
  fs.copyFileSync(bakPath, orig);
  fs.unlinkSync(bakPath);
}

describe('tokenStore (integration)', () => {
  let tokensBak = null;
  let keyBak = null;

  beforeEach(() => {
    // Backup any existing data files to avoid clobbering real dev state
    if (!fs.existsSync(DATA_DIR)) {fs.mkdirSync(DATA_DIR, { recursive: true });}
    tokensBak = backupIfExists(TOKENS_FILE);
    keyBak = backupIfExists(KEY_FILE);
    // Ensure a clean tokens file
    if (fs.existsSync(TOKENS_FILE)) {fs.unlinkSync(TOKENS_FILE);}
    if (fs.existsSync(KEY_FILE)) {fs.unlinkSync(KEY_FILE);}
  });

  afterEach(() => {
    // Remove files created by tests
    try {
      if (fs.existsSync(TOKENS_FILE)) {fs.unlinkSync(TOKENS_FILE);}
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(KEY_FILE)) {fs.unlinkSync(KEY_FILE);}
    } catch {
      // ignore
    }
    // Restore backups
    restoreBackup(tokensBak);
    restoreBackup(keyBak);
  });

  test('saveToken and loadToken roundtrip', () => {
    const platform = 'unittest-platform';
    tokenStore.saveToken(platform, 'access-xyz', 60, 'refresh-abc');

    const loaded = tokenStore.loadToken(platform);
    expect(loaded).not.toBeNull();
    expect(loaded.token).toBe('access-xyz');
    expect(loaded.refreshToken).toBe('refresh-abc');
    expect(loaded.expiresAt).toBeGreaterThan(Date.now());
  });

  test('deleteToken removes and returns appropriate booleans', () => {
    const platform = 'unittest-delete';
    tokenStore.saveToken(platform, 'todel', null, null);
    const existsBefore = tokenStore.loadToken(platform);
    expect(existsBefore).not.toBeNull();

    const deleted = tokenStore.deleteToken(platform);
    expect(deleted).toBe(true);

    const after = tokenStore.loadToken(platform);
    expect(after).toBeNull();

    // deleting again returns false
    const deletedAgain = tokenStore.deleteToken(platform);
    expect(deletedAgain).toBe(false);
  });
});
