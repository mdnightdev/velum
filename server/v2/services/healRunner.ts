import { desc, sql, lt, eq, and, isNotNull } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { healReports } from '../db/schema/ops_client_diagnostics.js';
import { users } from '../db/schema/users.js';
import { userPrekeys } from '../db/schema/keys.js';
import { sessions } from '../db/schema/sessions.js';
import { ensureVelumLoungeSeeded } from './loungeSeeder.js';
import { ensureAdminSeeded } from './adminSeeder.js';
import { logger } from '../utils/logger.js';
import { generateRandomToken } from '../utils/crypto.js';
import { reportOpsError, purgeOldOpsErrors } from './opsErrorService.js';
import { purgeOldClientDiagnostics } from './clientDiagnosticsService.js';
export type HealMode = 'fix' | 'report';

export type HealFinding = {
  check: string;
  severity: 'info' | 'amber' | 'red';
  message: string;
  count?: number;
  autoFixed?: boolean;
};

export type HealReport = {
  reportId: string;
  mode: HealMode;
  status: 'ok' | 'degraded' | 'critical';
  summary: string;
  findings: HealFinding[];
  actions: string[];
  triggeredBy: string;
  createdAt: string;
};

let healTableReady: Promise<void> | null = null;
let healInterval: ReturnType<typeof setInterval> | null = null;

async function ensureHealTable(): Promise<void> {
  if (!healTableReady) {
    healTableReady = executeWithRetry(async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS heal_reports (
          id SERIAL PRIMARY KEY,
          report_id VARCHAR(64) NOT NULL UNIQUE,
          mode VARCHAR(16) NOT NULL,
          status VARCHAR(16) NOT NULL,
          summary TEXT NOT NULL,
          findings_json TEXT,
          actions_json TEXT,
          triggered_by VARCHAR(64),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_heal_reports_created ON heal_reports (created_at)`);
    }).catch((err) => {
      healTableReady = null;
      throw err;
    });
  }
  await healTableReady;
}

async function persistHealReport(report: HealReport): Promise<void> {
  await ensureHealTable();
  await executeWithRetry(async () => {
    await db.insert(healReports).values({
      reportId: report.reportId,
      mode: report.mode,
      status: report.status,
      summary: report.summary,
      findingsJson: JSON.stringify(report.findings),
      actionsJson: JSON.stringify(report.actions),
      triggeredBy: report.triggeredBy,
    });
  });

  try {
    const fs = await import('fs');
    const { resolve } = await import('path');
    const logsDir = resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const line = JSON.stringify({ ...report, ts: new Date().toISOString() }) + '\n';
    fs.appendFileSync(resolve(logsDir, `heal-${day}.log`), line);
  } catch (err) {
    logger.warn('Failed to append heal log file', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runHeal(opts: {
  mode: HealMode;
  triggeredBy?: string;
}): Promise<HealReport> {
  const mode = opts.mode;
  const triggeredBy = opts.triggeredBy || 'cli';
  const findings: HealFinding[] = [];
  const actions: string[] = [];
  const reportId = `HEAL-${Date.now()}-${generateRandomToken(4).toUpperCase()}`;

  try {
    const tablesResult = await db.execute(sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const existingTables = (tablesResult.rows as { table_name: string }[]).map((r) => r.table_name);
    const required = ['users', 'lounges', 'lounge_members', 'messages', 'sessions'];
    const missing = required.filter((t) => !existingTables.includes(t));
    if (missing.length) {
      findings.push({
        check: 'schema',
        severity: 'red',
        message: `Missing tables: ${missing.join(', ')}`,
        count: missing.length,
      });
    } else {
      findings.push({ check: 'schema', severity: 'info', message: 'Core tables present' });
    }

    if (mode === 'fix') {
      await ensureVelumLoungeSeeded();
      actions.push('ensureVelumLoungeSeeded');
      await ensureAdminSeeded();
      actions.push('ensureAdminSeeded');
    } else {
      findings.push({ check: 'seeders', severity: 'info', message: 'Report-only: skipped seeders' });
    }

    const { databaseCleanup } = await import('../utils/databaseCleanup.js');
    if (mode === 'fix') {
      const report = await databaseCleanup.cleanOrphans();
      const total =
        report.members + report.messages + report.sublounges + report.relationships + report.expiredSessions;
      findings.push({
        check: 'orphans',
        severity: total > 0 ? 'amber' : 'info',
        message: `Cleaned orphans m=${report.members} msg=${report.messages} sub=${report.sublounges} rel=${report.relationships} sess=${report.expiredSessions}`,
        count: total,
        autoFixed: true,
      });
      actions.push('databaseCleanup.cleanOrphans');
    } else {
      findings.push({
        check: 'orphans',
        severity: 'info',
        message: 'Report-only: orphan cleanup skipped',
      });
    }

    // Expired sessions still present
    const expiredSessions = await executeWithRetry(async () => {
      return db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(isNotNull(sessions.expiresAt), lt(sessions.expiresAt, new Date())))
        .limit(200);
    });
    if (expiredSessions.length > 0) {
      findings.push({
        check: 'expired_sessions',
        severity: 'amber',
        message: `${expiredSessions.length} expired sessions still stored`,
        count: expiredSessions.length,
      });
      if (mode === 'fix') {
        await executeWithRetry(async () => {
          await db.delete(sessions).where(and(isNotNull(sessions.expiresAt), lt(sessions.expiresAt, new Date())));
        });
        actions.push(`deleted_expired_sessions:${expiredSessions.length}`);
        findings[findings.length - 1].autoFixed = true;
      }
    } else {
      findings.push({ check: 'expired_sessions', severity: 'info', message: 'No expired sessions' });
    }

    // Active users missing prekeys — report only (never wipe client plaintext)
    const recentUsers = await executeWithRetry(async () => {
      return db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.status, 'Active'))
        .limit(100);
    });

    let missingPrekeys = 0;
    for (const u of recentUsers) {
      const [pk] = await db.select({ id: userPrekeys.id }).from(userPrekeys).where(eq(userPrekeys.userId, u.id)).limit(1);
      if (!pk) missingPrekeys += 1;
    }
    if (missingPrekeys > 0) {
      findings.push({
        check: 'prekeys_missing',
        severity: 'amber',
        message: `${missingPrekeys} sampled active users lack published prekeys (report-only; never wipe client plaintext)`,
        count: missingPrekeys,
      });
    } else {
      findings.push({ check: 'prekeys_missing', severity: 'info', message: 'Sampled users have prekeys' });
    }

    // Retention purge (fix mode)
    if (mode === 'fix') {
      const purgedOps = await purgeOldOpsErrors(90).catch(() => 0);
      const purgedDiag = await purgeOldClientDiagnostics(90).catch(() => 0);
      const purgedHeal = await purgeOldHealReports(90).catch(() => 0);
      actions.push(`retention_ops=${purgedOps},diag=${purgedDiag},heal=${purgedHeal}`);
      findings.push({
        check: 'retention',
        severity: 'info',
        message: `Purged ops=${purgedOps} diag=${purgedDiag} heal=${purgedHeal} (>90d)`,
        autoFixed: true,
      });
    }

    const hasRed = findings.some((f) => f.severity === 'red');
    const hasAmber = findings.some((f) => f.severity === 'amber');
    const status: HealReport['status'] = hasRed ? 'critical' : hasAmber ? 'degraded' : 'ok';
    const summary = `Heal ${mode}: ${status} — ${findings.length} checks, ${actions.length} actions`;

    const report: HealReport = {
      reportId,
      mode,
      status,
      summary,
      findings,
      actions,
      triggeredBy,
      createdAt: new Date().toISOString(),
    };

    await persistHealReport(report);

    if (status === 'critical') {
      void reportOpsError({
        severity: 'red',
        code: 'HEAL_CRITICAL',
        message: summary,
        component: 'healRunner',
        details: { reportId, findings: findings.filter((f) => f.severity === 'red') },
      });
      try {
        const { systemBot } = await import('./systemBot.js');
        systemBot.dispatchHealthAlert('CRITICAL', summary, { reportId });
      } catch {
        /* optional */
      }
    } else if (status === 'degraded') {
      logger.warn(summary, { reportId, findings });
    } else {
      logger.info(summary, { reportId });
    }

    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const report: HealReport = {
      reportId,
      mode,
      status: 'critical',
      summary: `Heal failed: ${message}`,
      findings: [{ check: 'runner', severity: 'red', message }],
      actions,
      triggeredBy,
      createdAt: new Date().toISOString(),
    };
    try {
      await persistHealReport(report);
    } catch {
      /* ignore */
    }
    void reportOpsError({
      severity: 'red',
      code: 'HEAL_FAILED',
      message,
      component: 'healRunner',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return report;
  }
}

export async function listHealReports(limit = 20) {
  await ensureHealTable();
  const rows = await executeWithRetry(async () => {
    return db.select().from(healReports).orderBy(desc(healReports.createdAt)).limit(Math.min(limit, 100));
  });
  return rows.map((r) => ({
    reportId: r.reportId,
    mode: r.mode,
    status: r.status,
    summary: r.summary,
    findings: safeJson(r.findingsJson, []),
    actions: safeJson(r.actionsJson, []),
    triggeredBy: r.triggeredBy,
    createdAt: r.createdAt?.toISOString?.() || String(r.createdAt),
  }));
}

export async function getLatestHealReport() {
  const list = await listHealReports(1);
  return list[0] || null;
}

export async function purgeOldHealReports(days = 90): Promise<number> {
  await ensureHealTable();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await executeWithRetry(async () => {
    return db.delete(healReports).where(lt(healReports.createdAt, cutoff)).returning({ id: healReports.id });
  });
  return deleted.length;
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** In-process scheduled heal (default 30m). */
export function startHealScheduler(intervalMs = 30 * 60 * 1000): void {
  if (healInterval) return;
  const run = () => {
    void runHeal({ mode: 'fix', triggeredBy: 'scheduler' }).catch((err) => {
      logger.error('Scheduled heal failed', { error: err instanceof Error ? err.message : String(err) });
    });
  };
  // Delay first run 2m after boot
  setTimeout(run, 2 * 60 * 1000);
  healInterval = setInterval(run, intervalMs);
  logger.info('Heal scheduler started', { intervalMs });
}
