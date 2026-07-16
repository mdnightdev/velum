import { initSqlite } from '../../db/index.js';

export const dbCommands = {
  resetNonces: async () => {
    const conn = initSqlite();
    if (!conn) return 'ERROR: SQLite connection unavailable.';
    try {
      conn.exec('DROP TABLE IF EXISTS login_nonces');
      conn.exec('CREATE TABLE login_nonces (nonce TEXT PRIMARY KEY, created_at INTEGER NOT NULL, used INTEGER DEFAULT 0)');
      return 'SUCCESS: login_nonces table reset.';
    } catch (err: any) {
      return `ERROR: Failed to reset nonces: ${err.message}`;
    } finally {
      try { conn.close?.(); } catch (_) {}
    }
  }
};
