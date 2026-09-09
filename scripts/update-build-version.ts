import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const VERSION_FILE = path.join(ROOT_DIR, 'src', 'version.ts');

let commitCount = 151;
try {
  const stdout = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const parsed = parseInt(stdout, 10);
  if (!isNaN(parsed) && parsed > 0) {
    commitCount = parsed;
  }
} catch {}

const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || '0', 10);
const buildCode = 2000 + commitCount + runNumber;
const appVersion = process.env.APP_VERSION || '2.2.0';
const buildNumber = `b${buildCode}`;
const fullVersion = `v${appVersion}-${buildNumber}`;

const fileContent = `export const APP_VERSION = '${appVersion}';
export const BUILD_NUMBER = '${buildNumber}';
export const FULL_BUILD_VERSION = \`v\${APP_VERSION}-\${BUILD_NUMBER}\`;
`;

fs.writeFileSync(VERSION_FILE, fileContent, 'utf8');
console.log(`[Build Version] Updated ${VERSION_FILE} to ${fullVersion} (code ${buildCode})`);
