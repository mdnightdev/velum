import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import pg from 'pg';
import dotenv from 'dotenv';
// Load environment variables before importing crypto service
dotenv.config();

const { encryptData } = await import('../server/services/cryptoService.js');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[RESTORE] Error: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('[RESTORE] Usage: npx tsx scripts/upload_backup.ts <path-to-local-backup-json>');
  process.exit(1);
}

const backupFilePath = path.resolve(args[0]);

if (!fs.existsSync(backupFilePath)) {
  console.error(`[RESTORE] Error: Backup file not found at ${backupFilePath}`);
  process.exit(1);
}

async function uploadBackup() {
  console.log(`[RESTORE] Reading local backup: ${backupFilePath}`);
  try {
    const rawContent = fs.readFileSync(backupFilePath, 'utf8');
    
    // Validate JSON structure
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      console.error('[RESTORE] Error: File is not a valid JSON document.');
      return;
    }

    if (!parsed.users || !parsed.lounges) {
      console.warn('[RESTORE] Warning: JSON doesn\'t look like a standard Velum database state.');
    }

    console.log('[RESTORE] Encrypting database state...');
    const encrypted = encryptData(JSON.stringify(parsed));
    if (!encrypted) {
      console.error('[RESTORE] Encryption failed: empty payload returned.');
      return;
    }

    const binary = Buffer.from(encrypted, 'utf8');
    console.log('[RESTORE] Compressing payload with gzip...');
    const compressed = zlib.gzipSync(binary);
    const base64 = compressed.toString('base64');

    console.log('[RESTORE] Uploading backup to Neon PostgreSQL...');
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const id = `backup_manual_${Date.now()}`;
    await pool.query(
      'INSERT INTO velum_backups (id, sqlite_base64, gzip, updated_at) VALUES ($1, $2, $3, NOW())',
      [id, base64, true]
    );

    console.log(`[SUCCESS] Backup successfully uploaded to Neon PostgreSQL cloud!`);
    console.log(`          Backup ID: ${id}`);
    console.log(`          Original Size: ${Math.round(rawContent.length / 1024)} KB`);
    console.log(`          Uploaded Size: ${Math.round(compressed.length / 1024)} KB`);
    
    await pool.end();
  } catch (err: any) {
    console.error('[ERROR] Failed to restore backup:', err.message || err);
  }
}

uploadBackup();
