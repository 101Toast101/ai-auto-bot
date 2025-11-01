const fs = require('fs');
const path = require('path');

function extractPreloadApiKeys(preloadSource) {
  // Find the object literal passed to contextBridge.exposeInMainWorld("api", { ... })
  // NOTE: We use a small brace-aware parser rather than a single regex because
  // property values inside the object may contain nested braces or call-sites
  // like `ipcRenderer.invoke(..., { ... })` which confuse simple regex-based
  // extraction. This parser finds the matching closing brace for the API
  // object and then extracts top-level keys. Keeping this comment will help
  // future maintainers understand why the test isn't a one-liner regex.
  const start = preloadSource.indexOf("exposeInMainWorld(\"api\",");
  if (start === -1) {
    return [];
  }
  // Locate the first '{' after the call start and then find the matching closing '}'
  const braceIdx = preloadSource.indexOf('{', start);
  if (braceIdx === -1) {
    return [];
  }
  let depth = 0;
  let endIdx = -1;
  for (let i = braceIdx; i < preloadSource.length; i++) {
    const ch = preloadSource[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    return [];
  }
  const body = preloadSource.slice(braceIdx + 1, endIdx);
  // Match top-level keys (identifier or string). Simpler: find all occurrences of 'key:' at top-level
  const keyRegex = /(^|[\n;\s,])([a-zA-Z0-9_$]+)\s*:/g;
  const keys = new Set();
  let kk;
  while ((kk = keyRegex.exec(body))) {
    keys.add(kk[2]);
  }
  return Array.from(keys);
}

function extractRendererApiUsage(rendererSource) {
  const regex = /window\.api(?:\s*\.|\s*\?\.)\s*([a-zA-Z0-9_$]+)/g;
  const keys = new Set();
  let m;
  while ((m = regex.exec(rendererSource))) {
    keys.add(m[1]);
  }
  return Array.from(keys);
}

test('renderer only uses methods exposed by preload', () => {
  const preloadPath = path.join(__dirname, '..', 'preload.js');
  const rendererPath = path.join(__dirname, '..', 'renderer.js');
  const preloadSrc = fs.readFileSync(preloadPath, 'utf8');
  const rendererSrc = fs.readFileSync(rendererPath, 'utf8');

  const preloadKeys = extractPreloadApiKeys(preloadSrc);
  const rendererKeys = extractRendererApiUsage(rendererSrc);

  // If we couldn't parse preload keys, fail with helpful message
  expect(preloadKeys.length).toBeGreaterThan(0);

  // Each renderer key must be present in preload keys
  const missing = rendererKeys.filter((k) => !preloadKeys.includes(k));
  expect(missing).toEqual([]);
});
