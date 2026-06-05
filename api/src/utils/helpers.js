const crypto = require('crypto');

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(crypto.randomInt(1, 99999)).padStart(5, '0');
  return `LRZ-${y}${m}${d}-${seq}`;
}

module.exports = { generateOrderNumber };
