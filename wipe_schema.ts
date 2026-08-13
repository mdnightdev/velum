import { pool } from './server/v2/db/client.js';
async function wipe() {
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`);
  console.log('Schema recreated.');
  process.exit(0);
}
wipe();
