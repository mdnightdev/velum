import fs from 'fs';
import zlib from 'zlib';
import { getPgPool } from '../config/database.js';
import { db, DB_FILE, SQLITE_FILE } from '../db/index.js';
import { encryptData } from '../utils/crypto.js';

export let isCloudBackupDisabled = true;
export let lastBackupAttemptTime = 0;
export let backupTimer: any = null;
export const BACKUP_COOLDOWN_MS = 60 * 1000;

export function setCloudBackupDisabled(val: boolean) {
  isCloudBackupDisabled = val;
}

export async function initPgBackupTable(): Promise<void> {
  if (isCloudBackupDisabled) return;
  const pool = getPgPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS velum_backups (
        id VARCHAR(255) PRIMARY KEY,
        sqlite_base64 TEXT NOT NULL,
        gzip BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[SYS-SECURE] Neon PostgreSQL backups table verified/created.');
  } catch (err: any) {
    const errStr = String(err?.message || err);
    console.warn(`[SYS-SECURE] Neon PostgreSQL connection/setup failed: ${errStr}. Disabling cloud backups for this session.`);
    isCloudBackupDisabled = true;
  }
}

export function getSafeDatabaseBackupBinary(): Buffer | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      return fs.readFileSync(DB_FILE);
    }
    const plainJson = JSON.stringify(db);
    const encryptedData = encryptData(plainJson);
    return Buffer.from(encryptedData, 'utf8');
  } catch (err) {
    console.error('[SYS-SECURE] Error reading state database for cloud backup:', err);
    return null;
  }
}

export async function restoreDbFromCloud(): Promise<void> {
  if (process.env.DISABLE_CLOUD_BACKUP === '1' || isCloudBackupDisabled) {
    console.log('[SYS-SECURE] Cloud persistence offline or disabled. Skipping cloud restore.');
    return;
  }
  console.log('[SYS-SECURE] Querying Neon PostgreSQL for latest persistent database backup...');
  try {
    await initPgBackupTable();
    if (isCloudBackupDisabled) return;

    const pool = getPgPool();
    const res = await pool.query('SELECT sqlite_base64, gzip FROM velum_backups ORDER BY updated_at DESC LIMIT 1');
    const row = res.rows[0];
    if (!row) {
      console.log('[SYS-SECURE] No previous cloud backup found in Neon PostgreSQL. Initializing zero-state system.');
      return;
    }

    let base64 = row.sqlite_base64;
    if (base64) {
      let binData = Buffer.from(base64, 'base64');
      if (row.gzip === true) {
        try {
          binData = zlib.gunzipSync(binData);
          console.log('[SYS-SECURE] Successfully decompressed Neon PostgreSQL database backup using gzip.');
        } catch (decompErr: any) {
          console.error('[SYS-SECURE] Failed to decompress gzip backup:', decompErr.message || decompErr);
        }
      }

      try {
        fs.writeFileSync(DB_FILE, binData);
        if (fs.existsSync(SQLITE_FILE)) {
          try {
            fs.unlinkSync(SQLITE_FILE);
            console.log('[SYS-SECURE] Stale local SQLite file invalidated to apply fresh cloud backup state.');
          } catch (unlinkErr) {
            console.error('[SYS-SECURE] Failed to unlink stale SQLite file during cloud restoration:', unlinkErr);
          }
        }
        console.log(`[SYS-SECURE] Database successfully restored from Neon PostgreSQL. Size: ${Math.round(binData.length / 1024)} KB.`);
      } catch (fileErr) {
        console.error('[SYS-SECURE] Failed during database restoration write step:', fileErr);
      }
    } else {
      console.log('[SYS-SECURE] Neon PostgreSQL backup found but empty. Initializing new storage.');
    }
  } catch (err: any) {
    const errStr = String(err?.message || err);
    console.warn(`[SYS-SECURE] Neon PostgreSQL restore failed: ${errStr}. Disabling cloud backups.`);
    isCloudBackupDisabled = true;
  }
}

export async function backupDbToCloud(): Promise<void> {
  if (isCloudBackupDisabled) return;
  if (backupTimer) return; // Already queued to backup

  const now = Date.now();
  const timeSinceLastBackup = now - lastBackupAttemptTime;

  if (timeSinceLastBackup < BACKUP_COOLDOWN_MS) {
    const delay = BACKUP_COOLDOWN_MS - timeSinceLastBackup;
    backupTimer = setTimeout(async () => {
      backupTimer = null;
      await executeCloudBackup();
    }, delay);
  } else {
    await executeCloudBackup();
  }
}

export async function executeCloudBackup(): Promise<void> {
  if (isCloudBackupDisabled || process.env.DISABLE_CLOUD_BACKUP === '1') return;
  lastBackupAttemptTime = Date.now();
  try {
    const binary = getSafeDatabaseBackupBinary();
    if (!binary) return;

    // Gzip compression to reduce payload sizes
    const compressedBinary = zlib.gzipSync(binary);
    const base64 = compressedBinary.toString('base64');

    try {
      await initPgBackupTable();
      if (isCloudBackupDisabled) return;

      const pool = getPgPool();
      const id = `backup_${Date.now()}`;
      await pool.query(
        'INSERT INTO velum_backups (id, sqlite_base64, gzip, updated_at) VALUES ($1, $2, $3, NOW())',
        [id, base64, true]
      );
      console.log(`[SYS-SECURE] Neon PostgreSQL backup created. Original: ${Math.round(binary.length / 1024)} KB, Compressed: ${Math.round(compressedBinary.length / 1024)} KB`);
    } catch (pgErr: any) {
      const errStr = String(pgErr?.message || pgErr);
      console.warn(`[SYS-SECURE] Neon PostgreSQL backup failed: ${errStr}. Disabling cloud backups.`);
      isCloudBackupDisabled = true;
    }
  } catch (err: any) {
    const errStr = String(err?.message || err);
    console.warn(`[SYS-SECURE] CLOUD BACKUP SEQUENCE FAILURE: ${errStr}. Disabling cloud backups.`);
    isCloudBackupDisabled = true;
  }
}
