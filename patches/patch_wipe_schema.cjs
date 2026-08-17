const fs = require('fs');
const file = 'wipe_schema.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = `import { pool } from './server/v2/db/client.js';\nimport { getRedisClient, closeRedisConnections } from './server/v2/db/redis.js';\n`;

code = code.replace(`import { pool } from './server/v2/db/client.js';`, importStatement);

const wipeLogic = `
  await pool.query(\`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;\`);
  console.log('Schema recreated.');

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

code = code.replace(/await pool\.query\(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`\);\s*console\.log\('Schema recreated\.'\);/, wipeLogic);

fs.writeFileSync(file, code);
