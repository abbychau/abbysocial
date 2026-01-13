'use strict';

// Not used by the basic-auth setup directly (it uses a plaintext ADMIN_PASS),
// but handy if you later switch to hashed auth.

const crypto = require('crypto');

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: npm run hash -- "your password"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
console.log(hash);
