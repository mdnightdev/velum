const fs = require('fs');

const src = fs.readFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', 'utf8');

function extractBlock(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return null;
  let end = src.indexOf(endMarker, start + startMarker.length);
  if (end === -1) end = src.length;
  return src.substring(start, end);
}

// Just checking if we can do this.
console.log("Ready");
