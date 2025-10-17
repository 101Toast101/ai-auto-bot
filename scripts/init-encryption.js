const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex');
const envPath = path.join(process.cwd(), '.env');

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8');
}

if (content.includes('ENCRYPTION_KEY')) {
  console.log('.env already contains ENCRYPTION_KEY. No changes made.');
  process.exit(0);
}

content += `\nENCRYPTION_KEY=${key}\n`;
fs.writeFileSync(envPath, content, { encoding: 'utf8', flag: 'w' });
console.log('Generated ENCRYPTION_KEY and wrote to .env (keep this secret).');
