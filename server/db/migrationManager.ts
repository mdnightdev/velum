/**
 * Database Migration Manager
 * Tracks and applies schema migrations with versioning
 * Replaces the fragile ALTER TABLE fallback pattern
 */

import { initSqlite, SQLITE_FILE } from './connection.js';
import { writeServerLog } from '../utils/logger.js';
import fs from 'fs';

export interface Migration {
  id: string;
  version: number;
  description: string;
  sql: string;
  applied_at: number | null;
  checksum: string;
}

const MIGRATIONS_TABLE = '_migrations';

const MIGRATIONS: Migration[] = [
  {
    id: 'init',
    version: 1,
    description: 'Initialize migration tracking system',
    sql: `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE,
      description TEXT NOT NULL,
      applied_at INTEGER,
      checksum TEXT NOT NULL,
      duration_ms INTEGER
    )`,
    applied_at: null,
    checksum: 'init_v1'
  },
  {
    id: 'v2_add_message_indexes',
    version: 2,
    description: 'Add composite indexes for message queries',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_messages_room_chronological ON messages(room_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user_chronological ON messages(user_id, created_at DESC);
    `,
    applied_at: null,
    checksum: 'v2_message_indexes'
  },
  {
    id: 'v3_add_session_cleanup',
    version: 3,
    description: 'Add session expiry cleanup mechanism',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `,
    applied_at: null,
    checksum: 'v3_session_cleanup'
  },
  {
    id: 'v4_add_lounge_indexes',
    version: 4,
    description: 'Add lounge lookup performance indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_lounges_name ON lounges(name);
      CREATE INDEX IF NOT EXISTS idx_lounges_status ON lounges(status);
      CREATE INDEX IF NOT EXISTS idx_lounges_visibility ON lounges(visibility);
    `,
    applied_at: null,
    checksum: 'v4_lounge_indexes'
  },
  {
    id: 'v5_add_marketplace_indexes',
    version: 5,
    description: 'Add marketplace query performance indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_market_listings_price ON market_listings(price);
      CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status, created_at DESC);
    `,
    applied_at: null,
    checksum: 'v5_marketplace_indexes'
  },
  {
    id: 'v6_add_wallet_indexes',
    version: 6,
    description: 'Add wallet and financial query indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger_entries(wallet_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recharge_requests_user ON recharge_requests(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON kyc_verifications(user_id, status);
    `,
    applied_at: null,
    checksum: 'v6_wallet_indexes'
  },
  {
    id: 'v7_add_audit_indexes',
    version: 7,
    description: 'Add audit log query performance indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_suspicious_events_severity ON suspicious_events(severity, created_at DESC);
    `,
    applied_at: null,
    checksum: 'v7_audit_indexes'
  },
  {
    id: 'v8_add_ticket_indexes',
    version: 8,
    description: 'Add ticket query performance indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_tickets_issue_type ON tickets(issue_type, status);
    `,
    applied_at: null,
    checksum: 'v8_ticket_indexes'
  },
  {
    id: 'v9_add_friend_indexes',
    version: 9,
    description: 'Add friend and peer relationship indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id, status);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
      CREATE INDEX IF NOT EXISTS idx_peer_relationships_pair ON peer_relationships(user_id_1, user_id_2);
    `,
    applied_at: null,
    checksum: 'v9_friend_indexes'
  }
];

/**
 * Get the current migration status - which migrations have been applied
 */
export function getMigrationStatus(): { applied: Migration[]; pending: Migration[] } {
  const conn = initSqlite();
  if (!conn) {
    return { applied: [], pending: MIGRATIONS };
  }

  try {
    conn.exec(MIGRATIONS[0].sql);

    const appliedRows = conn.prepare(`SELECT * FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`).all() as any[];
    const appliedVersions = new Set(appliedRows.map((r: any) => r.version));

    const applied = appliedRows.map((r: any) => ({
      id: r.id,
      version: r.version,
      description: r.description,
      sql: '',
      applied_at: r.applied_at,
      checksum: r.checksum
    }));

    const pending = MIGRATIONS.filter(m => !appliedVersions.has(m.version));
    return { applied, pending };
  } catch (err) {
    writeServerLog(`[MIGRATIONS] Failed to get migration status: ${err}`);
    return { applied: [], pending: MIGRATIONS };
  }
}

/**
 * Run all pending migrations atomically
 */
export async function runPendingMigrations(): Promise<{ applied: number; failed: number; errors: string[] }> {
  const conn = initSqlite();
  if (!conn) {
    return { applied: 0, failed: 0, errors: ['SQLite connection unavailable'] };
  }

  let applied = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    conn.exec(MIGRATIONS[0].sql);

    const appliedVersions = new Set(
      (conn.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as any[]).map((r: any) => r.version)
    );

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;

      const startTime = Date.now();
      try {
        conn.exec('BEGIN IMMEDIATE TRANSACTION;');

        const statements = migration.sql.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
          conn.exec(stmt.trim() + ';');
        }

        const duration = Date.now() - startTime;
        conn.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (id, version, description, applied_at, checksum, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(migration.id, migration.version, migration.description, Date.now(), migration.checksum, duration);

        conn.exec('COMMIT;');
        applied++;
        writeServerLog(`[MIGRATIONS] Applied v${migration.version}: ${migration.description} (${duration}ms)`);
      } catch (err: any) {
        try { conn.exec('ROLLBACK;'); } catch (_) {}
        failed++;
        const errorMsg = `v${migration.version} (${migration.id}): ${err?.message || err}`;
        errors.push(errorMsg);
        writeServerLog(`[MIGRATIONS] FAILED ${errorMsg}`);
      }
    }
  } catch (err: any) {
    writeServerLog(`[MIGRATIONS] Critical error: ${err?.message || err}`);
    errors.push(`Critical: ${err?.message || err}`);
  }

  return { applied, failed, errors };
}

/**
 * Verify database integrity - checks for corruption, FK violations, etc.
 */
export function verifyDatabaseIntegrity(): { ok: boolean; issues: string[] } {
  const conn = initSqlite();
  if (!conn) {
    return { ok: false, issues: ['SQLite connection unavailable'] };
  }

  const issues: string[] = [];

  try {
    const integrityRow = conn.prepare("PRAGMA integrity_check").get() as any;
    if (integrityRow && integrityRow.integrity_check !== 'ok') {
      issues.push(`Integrity check failed: ${integrityRow.integrity_check}`);
    }

    const fkRow = conn.prepare("PRAGMA foreign_key_check").all() as any[];
    if (fkRow && fkRow.length > 0) {
      issues.push(`Foreign key violations: ${fkRow.length} found`);
      for (const violation of fkRow.slice(0, 5)) {
        issues.push(`  FK violation: ${JSON.stringify(violation)}`);
      }
    }

    const pageCount = (conn.prepare("PRAGMA page_count").get() as any)?.page_count || 0;
    if (pageCount === 0) {
      issues.push('Database has zero pages - may be empty or corrupted');
    }

    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const tableNames = tables.map((t: any) => t.name);

    const criticalTables = ['users', 'profiles', 'sessions', 'messages', 'lounges'];
    for (const table of criticalTables) {
      if (!tableNames.includes(table)) {
        issues.push(`Critical table '${table}' is missing`);
      }
    }

    return { ok: issues.length === 0, issues };
  } catch (err: any) {
    issues.push(`Verification error: ${err?.message || err}`);
    return { ok: false, issues };
  }
}

/**
 * Get detailed database performance statistics
 */
export async function getDatabaseStats(): Promise<{
  sizeBytes: number;
  pageCount: number;
  pageSize: number;
  tableCount: number;
  indexCount: number;
  walMode: boolean;
  busyTimeout: number;
  schemaVersion: number;
  migrationCount: number;
  rowCounts: Record<string, number>;
}> {
  const conn = initSqlite();
  const stats = {
    sizeBytes: 0,
    pageCount: 0,
    pageSize: 0,
    tableCount: 0,
    indexCount: 0,
    walMode: false,
    busyTimeout: 0,
    schemaVersion: 0,
    migrationCount: 0,
    rowCounts: {} as Record<string, number>
  };

  if (!conn) return stats;

  try {
    if (fs.existsSync(SQLITE_FILE)) {
      stats.sizeBytes = fs.statSync(SQLITE_FILE).size;
    }

    stats.pageCount = Number((conn.prepare("PRAGMA page_count").get() as any)?.page_count || 0);
    stats.pageSize = Number((conn.prepare("PRAGMA page_size").get() as any)?.page_size || 0);
    stats.busyTimeout = Number((conn.prepare("PRAGMA busy_timeout").get() as any)?.busy_timeout || 0);
    stats.schemaVersion = Number((conn.prepare("PRAGMA schema_version").get() as any)?.schema_version || 0);

    const journalMode = (conn.prepare("PRAGMA journal_mode").get() as any)?.journal_mode || '';
    stats.walMode = journalMode === 'wal';

    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'").all() as any[];
    stats.tableCount = tables.length;

    const indexes = conn.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").get() as any;
    stats.indexCount = Number(indexes?.count || 0);

    for (const table of tables) {
      try {
        const row = conn.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as any;
        stats.rowCounts[table.name] = Number(row?.count || 0);
      } catch (_) {}
    }

    const migrationRow = conn.prepare(`SELECT COUNT(*) as count FROM ${MIGRATIONS_TABLE}`).get() as any;
    stats.migrationCount = Number(migrationRow?.count || 0);
  } catch (_) {}

  return stats;
}