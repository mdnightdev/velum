import pg from 'pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;

let pgPool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl && databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
  }
  return pgPool;
}
