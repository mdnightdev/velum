import pg from 'pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;

let pgPool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    const useSsl = databaseUrl && (
      databaseUrl.includes('sslmode=require') || 
      databaseUrl.includes('neon.tech') || 
      process.env.NODE_ENV === 'production'
    );
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pgPool;
}
