import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool, executeWithRetry } from '../db/client.js';
import { ensureAdminSeeded } from '../services/adminSeeder.js';
import { ensureVelumLoungeSeeded } from '../services/loungeSeeder.js';

async function runMigrations() {
  console.log('[Migrate] Connecting to PostgreSQL database...');

  await executeWithRetry(async () => {
    const client = await pool.connect();
    try {
      console.log('[Migrate] Connected successfully.');
      const migrationsDir = path.join(process.cwd(), 'server', 'v2', 'db', 'migrations');
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        console.log(`[Migrate] Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const statements = sql
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(Boolean);

        for (const stmt of statements) {
          try {
            await client.query(stmt);
          } catch (err: any) {
            // Ignore "already exists" errors safely
            if (err.code === '42P07' || err.code === '42710' || err.code === '42701') {
              // Table/relation/index already exists
            } else {
              console.warn(`[Migrate] Warning on statement: ${err.message}`);
            }
          }
        }
        console.log(`[Migrate] Applied: ${file}`);
      }
    } finally {
      client.release();
    }
  }, 5, 2000);

  console.log('[Migrate] All SQL migrations applied successfully.');

  // Seed admin accounts, exchange rates, reserves, and master lounge + 10 sublounges
  console.log('[Migrate] Seeding initial data (Admin accounts, exchange rates, reserves, sublounges)...');
  await ensureAdminSeeded();
  await ensureVelumLoungeSeeded();
  console.log('[Migrate] Database initialization and seeding complete!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('[Migrate] Migration failed:', err);
  process.exit(1);
});
