const fs = require('fs');
const path = require('path');

const logPath = '/root/.gemini/antigravity-cli/brain/58facad7-d986-45a3-a6b6-0ac59e44cad6/.system_generated/logs/transcript_full.jsonl';
if (!fs.existsSync(logPath)) {
  console.error('Log file does not exist');
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log('Total transcript lines:', lines.length);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const step = JSON.parse(line);
    if (step.tool_calls) {
      for (const call of step.tool_calls) {
        if (call.name === 'view_file') {
          const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
          const file = args.AbsolutePath || args.path;
          if (file && file.includes('LoungeWorkspace.tsx')) {
            console.log(`Step ${step.step_index}: Call to view LoungeWorkspace.tsx range ${args.StartLine}-${args.EndLine}`);
          }
          if (file && file.includes('LoungeMainDashboard.tsx')) {
            console.log(`Step ${step.step_index}: Call to view LoungeMainDashboard.tsx range ${args.StartLine}-${args.EndLine}`);
          }
        }
      }
    }
  } catch (e) {
  }
}
