import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OTA_DIR = path.join(ROOT_DIR, 'public', 'ota');
const MANIFEST_PATH = path.join(OTA_DIR, 'manifest.json');
const ZIP_PATH = path.join(OTA_DIR, 'bundle.zip');

async function packageOta() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('[OTA] dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  if (!fs.existsSync(OTA_DIR)) {
    fs.mkdirSync(OTA_DIR, { recursive: true });
  }

  // 1. Calculate overall content hash of dist/
  const hash = crypto.createHash('sha256');
  function hashDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        hashDirectory(fullPath);
      } else {
        const fileContent = fs.readFileSync(fullPath);
        hash.update(entry.name);
        hash.update(fileContent);
      }
    }
  }
  hashDirectory(DIST_DIR);
  const bundleHash = hash.digest('hex');
  const buildTime = new Date().toISOString();

  // 2. Create bundle.zip using zip CLI or python fallback
  try {
    if (fs.existsSync(ZIP_PATH)) {
      fs.unlinkSync(ZIP_PATH);
    }
    execSync(`cd "${DIST_DIR}" && zip -r -q "${ZIP_PATH}" .`, { stdio: 'pipe' });
  } catch (err) {
    // Fallback using python zip
    execSync(`python3 -c "import shutil; shutil.make_archive('${path.join(OTA_DIR, 'bundle')}', 'zip', '${DIST_DIR}')"`, { stdio: 'pipe' });
  }

  // 3. Write manifest.json
  const manifest = {
    version: '2.2.0',
    buildTime,
    bundleHash,
    bundleUrl: '/v2/ota/bundle.zip',
    sizeBytes: fs.existsSync(ZIP_PATH) ? fs.statSync(ZIP_PATH).size : 0
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`[OTA] Live update bundle created successfully:`);
  console.log(`      Build Time: ${buildTime}`);
  console.log(`      Bundle Hash: ${bundleHash.substring(0, 12)}...`);
  console.log(`      Output: ${ZIP_PATH}`);
}

packageOta().catch(console.error);
