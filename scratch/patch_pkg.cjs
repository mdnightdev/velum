const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.scripts && pkg.scripts.dev) {
  pkg.scripts.dev = 'tsx watch server/index.ts';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
}
