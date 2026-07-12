const fs = require('fs');
const path = require('path');

const replaceInFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // We want to be careful with case
  content = content.replace(/communities/g, 'lounges');
  content = content.replace(/Communities/g, 'Lounges');
  content = content.replace(/community/g, 'lounge');
  content = content.replace(/Community/g, 'Lounge');
  content = content.replace(/COMMUNITY/g, 'LOUNGE');
  content = content.replace(/COMMUNITIES/g, 'LOUNGES');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
};

const files = [
  'src/views/UserWorkspace/UserSidebar.tsx',
  'src/components/DashboardLayout.tsx',
  'src/types/index.ts',
  'src/types.ts',
  'server/db.ts',
  'server/routes/communities.ts',
  'server/routes/auth.ts',
  'server/index.ts',
  'src/components/AdminPanel.tsx',
  'src/components/CliConsole.tsx'
];

files.forEach(replaceInFile);
