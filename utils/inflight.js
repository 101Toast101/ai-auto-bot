// utils/inflight.js
// Small in-memory inflight tracker exported for other modules.

const inflight = new Map();

function add(key, info) {
  inflight.set(String(key), { info: info || {}, ts: new Date().toISOString() });
}

function remove(key) {
  inflight.delete(String(key));
}

function has(key) {
  return inflight.has(String(key));
}

function list() {
  const out = [];
  for (const [k, v] of inflight.entries()) out.push({ key: k, ...v });
  return out;
}

module.exports = {
  add,
  remove,
  has,
  list
};