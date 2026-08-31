import crypto from 'node:crypto';
import { db } from '../../server/v2/db/client.js';
import { auditLogs } from '../../server/v2/db/schema/audit_logs.js';
import { userRepository } from '../../server/v2/repositories/userRepository.js';
import { theme } from './theme.js';

export const SYSTEM_USER_IDS = new Set([1, 2, 999]);

export function isSystemUser(userId: number): boolean {
  return SYSTEM_USER_IDS.has(userId);
}

export async function resolveUser(idOrUsername: string) {
  const num = parseInt(idOrUsername, 10);
  if (!isNaN(num)) {
    const u = await userRepository.findById(num);
    if (u) return u;
  }
  return userRepository.findByUsername(idOrUsername);
}

export function requireArg(rawArgs: string[], index: number, usage: string): string | null {
  const val = rawArgs[index];
  if (!val) {
    console.log(`Usage: ${usage}`);
    return null;
  }
  return val;
}

export async function requireUser(rawArgs: string[], usage: string) {
  const target = requireArg(rawArgs, 0, usage);
  if (!target) return null;
  const user = await resolveUser(target);
  if (!user) {
    console.log(`User "${target}" not found.`);
    return null;
  }
  return user;
}

export async function logAudit(action: string, targetId: string, reason: string) {
  try {
    await db.insert(auditLogs).values({
      logId: `AUDIT-CLI-${crypto.randomUUID()}`,
      adminId: 1,
      adminName: 'CLI_ADMIN',
      action,
      targetId: String(targetId),
      reason
    });
  } catch (err) {
    console.log(`${theme.dim}[Audit Log Warning: Failed to record trace: ${(err as Error).message}]${theme.reset}`);
  }
}
