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

    const deletedAgain = tokenStore.deleteToken(platform);
    expect(deletedAgain).toBe(false);
  });

  test('multi-account: saveToken with accountInfo creates accounts array', () => {
    const platform = 'instagram';
    const accountInfo = {
      accountId: 'acc-123',
      accountName: 'My Business',
      username: '@mybusiness',
    };

    tokenStore.saveToken(platform, 'access-multi-1', 3600, 'refresh-multi-1', accountInfo);

    const allAccounts = tokenStore.loadAllAccounts(platform);
    expect(allAccounts).toHaveLength(1);
    expect(allAccounts[0].accountId).toBe('acc-123');
    expect(allAccounts[0].accountName).toBe('My Business');
    expect(allAccounts[0].username).toBe('@mybusiness');
    expect(allAccounts[0].isDefault).toBe(true);
  });

  test('multi-account: add multiple accounts to same platform', () => {
    const platform = 'tiktok';

    const account1 = {
      accountId: 'acc-1',
      accountName: 'Account 1',
      username: '@account1',
    };
    tokenStore.saveToken(platform, 'token-1', 7200, 'refresh-1', account1);

    const account2 = {
      accountId: 'acc-2',
      accountName: 'Account 2',
      username: '@account2',
    };
    tokenStore.saveToken(platform, 'token-2', 7200, 'refresh-2', account2);

    const allAccounts = tokenStore.loadAllAccounts(platform);
    expect(allAccounts).toHaveLength(2);
    expect(allAccounts[0].accountId).toBe('acc-1');
    expect(allAccounts[1].accountId).toBe('acc-2');
  });

  test('multi-account: loadToken returns default account when no accountId specified', () => {
    const platform = 'youtube';

    tokenStore.saveToken(platform, 'token-1', 3600, 'refresh-1', {
      accountId: 'yt-1',
      accountName: 'Channel 1',
      username: 'channel1',
      isDefault: true,
    });

    tokenStore.saveToken(platform, 'token-2', 3600, 'refresh-2', {
      accountId: 'yt-2',
      accountName: 'Channel 2',
      username: 'channel2',
      isDefault: false,
    });

    const defaultAccount = tokenStore.loadToken(platform);
    expect(defaultAccount.accountId).toBe('yt-1');
    expect(defaultAccount.accountName).toBe('Channel 1');
  });

  test('multi-account: loadToken with accountId returns specific account', () => {
    const platform = 'twitter';

    tokenStore.saveToken(platform, 'token-1', 7200, 'refresh-1', {
      accountId: 'tw-1',
      accountName: 'Personal',
      username: '@personal',
    });

    tokenStore.saveToken(platform, 'token-2', 7200, 'refresh-2', {
      accountId: 'tw-2',
      accountName: 'Business',
      username: '@business',
    });

    const specificAccount = tokenStore.loadToken(platform, 'tw-2');
    expect(specificAccount.accountId).toBe('tw-2');
    expect(specificAccount.accountName).toBe('Business');
    expect(specificAccount.username).toBe('@business');
  });

  test('multi-account: deleteToken with accountId removes only that account', () => {
    const platform = 'instagram';

    tokenStore.saveToken(platform, 'token-1', 3600, null, {
      accountId: 'ig-1',
      accountName: 'Account 1',
      username: '@acc1',
    });

    tokenStore.saveToken(platform, 'token-2', 3600, null, {
      accountId: 'ig-2',
      accountName: 'Account 2',
      username: '@acc2',
    });

    expect(tokenStore.loadAllAccounts(platform)).toHaveLength(2);

    const deleted = tokenStore.deleteToken(platform, 'ig-1');
    expect(deleted).toBe(true);

    const remaining = tokenStore.loadAllAccounts(platform);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].accountId).toBe('ig-2');
  });

  test('multi-account: setDefaultAccount changes default', () => {
    const platform = 'tiktok';

    tokenStore.saveToken(platform, 'token-1', 3600, null, {
      accountId: 'tt-1',
      accountName: 'Account 1',
      username: '@acc1',
      isDefault: true,
    });

    tokenStore.saveToken(platform, 'token-2', 3600, null, {
      accountId: 'tt-2',
      accountName: 'Account 2',
      username: '@acc2',
      isDefault: false,
    });

    const success = tokenStore.setDefaultAccount(platform, 'tt-2');
    expect(success).toBe(true);

    const defaultAccount = tokenStore.loadToken(platform);
    expect(defaultAccount.accountId).toBe('tt-2');
  });

  test('multi-account: migrate legacy format to multi-account', () => {
    const platform = 'legacy-platform';

    // Save in legacy format (no accountInfo)
    tokenStore.saveToken(platform, 'legacy-token', 3600, 'legacy-refresh');

    // Now save with accountInfo (should trigger migration)
    tokenStore.saveToken(platform, 'new-token', 7200, 'new-refresh', {
      accountId: 'new-acc',
      accountName: 'New Account',
      username: '@new',
    });

    const allAccounts = tokenStore.loadAllAccounts(platform);
    expect(allAccounts.length).toBeGreaterThanOrEqual(1);

    // Should have at least the new account
    const newAccount = allAccounts.find(acc => acc.accountId === 'new-acc');
    expect(newAccount).toBeDefined();
    expect(newAccount.accountName).toBe('New Account');
  });

  test('multi-account: deleteToken without accountId removes all accounts', () => {
    const platform = 'youtube';

    tokenStore.saveToken(platform, 'token-1', 3600, null, {
      accountId: 'yt-1',
      accountName: 'Channel 1',
      username: 'channel1',
    });

    tokenStore.saveToken(platform, 'token-2', 3600, null, {
      accountId: 'yt-2',
      accountName: 'Channel 2',
      username: 'channel2',
    });

    expect(tokenStore.loadAllAccounts(platform)).toHaveLength(2);

    const deleted = tokenStore.deleteToken(platform);
    expect(deleted).toBe(true);

    expect(tokenStore.loadAllAccounts(platform)).toHaveLength(0);
    expect(tokenStore.loadToken(platform)).toBeNull();
  });

  test('multi-account: loadAllAccounts returns empty array when no tokens', () => {
    const platform = 'nonexistent';
    const accounts = tokenStore.loadAllAccounts(platform);
    expect(accounts).toEqual([]);
  });

  test('multi-account: setDefaultAccount returns false when platform not found', () => {
    const success = tokenStore.setDefaultAccount('nonexistent', 'some-id');
    expect(success).toBe(false);
  });

  test('multi-account: deleting last account removes platform entirely', () => {
    const platform = 'single-account-platform';

    tokenStore.saveToken(platform, 'token', 3600, null, {
      accountId: 'only-acc',
      accountName: 'Only Account',
      username: '@only',
    });

    expect(tokenStore.loadToken(platform)).not.toBeNull();

    const deleted = tokenStore.deleteToken(platform, 'only-acc');
    expect(deleted).toBe(true);

    expect(tokenStore.loadToken(platform)).toBeNull();
    expect(tokenStore.loadAllAccounts(platform)).toHaveLength(0);
  });

  test('multi-account: update existing account replaces data', () => {
    const platform = 'twitter';

    tokenStore.saveToken(platform, 'old-token', 3600, 'old-refresh', {
      accountId: 'tw-update',
      accountName: 'Old Name',
      username: '@old',
    });

    tokenStore.saveToken(platform, 'new-token', 7200, 'new-refresh', {
      accountId: 'tw-update',
      accountName: 'Updated Name',
      username: '@updated',
    });

    const account = tokenStore.loadToken(platform, 'tw-update');
    expect(account.token).toBe('new-token');
    expect(account.accountName).toBe('Updated Name');
    expect(account.username).toBe('@updated');

    // Should still have only 1 account (updated, not duplicated)
    expect(tokenStore.loadAllAccounts(platform)).toHaveLength(1);
  });
});

