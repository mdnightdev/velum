import pg from 'pg';
import { config } from 'dotenv';
config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('ALTER TABLE lounges ADD COLUMN last_message_text TEXT, ADD COLUMN last_message_sender_id INTEGER', (err, res) => {
  console.log(err, res);
  process.exit();
});
