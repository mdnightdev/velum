import { desc, eq, sql, lt } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { clientDiagnostics } from '../db/schema/ops_client_diagnostics.js';
import { logger, redactSensitiveData } from '../utils/logger.js';
import { generateRandomToken } from '../utils/crypto.js';
import { reportOpsError } from './opsErrorService.js';

let tableReady: Promise<void> | null = null;

async function ensureClientDiagTable(): Promise<void> {
  if (!tableReady) {
    tableReady = executeWithRetry(async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS client_diagnostics (
          id SERIAL PRIMARY KEY,
          log_id VARCHAR(64) NOT NULL UNIQUE,
          user_id INTEGER,
          username VARCHAR(128),
          status VARCHAR(16) NOT NULL DEFAULT 'pending',
          app_version VARCHAR(64),
          ip_address VARCHAR(64),
          screen_resolution VARCHAR(32),
          device_pixel_ratio REAL,
          viewport_size VARCHAR(32),
          online_status BOOLEAN,
          connection_type VARCHAR(32),
          user_agent TEXT,
          notes TEXT,
          payload_json TEXT,
          severity VARCHAR(16) DEFAULT 'red',
          source VARCHAR(32) DEFAULT 'manual',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMP
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_client_diag_created ON client_diagnostics (created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_client_diag_status ON client_diagnostics (status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_client_diag_user ON client_diagnostics (user_id)`);
    }).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

export type SaveClientDiagnosticInput = {
  userId: number;
  username: string;
  ipAddress?: string;
  payload: Record<string, unknown>;
  source?: 'manual' | 'auto' | 'error_boundary';
  severity?: 'amber' | 'red';
};

function stripUnsafeDiagFields(payload: Record<string, unknown>): Record<string, unknown> {
  const safe = redactSensitiveData({ ...payload }) as Record<string, unknown>;
  delete safe.plaintext;
  delete safe.cipher;
  delete safe.content;
  delete safe.body;
  delete safe.message_body;
  return safe;
}

export async function saveClientDiagnostic(input: SaveClientDiagnosticInput) {
  await ensureClientDiagTable();
  const logId = `diag_${Date.now()}_${generateRandomToken(4)}`;
  const payload = stripUnsafeDiagFields(input.payload);
  const severity = input.severity || 'red';
  const source = input.source || 'manual';

  const row = {
    id: logId,
    user_id: input.userId,
    username: input.username,
    status: 'pending' as const,
    app_version: String(payload.app_version || 'unknown'),
    ip_address: input.ipAddress || '127.0.0.1',
    screen_resolution: String(payload.screen_resolution || ''),
    device_pixel_ratio: Number(payload.device_pixel_ratio || 1),
    viewport_size: String(payload.viewport_size || ''),
    online_status: payload.online_status !== undefined ? Boolean(payload.online_status) : true,
    connection_type: String(payload.connection_type || 'unknown'),
    user_agent: String(payload.user_agent || ''),
    created_at: new Date().toISOString(),
    notes: String(payload.notes || ''),
    error_buffer: Array.isArray(payload.error_buffer) ? payload.error_buffer : [],
    storage_summary: (payload.storage_summary as object) || {},
    state_snapshot: payload.state_snapshot || {},
    severity,
    source,
  };

  await executeWithRetry(async () => {
    await db.insert(clientDiagnostics).values({
      logId,
      userId: input.userId,
      username: input.username,
      status: 'pending',
      appVersion: row.app_version,
      ipAddress: row.ip_address,
      screenResolution: row.screen_resolution,
      devicePixelRatio: row.device_pixel_ratio,
      viewportSize: row.viewport_size,
      onlineStatus: row.online_status,
      connectionType: row.connection_type,
      userAgent: row.user_agent,
      notes: row.notes,
      payloadJson: JSON.stringify(payload).slice(0, 50000),
      severity,
      source,
    });
  });

  if (source !== 'manual') {
    void reportOpsError({
      severity,
      code: source === 'error_boundary' ? 'CLIENT_ERROR_BOUNDARY' : 'CLIENT_AUTO_DIAG',
      message: String(payload.notes || `Client diagnostic (${source})`).slice(0, 500),
      userId: input.userId,
      component: 'client_diagnostics',
      details: {
        logId,
        app_version: row.app_version,
        reconnectCount: (payload.state_snapshot as { reconnect_count?: number } | undefined)?.reconnect_count,
      },
    });
  }

  logger.warn('Client diagnostic stored', { logId, userId: input.userId, source, severity });
  return row;
}

export async function listClientDiagnostics(opts: { limit?: number; offset?: number; status?: string } = {}) {
  await ensureClientDiagTable();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await executeWithRetry(async () => {
    if (opts.status && opts.status !== 'all') {
      return db
        .select()
        .from(clientDiagnostics)
        .where(eq(clientDiagnostics.status, opts.status))
        .orderBy(desc(clientDiagnostics.createdAt))
        .limit(limit)
        .offset(offset);
    }
    return db
      .select()
      .from(clientDiagnostics)
      .orderBy(desc(clientDiagnostics.createdAt))
      .limit(limit)
      .offset(offset);
  });

  return rows.map((r) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = r.payloadJson ? JSON.parse(r.payloadJson) : {};
    } catch {
      payload = {};
    }
    return {
      id: r.logId,
      user_id: r.userId,
      username: r.username,
      status: r.status as 'pending' | 'reviewed' | 'resolved',
      app_version: r.appVersion || 'unknown',
      ip_address: r.ipAddress || '',
      screen_resolution: r.screenResolution || '',
      device_pixel_ratio: r.devicePixelRatio ?? 1,
      viewport_size: r.viewportSize || '',
      online_status: r.onlineStatus !== false,
      connection_type: r.connectionType || 'unknown',
      user_agent: r.userAgent || '',
      created_at: r.createdAt?.toISOString?.() || String(r.createdAt),
      notes: r.notes || '',
      error_buffer: Array.isArray(payload.error_buffer) ? payload.error_buffer : [],
      storage_summary: payload.storage_summary || {
        localStorage_keys_count: 0,
        localStorage_approx_size_kb: 0,
        serviceWorker_active: false,
        indexedDb_supported: false,
      },
      state_snapshot: payload.state_snapshot || {},
      severity: r.severity,
      source: r.source,
    };
  });
}

export async function resolveClientDiagnostic(logId: string): Promise<boolean> {
  await ensureClientDiagTable();
  const updated = await executeWithRetry(async () => {
    return db
      .update(clientDiagnostics)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(eq(clientDiagnostics.logId, logId))
      .returning({ id: clientDiagnostics.id });
  });
  return updated.length > 0;
}

export async function deleteClientDiagnostic(logId: string): Promise<boolean> {
  await ensureClientDiagTable();
  const deleted = await executeWithRetry(async () => {
    return db
      .delete(clientDiagnostics)
      .where(eq(clientDiagnostics.logId, logId))
      .returning({ id: clientDiagnostics.id });
  });
  return deleted.length > 0;
}

/** Retention: drop client diagnostics older than days (default 90). */
export async function purgeOldClientDiagnostics(days = 90): Promise<number> {
  await ensureClientDiagTable();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await executeWithRetry(async () => {
    return db
      .delete(clientDiagnostics)
      .where(lt(clientDiagnostics.createdAt, cutoff))
      .returning({ id: clientDiagnostics.id });
  });
  return deleted.length;
}
