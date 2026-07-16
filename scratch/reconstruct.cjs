const fs = require('fs');

const logPath = '/root/.gemini/antigravity-cli/brain/58facad7-d986-45a3-a6b6-0ac59e44cad6/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

const wsViews = [];
const dashViews = [];

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const step = JSON.parse(line);
    if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
      const content = step.content;
      if (content.includes('File Path: `file:///root/velum/src/components/SidebarTabs/LoungeWorkspace.tsx`')) {
        const startMatch = content.match(/Showing lines (\d+) to (\d+)/);
        if (startMatch) {
          wsViews.push({
            start: parseInt(startMatch[1], 10),
            end: parseInt(startMatch[2], 10),
            content: content
          });
        }
      }
      if (content.includes('File Path: `file:///root/velum/src/components/SidebarTabs/LoungeMainDashboard.tsx`')) {
        const startMatch = content.match(/Showing lines (\d+) to (\d+)/);
        if (startMatch) {
          dashViews.push({
            start: parseInt(startMatch[1], 10),
            end: parseInt(startMatch[2], 10),
            content: content
          });
        }
      }
    }
  } catch (e) {}
}

console.log('LoungeWorkspace views collected:', wsViews.map(v => `${v.start}-${v.end}`));
console.log('LoungeMainDashboard views collected:', dashViews.map(v => `${v.start}-${v.end}`));
