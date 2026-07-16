const fs = require('fs');
let code = fs.readFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', 'utf8');

const startMarker = `            {activeView === 'privacy' && (`;
const endMarker = `            {activeView === 'appearance' && (`;

const startIdx = code.indexOf(startMarker);
if (startIdx !== -1) {
  const endIdx = code.indexOf(endMarker, startIdx);
  if (endIdx !== -1) {
    const rawContent = code.substring(startIdx, endIdx);
    fs.writeFileSync('src/views/UserWorkspace/SettingsTabs/privacy_raw.tsx', rawContent);
    console.log("Extracted privacy raw content.");
  }
}
