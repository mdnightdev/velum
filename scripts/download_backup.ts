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

const args = process.argv.slice(2);

async function run() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    if (args[0] === 'list') {
      console.log('[BACKUP] Fetching backup history from Neon PostgreSQL...');
      const res = await pool.query('SELECT id, gzip, updated_at, LENGTH(sqlite_base64) as raw_size FROM velum_backups ORDER BY updated_at DESC LIMIT 15');
      
      if (res.rows.length === 0) {
        console.log('[BACKUP] No backups found in the database.');
        await pool.end();
        return;
      }

      console.log('\n--- RECENT BACKUPS LIST ---');
      console.log('Index | Backup ID | Timestamp | Est. Compressed Size');
      console.log('----------------------------------------------------');
      res.rows.forEach((row, i) => {
        const estSize = Math.round((row.raw_size * 0.75) / 1024); // Base64 to binary estimation
        console.log(`[${i}] | ${row.id} | ${row.updated_at.toISOString()} | ~${estSize} KB`);
      });
      console.log('\nTo download a specific backup, run:');
      console.log('npx tsx scripts/download_backup.ts <backup-id>\n');
      await pool.end();
      return;
    }

    const specificId = args[0];
    let query = 'SELECT sqlite_base64, gzip, updated_at, id FROM velum_backups ORDER BY updated_at DESC LIMIT 1';
    let queryParams: any[] = [];

    if (specificId) {
      console.log(`[BACKUP] Querying specific backup ID: ${specificId}...`);
      query = 'SELECT sqlite_base64, gzip, updated_at, id FROM velum_backups WHERE id = $1';
      queryParams = [specificId];
    } else {
      console.log('[BACKUP] Querying the latest persistent backup...');
    }

    const res = await pool.query(query, queryParams);
    const row = res.rows[0];

    if (!row) {
      console.error('[ERROR] No matching backup found.');
      await pool.end();
      return;
    }

    console.log(`[BACKUP] Found backup: ${row.id} (Dated: ${row.updated_at})`);
    let binData = Buffer.from(row.sqlite_base64, 'base64');

    if (row.gzip) {
      binData = zlib.gunzipSync(binData);
      console.log('[BACKUP] Decompressed backup payload.');
    }

    try {
      const decrypted = decryptData(binData.toString('utf8'));
      if (!decrypted) throw new Error('Decrypted string is empty.');
      
      const parsed = JSON.parse(decrypted);
      const filename = `velum_backup_${row.id}.json`;
      const filepath = path.join(process.cwd(), filename);
      
      fs.writeFileSync(filepath, JSON.stringify(parsed, null, 2), 'utf8');
      console.log(`[SUCCESS] Backup successfully downloaded and saved as local JSON:`);
      console.log(`          -> ${filepath}`);
    } catch (decErr: any) {
      console.error('[ERROR] Integrity check failed. Could not decrypt database payload:');
      console.error(`        ${decErr.message || decErr}`);
      console.error('        Ensure your local .env DB_ENCRYPTION_KEY matches the key used for this backup.');
    }
  } catch (err: any) {
    console.error('[ERROR] Action failed:', err.message || err);
  } finally {
    await pool.end();
  }
}

run();
