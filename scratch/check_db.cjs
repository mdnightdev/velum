const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server', 'velum_state_v3.bin');
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  console.log(content.includes('bank_central_reserve'));
} else {
  console.log("No file", file);
}
