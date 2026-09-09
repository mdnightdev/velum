import type { Request } from 'express';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { opsErrorEvents } from '../db/schema/ops_error_events.js';
import { logger, redactSensitiveData } from '../utils/logger.js';
import { generateRandomToken } from '../utils/crypto.js';
import {
  isOpsWatchedPath,
  opsCodeForHttp,
  severityForHttpStatus,
  type OpsSeverity,
} from '../utils/opsErrorClassify.js';
import { lt } from 'drizzle-orm';
export type { OpsSeverity };
export { isOpsWatchedPath, opsCodeForHttp, severityForHttpStatus };

export type ReportOpsErrorInput = {
  severity: OpsSeverity;
  code: string;
  message: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: number | null;
  correlationId?: string | null;
  component?: string;
  details?: Record<string, unknown>;
  stack?: string;
};

/**
 * Persist amber/red for watched routes (and all 5xx). Dedupes nothing — call from finish once.
 */
export async function reportOpsErrorFromHttp(opts: {
  req: Request;
  statusCode: number;
  durationMs?: number;
  message?: string;
}): Promise<string | null> {
  const path = opts.req.originalUrl || opts.req.url || '';
  if (opts.statusCode < 500 && !isOpsWatchedPath(path)) return null;

  const correlationId =
    (opts.req as Request & { correlationId?: string }).correlationId ||
    (opts.req.headers['x-correlation-id'] as string | undefined) ||
    null;
  const userId = opts.req.user?.userId ?? null;

  return reportOpsError({
    severity: severityForHttpStatus(opts.statusCode),
    code: opsCodeForHttp(opts.req.method || 'GET', path, opts.statusCode),
    message:
      opts.message ||
      `${opts.req.method} ${path.split('?')[0]} → ${opts.statusCode}`,
    route: path.split('?')[0].slice(0, 256),
    method: opts.req.method,
    statusCode: opts.statusCode,
    userId,
    correlationId,
    component: 'http',
    details: opts.durationMs != null ? { durationMs: opts.durationMs } : undefined,
  });
}

let tableReady: Promise<void> | null = null;

async function ensureOpsErrorTable(): Promise<void> {
  if (!tableReady) {
    tableReady = executeWithRetry(async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ops_error_events (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL UNIQUE,
          severity VARCHAR(16) NOT NULL,
          code VARCHAR(64) NOT NULL,
          message TEXT NOT NULL,
          route VARCHAR(256),
          method VARCHAR(16),
          status_code INTEGER,
          user_id INTEGER,
          correlation_id VARCHAR(64),
          component VARCHAR(128),
          details_json TEXT,
          stack TEXT,
          resolved VARCHAR(16) NOT NULL DEFAULT 'open',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMP
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ops_errors_severity ON ops_error_events (severity)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ops_errors_created ON ops_error_events (created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ops_errors_resolved ON ops_error_events (resolved)`);
    }).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

/**
 * Log amber/red to Winston files and persist for admin audit.
 * Never include message plaintext or crypto material in details.
 */
export async function reportOpsError(input: ReportOpsErrorInput): Promise<string | null> {
  const eventId = `OPS-${Date.now()}-${generateRandomToken(6).toUpperCase()}`;
  const safeDetails = input.details ? redactSensitiveData(input.details) : undefined;
  const meta = {
    eventId,
    code: input.code,
    route: input.route,
    method: input.method,
    statusCode: input.statusCode,
    userId: input.userId ?? undefined,
    correlationId: input.correlationId || undefined,
    component: input.component,
    details: safeDetails,
  };

  if (input.severity === 'red') {
    logger.error(input.message, { ...meta, stack: input.stack });
  } else {
    logger.warn(input.message, meta);
  }

  try {
    await ensureOpsErrorTable();
    await executeWithRetry(async () => {
      await db.insert(opsErrorEvents).values({
        eventId,
        severity: input.severity,
        code: input.code.slice(0, 64),
        message: String(input.message).slice(0, 4000),
        route: input.route ? String(input.route).slice(0, 256) : null,
        method: input.method ? String(input.method).slice(0, 16) : null,
        statusCode: input.statusCode ?? null,
        userId: input.userId ?? null,
        correlationId: input.correlationId ? String(input.correlationId).slice(0, 64) : null,
        component: input.component ? String(input.component).slice(0, 128) : null,
        detailsJson: safeDetails ? JSON.stringify(safeDetails).slice(0, 8000) : null,
        stack: input.stack ? String(input.stack).slice(0, 8000) : null,
        resolved: 'open',
      });
    });
    return eventId;
  } catch (err) {
    logger.error('Failed to persist ops_error_events row', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    });
    return eventId;
  }
}

export async function listOpsErrors(opts: {
  limit?: number;
  offset?: number;
  severity?: OpsSeverity | 'all';
  resolved?: 'open' | 'resolved' | 'all';
}) {
  await ensureOpsErrorTable();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const conditions = [];
  if (opts.severity && opts.severity !== 'all') {
    conditions.push(eq(opsErrorEvents.severity, opts.severity));
  }
  if (opts.resolved && opts.resolved !== 'all') {
    conditions.push(eq(opsErrorEvents.resolved, opts.resolved));
  }

  return executeWithRetry(async () => {
    const base = db.select().from(opsErrorEvents);
    if (conditions.length === 0) {
      return base.orderBy(desc(opsErrorEvents.createdAt)).limit(limit).offset(offset);
    }
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    return base
      .where(whereClause)
      .orderBy(desc(opsErrorEvents.createdAt))
      .limit(limit)
      .offset(offset);
  });
}

export async function resolveOpsError(eventId: string): Promise<boolean> {
  await ensureOpsErrorTable();
  const updated = await executeWithRetry(async () => {
    return db
      .update(opsErrorEvents)
      .set({ resolved: 'resolved', resolvedAt: new Date() })
      .where(eq(opsErrorEvents.eventId, eventId))
      .returning({ id: opsErrorEvents.id });
  });
  return updated.length > 0;
}

/** Retention: drop ops_error_events older than days (default 90). */
export async function purgeOldOpsErrors(days = 90): Promise<number> {
  await ensureOpsErrorTable();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await executeWithRetry(async () => {
    return db
      .delete(opsErrorEvents)
      .where(lt(opsErrorEvents.createdAt, cutoff))
      .returning({ id: opsErrorEvents.id });
  });
  return deleted.length;
}
