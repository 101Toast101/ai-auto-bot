// ========================================
// utils/database.js
// ========================================
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch { /* ignore */ }
}

async function readJson(relPath, fallback) {
  const p = path.join(DATA_DIR, relPath);
  try {
    await ensureDataDir();
    const raw = await fs.readFile(p, 'utf8');
    return { success: true, content: raw, parsed: JSON.parse(raw) };
  } catch (err) {
    return { success: false, error: err, parsed: fallback };
  }
}

async function writeJson(relPath, data) {
  const p = path.join(DATA_DIR, relPath);
  try {
    await ensureDataDir();
    const raw = JSON.stringify(data, null, 2);
    await fs.writeFile(p, raw, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

async function readSettings() {
  const r = await readJson('settings.json', {});
  return { success: r.success, data: r.parsed, error: r.error };
}

async function writeSettings(obj) {
  return writeJson('settings.json', obj);
}

async function readSavedConfigs() {
  const r = await readJson('savedConfigs.json', []);
  return { success: r.success, data: r.parsed, error: r.error };
}

async function writeSavedConfigs(arr) {
  return writeJson('savedConfigs.json', arr);
}

async function readScheduledPosts() {
  const r = await readJson('scheduledPosts.json', []);
  return { success: r.success, data: r.parsed, error: r.error };
}

async function writeScheduledPosts(arr) {
  return writeJson('scheduledPosts.json', arr);
}

async function readActivityLog() {
  const r = await readJson('activity_log.json', []);
  return { success: r.success, data: r.parsed, error: r.error };
}

async function appendActivityLog(entry) {
  const r = await readJson('activity_log.json', []);
  const arr = r.parsed || [];
  arr.unshift(entry);
  return writeJson('activity_log.json', arr);
}

module.exports = {
  readJson,
  writeJson,
  readSettings,
  writeSettings,
  readSavedConfigs,
  writeSavedConfigs,
  readScheduledPosts,
  writeScheduledPosts,
  readActivityLog,
  appendActivityLog
};
