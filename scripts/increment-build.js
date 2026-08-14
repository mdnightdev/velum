import fs from 'fs';
import path from 'path';

const versionFilePath = path.join(process.cwd(), 'src', 'version.ts');
const publicVersionPath = path.join(process.cwd(), 'public', 'version.json');

try {
  let appVersion = '1.0.0';
  let buildNum = 1;

  if (fs.existsSync(versionFilePath)) {
    const content = fs.readFileSync(versionFilePath, 'utf8');
    const versionMatch = content.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    const buildMatch = content.match(/BUILD_NUMBER\s*=\s*['"]b?(\d+)['"]/);

    if (versionMatch) appVersion = versionMatch[1];
    if (buildMatch) buildNum = parseInt(buildMatch[1], 10) + 1;
  }

  const newBuildStr = `b${buildNum}`;
  const newContent = `export const APP_VERSION = '${appVersion}';\nexport const BUILD_NUMBER = '${newBuildStr}';\nexport const FULL_BUILD_VERSION = \`v\${APP_VERSION}.\${BUILD_NUMBER}\`;\n`;

  fs.writeFileSync(versionFilePath, newContent, 'utf8');

  // Also write public/version.json
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(
    publicVersionPath,
    JSON.stringify(
      {
        version: appVersion,
        build: newBuildStr,
        fullVersion: `v${appVersion}.${newBuildStr}`,
        timestamp: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`[Version] Incremented build number to v${appVersion}.${newBuildStr}`);
} catch (err) {
  console.error('[Version] Failed to increment build number:', err);
}
