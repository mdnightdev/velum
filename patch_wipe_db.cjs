const fs = require('fs');
const file = 'wipe_db.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = `import { db, pool } from './server/v2/db/client.js';\nimport { getRedisClient, closeRedisConnections } from './server/v2/db/redis.js';\n`;

code = code.replace(`import { db, pool } from './server/v2/db/client.js';`, importStatement);

const wipeLogic = `
  console.log('Wiping database...');
  await pool.query(\`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  \`);
  console.log('Database wiped.');

  console.log('Checking for stale Redis cache...');
  try {
    const redis = await getRedisClient();
    if (redis) {
      console.log('Wiping Redis cache to maintain backend consistency...');
      await redis.flushAll();
      console.log('Redis cache wiped.');
      await closeRedisConnections();
    } else {
      console.log('No Redis connection available.');
    }
  } catch (err) {
    console.error('Failed to wipe Redis:', err);
  }
`;

code = code.replace(/console\.log\('Wiping database\.\.\.'\);[\s\S]*?console\.log\('Database wiped\.'\);/, wipeLogic);

fs.writeFileSync(file, code);
