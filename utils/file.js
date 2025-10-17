// utils/file.js
const fs = require('fs').promises;

async function handleFileRead(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

async function handleFileWrite(filePath, content) {
  await fs.writeFile(filePath, content, 'utf-8');
}

module.exports = { handleFileRead, handleFileWrite };