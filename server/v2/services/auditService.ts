import { db, executeWithRetry } from '../db/client.js';
import { auditLogs, NewAuditLog } from '../db/schema/audit_logs.js';
import { generateRandomToken } from '../utils/crypto.js';
import { desc } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';

export interface AuditEventParams {
  adminId: number;
  adminName: string;
  action: string;
  targetId?: string;
  reason: string;
}

/**
 * Inserts a structured record into the audit_logs database table.
 */
export async function recordAuditEvent(params: AuditEventParams): Promise<void> {
  const logId = `AUD-${Date.now()}-${generateRandomToken(6).toUpperCase()}`;

  await executeWithRetry(async () => {
    await db.insert(auditLogs).values({
      logId,
      adminId: params.adminId,
      adminName: params.adminName || `USER-${params.adminId}`,
      action: params.action,
      targetId: params.targetId || null,
      reason: params.reason
    });
  });
}

/**
 * Retrieves recent audit log entries ordered by timestamp descending.
 */
export async function getAuditLogs(limit: number = 50, offset: number = 0) {
  return await executeWithRetry(async () => {
    return await db.select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  });
}

/**
 * Express middleware to automatically log audit events for specific endpoints.
 */
export function createAuditMiddleware(actionName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400 && (req as any).user) {
        const user = (req as any).user;
        const targetId = req.params.id || req.body?.targetId || req.body?.userId || req.body?.channelId || null;
        const reason = req.body?.reason || `${req.method} ${req.originalUrl} executed`;

        recordAuditEvent({
          adminId: user.userId,
          adminName: user.username || `USER-${user.userId}`,
          action: actionName,
          targetId: targetId ? String(targetId) : undefined,
          reason
        }).catch((err) => {
          console.error('[AuditService] Failed to record audit log:', err);
        });
      }
    });
    next();
  };
}
