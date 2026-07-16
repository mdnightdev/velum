const fs = require('fs');
let code = fs.readFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', 'utf8');

const target = `            {(activeView === 'account' || (!isMobile && activeView === 'menu')) && (`;

if (code.includes(target)) {
  console.log("Target found");
} else {
  console.log("Target not found");
}
