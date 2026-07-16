const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const DB_FILE = path.join(process.cwd(), 'velum_state_v3.bin');
if (fs.existsSync(DB_FILE)) {
  const content = fs.readFileSync(DB_FILE, 'utf8');
  // it might be encrypted, let's see how DB is loaded in persistence.ts
} else {
  console.log("No DB");
}
