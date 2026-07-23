import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import pg from 'pg';
import dotenv from 'dotenv';
import { decryptData } from '../server/services/cryptoService.js';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[BACKUP] Error: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

async function downloadBackup() {
  console.log('[BACKUP] Connecting to Neon PostgreSQL...');
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT sqlite_base64, gzip, updated_at FROM velum_backups ORDER BY updated_at DESC LIMIT 1');
    const row = res.rows[0];

    if (!row) {
      console.log('[BACKUP] No backups found in Neon PostgreSQL.');
      await pool.end();
      return;
    }

    console.log(`[BACKUP] Found cloud backup dated: ${row.updated_at}`);
    let binData = Buffer.from(row.sqlite_base64, 'base64');

    if (row.gzip) {
      binData = zlib.gunzipSync(binData);
      console.log('[BACKUP] Decompressed backup payload.');
    }

    // Try to decrypt data to verify its integrity
    try {
      const decrypted = decryptData(binData.toString('utf8'));
      if (!decrypted) throw new Error('Decrypted string is empty.');
      
      const parsed = JSON.parse(decrypted);
      const filename = `velum_backup_${new Date(row.updated_at).toISOString().split('T')[0]}_${Date.now()}.json`;
      const filepath = path.join(process.cwd(), filename);
      
      fs.writeFileSync(filepath, JSON.stringify(parsed, null, 2), 'utf8');
      console.log(`[SUCCESS] Backup successfully downloaded, decrypted, and saved as a local JSON file:`);
      console.log(`          -> ${filepath}`);
      console.log(`          (Size: ${Math.round(fs.statSync(filepath).size / 1024)} KB)`);
    } catch (decErr: any) {
      console.error('[ERROR] Integrity check failed. Could not decrypt database payload:');
      console.error(`        ${decErr.message || decErr}`);
      console.error('        Ensure your local .env DB_ENCRYPTION_KEY matches the production key.');
    }
  } catch (err: any) {
    console.error('[ERROR] Failed to download backup:', err.message || err);
  } finally {
    await pool.end();
  }
}

downloadBackup();
