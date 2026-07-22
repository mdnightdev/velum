import { Router, Request, Response } from 'express';
import { getConnectionHealth } from '../db/connection.js';
import { getMigrationStatus, runPendingMigrations, verifyDatabaseIntegrity, getDatabaseStats } from '../db/migrationManager.js';
import { authenticateAdmin } from '../middlewares/auth.js';
import { writeServerLog } from '../utils/logger.js';

export const databaseRouter = Router();

/**
 * GET /api/database/health
 * Returns database connection health status
 */
databaseRouter.get('/database/health', (_req: Request, res: Response) => {
  const health = getConnectionHealth();
  res.json({
    status: health.isConnected ? 'healthy' : 'unhealthy',
    ...health,
    timestamp: Date.now()
  });
});

/**
 * GET /api/database/stats
 * Returns detailed database statistics (admin only)
 */
databaseRouter.get('/database/stats', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getDatabaseStats();
    res.json({
      status: 'ok',
      ...stats,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get database stats', details: err?.message });
  }
});

/**
 * GET /api/database/integrity
 * Runs database integrity check (admin only)
 */
databaseRouter.get('/database/integrity', authenticateAdmin, (_req: Request, res: Response) => {
  try {
    const result = verifyDatabaseIntegrity();
    res.json({
      status: result.ok ? 'ok' : 'issues_found',
      ...result,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Integrity check failed', details: err?.message });
  }
});

/**
 * GET /api/database/migrations
 * Returns migration status (admin only)
 */
databaseRouter.get('/database/migrations', authenticateAdmin, (_req: Request, res: Response) => {
  try {
    const status = getMigrationStatus();
    res.json({
      status: 'ok',
      appliedCount: status.applied.length,
      pendingCount: status.pending.length,
      applied: status.applied,
      pending: status.pending,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get migration status', details: err?.message });
  }
});

/**
 * POST /api/database/migrations/run
 * Runs all pending migrations (admin only)
 */
databaseRouter.post('/database/migrations/run', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await runPendingMigrations();
    res.json({
      status: result.failed === 0 ? 'ok' : 'partial',
      ...result,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Migration run failed', details: err?.message });
  }
});

/**
 * GET /api/database/backup/status
 * Returns backup status information
 */
databaseRouter.get('/database/backup/status', authenticateAdmin, (_req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { DB_DIR, DB_FILE, SQLITE_FILE } = require('../db/connection.js');
    
    const backupInfo = {
      dbFile: {
        exists: fs.existsSync(DB_FILE),
        sizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
        lastModified: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).mtime : null
      },
      sqliteFile: {
        exists: fs.existsSync(SQLITE_FILE),
        sizeBytes: fs.existsSync(SQLITE_FILE) ? fs.statSync(SQLITE_FILE).size : 0,
        lastModified: fs.existsSync(SQLITE_FILE) ? fs.statSync(SQLITE_FILE).mtime : null
      },
      dataDir: {
        exists: fs.existsSync(DB_DIR),
        freeSpace: fs.existsSync(DB_DIR) ? (() => { try { return require('fs').statfsSync(DB_DIR)?.bsize * require('fs').statfsSync(DB_DIR)?.bavail; } catch(_) { return null; } })() : null
      }
    };
    
    res.json({
      status: 'ok',
      ...backupInfo,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get backup status', details: err?.message });
  }
});

writeServerLog('[ROUTES] Database health and monitoring routes registered.');