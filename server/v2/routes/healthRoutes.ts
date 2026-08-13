import { Router } from 'express';
import { getWebSocketDiagnostics } from '../../websocket.js';
import { db, executeWithRetry } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';

export const healthRouter = Router();

// GET /api/v2/health & /v2/health (no auth required)
healthRouter.get('/health', async (_req, res) => {
  let dbHealthy = false;
  try {
    await executeWithRetry(() => db.execute(sql`SELECT 1`));
    dbHealthy = true;
  } catch (err) {
    dbHealthy = false;
  }

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'online' : 'degraded',
    version: '2.2.0',
    buildVersion: '2.2.0-v2-prod',
    env: config.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// GET /api/v2/diagnostics & /v2/diagnostics (no auth required for basic health check)
healthRouter.get('/diagnostics', async (req, res) => {
  let dbHealthy = false;
  let dbLatencyMs = 0;
  const startTime = Date.now();

  try {
    await executeWithRetry(() => db.execute(sql`SELECT 1`));
    dbHealthy = true;
    dbLatencyMs = Date.now() - startTime;
  } catch (err) {
    dbHealthy = false;
  }

  const wsDiagnostics = getWebSocketDiagnostics();

  res.json({
    buildVersion: '2.2.0-v2-prod',
    env: config.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    websocketState: {
      activeConnections: wsDiagnostics.activeConnections,
      activeSessionsCount: wsDiagnostics.activeSessionsCount,
      activeRoomsCount: wsDiagnostics.activeRoomsCount,
      reconnectCount: wsDiagnostics.reconnectCount
    },
    dbConnection: {
      healthy: dbHealthy,
      latencyMs: dbLatencyMs,
      poolActive: true
    },
    lastServerEventTimestamp: new Date(wsDiagnostics.lastServerEventTimestamp).toISOString(),
    authContext: {
      userId: (req as any).user?.userId || null,
      role: (req as any).user?.role || 'ANONYMOUS'
    }
  });
});
