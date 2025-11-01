#!/usr/bin/env node
const { execSync } = require('child_process');

// Cross-platform way to get staged diff
function getStagedDiff() {
  try {
    return execSync('git diff --cached -U0', { encoding: 'utf8' });
  } catch {
    console.error('Failed to run git diff --cached -U0. Make sure git is available.');
    process.exit(2);
  }
}

const diff = getStagedDiff();

// simple regexes to catch keys, tokens, private keys, long base64-like strings
const patterns = [
  /password\s*[:=]\s*['"][^'"]{4,}/i,
  /(api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"][0-9a-zA-Z\-_.]{8,}['"]/i,
  /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /aws(.{0,20})?(secret|access).{0,20}([A-Za-z0-9/+=]{40})/i,
  /[A-Za-z0-9+/]{40,}={0,2}/
];

const matches = [];
for (const p of patterns) {
  const m = diff.match(p);
  if (m) {
    matches.push({ pattern: p.toString(), match: m[0] });
  }
}

if (matches.length > 0) {
  console.error('Possible secrets detected in staged changes:');
  matches.forEach((x) => console.error('-', x.pattern, ':', x.match));
  console.error('\nIf these are false positives, please remove them from staged changes or adjust patterns.');
  process.exit(1);
}

// Also block committing .env or data/ files unless explicitly allowed
let stagedFiles = [];
try {
  stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
} catch {
  console.error('Failed to list staged files');
  process.exit(2);
}

for (const f of stagedFiles) {
  // Block .env and data files, but allow .example files and README.md
  if (/^\.env$/.test(f)) {
    console.error('Blocking commit: attempting to commit', f);
    console.error('Please keep .env out of git. Use .env.example instead.');
    process.exit(1);
  }
  if (/^data\//.test(f) && !f.endsWith('.example') && !f.endsWith('README.md')) {
    console.error('Blocking commit: attempting to commit', f);
    console.error('Please keep runtime data out of git. Only .example files and README.md are allowed in data/.');
    process.exit(1);
  }
}

console.error('No obvious secrets found in staged changes.');
process.exit(0);
