import { db, pool } from './server/v2/db/client.js';

async function wipeDatabase() {
  console.log('Wiping database...');
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('Database wiped.');
  process.exit(0);
}
wipeDatabase();
