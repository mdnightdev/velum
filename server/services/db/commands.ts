import { initSqlite, db, loadDb } from '../../db/index.js';

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
  },
  getDiagnosticLogs: async (targetUserId?: string | number, rawJson?: boolean) => {
    loadDb();
    const logs = db.diagnostic_logs || [];
    let list = logs;
    if (targetUserId) {
      list = logs.filter(l => String(l.user_id) === String(targetUserId) || l.username?.toLowerCase() === String(targetUserId).toLowerCase());
    }

    if (rawJson) {
      return JSON.stringify(list, null, 2);
    }

    if (list.length === 0) {
      return `[CLI CLOUD DIAGNOSTICS] No diagnostic logs found in Cloud Database ${targetUserId ? `for user '${targetUserId}'` : ''}.`;
    }

    const outputLines: string[] = [
      `=== VELUM CLOUD DIAGNOSTICS TELEMETRY (${list.length} LOGS) ===`
    ];

    list.slice(-15).forEach((log, index) => {
      outputLines.push(`\n[#${index + 1}] LOG ID: ${log.id} | STATUS: ${log.status.toUpperCase()}`);
      outputLines.push(`  User: ${log.username || 'Anonymous'} (ID: ${log.user_id})`);
      outputLines.push(`  Build Version: ${log.app_version || 'v2.1.52-b1053'}`);
      outputLines.push(`  Submitted At: ${log.created_at}`);
      outputLines.push(`  IP / Screen / DPR: ${log.ip_address} | ${log.screen_resolution} | ${log.device_pixel_ratio}x`);
      outputLines.push(`  Viewport / Network: ${log.viewport_size} | ${log.online_status ? 'Online' : 'Offline'} (${log.connection_type})`);
      if (log.notes) {
        outputLines.push(`  Incident Notes: "${log.notes}"`);
      }
      if (log.error_buffer && log.error_buffer.length > 0) {
        outputLines.push(`  Recorded Errors (${log.error_buffer.length}):`);
        log.error_buffer.forEach(err => {
          outputLines.push(`    - [${err.timestamp}] ${err.message} ${err.source ? `(${err.source}:${err.lineno})` : ''}`);
        });
      }
    });

    outputLines.push(`\n[CLI CLOUD LINK ACTIVE]: Directly synchronized with Cloud Memory DB.`);
    return outputLines.join('\n');
  }
};
