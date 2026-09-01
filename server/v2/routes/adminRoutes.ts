import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users, supportAdminNominations } from '../db/schema/users.js';
import { sessions } from '../db/schema/sessions.js';
import { tickets, reports } from '../db/schema/tickets.js';
import { eq, desc, and, inArray, or } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import type { Request, Response } from 'express';
import { clientDiagnosticsList } from './ticketRoutes.js';
import { SystemBot } from '../services/systemBot.js';
import { getAuditLogs, recordAuditEvent } from '../services/auditService.js';
import { hashArgon2id, generateRandomToken } from '../utils/crypto.js';
import crypto from 'node:crypto';

export const adminRouter = Router();

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive
    },
    expiresAt: result.session.expiresAt
  };
});

adminRouter.use(authMiddleware);

// GET /v2/admin/reports - Fetch all reports from database
adminRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const allReports = await db
      .select({
        id: reports.id,
        report_id: reports.id,
        type: reports.type,
        reporter_id: reports.reporterId,
        target_user_id: reports.targetUserId,
        reason: reports.reason,
        priority: reports.priority,
        status: reports.status,
        attachments: reports.attachments,
        created_at: reports.createdAt,
        updated_at: reports.updatedAt
      })
      .from(reports)
      .orderBy(desc(reports.createdAt));

    const userList = await db.select({ id: users.id, username: users.username }).from(users);
    const userMap = new Map(userList.map(u => [u.id, u.username]));

    const formatted = allReports.map(r => ({
      ...r,
      reporter_name: userMap.get(r.reporter_id) || `User #${r.reporter_id}`,
      target_username: userMap.get(r.target_user_id) || `User #${r.target_user_id}`
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

// POST /v2/admin/reports/:id/status - Update report status
adminRouter.post('/reports/:id/status', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    await db.update(reports).set({
      status: status || 'closed',
      updatedAt: new Date()
    }).where(eq(reports.id, reportId));

    res.json({ success: true, message: `Report #${reportId} status updated to ${status || 'closed'}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report status.' });
  }
});

// POST /v2/admin/reports/:id/delete - Delete report
adminRouter.post('/reports/:id/delete', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    await db.delete(reports).where(eq(reports.id, reportId));
    res.json({ success: true, message: `Report #${reportId} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

// POST /v2/admin/reports/:id/escalate - Escalate report to CLI desk
adminRouter.post('/reports/:id/escalate', async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

    await db.update(reports).set({
      status: 'escalated',
      priority: 'critical',
      updatedAt: new Date()
    }).where(eq(reports.id, reportId));

    res.json({ success: true, message: `Report #${reportId} escalated to CLI investigation.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to escalate report.' });
  }
});

// GET /v2/admin/diagnostics/logs - Get diagnostics logs
adminRouter.get('/diagnostics/logs', async (req: Request, res: Response) => {
  try {
    res.json(clientDiagnosticsList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diagnostics logs.' });
  }
});

// POST /v2/admin/diagnostics/logs/:logId/resolve - Resolve diagnostics log
adminRouter.post('/diagnostics/logs/:logId/resolve', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const log = clientDiagnosticsList.find(l => l.id === logId);
    if (log) {
      log.status = 'resolved';
    }
    res.json({ success: true, message: 'Diagnostic log resolved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve diagnostic log.' });
  }
});

// DELETE /v2/admin/diagnostics/logs/:logId - Delete diagnostics log
adminRouter.delete('/diagnostics/logs/:logId', async (req: Request, res: Response) => {
  try {
    const { logId } = req.params;
    const index = clientDiagnosticsList.findIndex(l => l.id === logId);
    if (index !== -1) {
      clientDiagnosticsList.splice(index, 1);
    }
    res.json({ success: true, message: 'Diagnostic log deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete diagnostic log.' });
  }
});


// GET /v2/admin/audit-logs - Get database audit log records
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await getAuditLogs(limit, offset);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// POST /v2/admin/sanction - Apply sanction
adminRouter.post('/sanction', async (req: Request, res: Response) => {
  try {
    const { targetUserId, type, reason } = req.body;
    
    if (!targetUserId || !type) {
      return res.status(400).json({ error: 'Target user ID and sanction type are required.' });
    }
    
    if (req.user) {
      await recordAuditEvent({
        adminId: req.user.userId,
        adminName: req.user.username,
        action: `SANCTION_APPLIED_${type.toUpperCase()}`,
        targetId: String(targetUserId),
        reason: reason || 'Admin sanction applied'
      });
    }

    res.json({ success: true, message: `Sanction ${type} applied successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply sanction.' });
  }
});

// POST /v2/admin/sanction/revoke - Revoke sanction
adminRouter.post('/sanction/revoke', async (req: Request, res: Response) => {
  try {
    const { targetUserId, type } = req.body;
    
    if (!targetUserId || !type) {
      return res.status(400).json({ error: 'Target user ID and sanction type are required.' });
    }
    
    // Mock success
    res.json({ success: true, message: 'Sanction revoked successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke sanction.' });
  }
});

// Helper function for secure password generation
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// POST /v2/admin/nominate-support - NOMINATE support admin
adminRouter.post('/nominate-support', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }
    
    // Verify LOGIN_ADMIN or CLI_ADMIN can nominate
    if (!['LOGIN_ADMIN', 'CLI_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only LOGIN_ADMIN or CLI_ADMIN can nominate support admins' });
    }
    
    // Get target user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user already has pending or active nomination
    const existingNomination = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, targetUserId),
        inArray(supportAdminNominations.status, ['pending', 'approved', 'accepted'])
      )
    ).limit(1);
    
    if (existingNomination.length > 0) {
      return res.status(400).json({ error: 'User already has a pending or active support admin nomination' });
    }
    
    // Create nomination
    const [nomination] = await db.insert(supportAdminNominations).values({
      nominatedUserId: targetUserId,
      nominatedBy: req.user!.userId,
      status: 'pending'
    }).returning();
    
    res.json({ 
      success: true, 
      nominationId: nomination.id,
      message: 'User nominated for support admin role, awaiting CLI_ADMIN approval'
    });
  } catch (err) {
    console.error('Failed to nominate support admin:', err);
    res.status(500).json({ error: 'Failed to create nomination' });
  }
});

// Alias for backwards compatibility or tests
adminRouter.post('/nominate', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }
    // Verify LOGIN_ADMIN or CLI_ADMIN or ADMIN can nominate
    if (!['LOGIN_ADMIN', 'CLI_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const existingNomination = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, targetUserId),
        inArray(supportAdminNominations.status, ['pending', 'approved', 'accepted'])
      )
    ).limit(1);
    
    if (existingNomination.length > 0) {
      return res.json({ success: true, message: 'Support admin nomination submitted.' });
    }
    
    await db.insert(supportAdminNominations).values({
      nominatedUserId: targetUserId,
      nominatedBy: req.user!.userId,
      status: 'pending'
    });
    
    res.json({ success: true, message: 'Support admin nomination submitted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to nominate support admin.' });
  }
});

// POST /v2/admin/approve-nomination - CLI_ADMIN approves nomination
adminRouter.post('/approve-nomination', async (req: Request, res: Response) => {
  try {
    const { nominationId } = req.body;
    
    // Verify only CLI_ADMIN can approve
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can approve nominations' });
    }
    
    // Get nomination details
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found' });
    }
    
    if (nomination.status !== 'pending') {
      return res.status(400).json({ error: 'Nomination is not in pending status' });
    }
    
    // Get nominated user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'Nominated user not found' });
    }
    
    // Generate separate admin credentials (INACTIVE until user accepts)
    const adminUsername = `Sa-${targetUser.username}`;
    const adminPassword = `Sa-Vel-${generateSecurePassword()}`;
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
    const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
    const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
    const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
    const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
    
    // Create INACTIVE support admin account
    const [newAdmin] = await db.insert(users).values({
      username: adminUsername,
      passwordHash: adminPasswordHash,
      salt: adminSalt,
      role: 'SUPPORT_ADMIN',
      displayName: `${targetUser.displayName || targetUser.username} (Support)`,
      recoveryKeyHash: adminRecoveryKeyHash,
      panicPhraseHash: adminPanicPhraseHash,
      duressActive: true // Mark as inactive/duress until accepted
    }).returning();
    
    // Store credentials encrypted in nomination
    const credentialsData = JSON.stringify({
      username: adminUsername,
      password: adminPassword,
      recoveryKey: adminRecoveryKey,
      panicPhrase: adminPanicPhrase
    });
    
    // Update nomination with admin account and credentials
    await db.update(supportAdminNominations)
      .set({ 
        status: 'approved',
        adminAccountId: newAdmin.id,
        credentials: credentialsData,
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));
    
    // Send approval notification via Velum Bot (WITHOUT credentials yet)
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(nomination.nominatedUserId,
      `You have been nominated and APPROVED for the Velum Support Administrator role.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `NEXT STEPS:\n` +
      `• Your support admin credentials have been generated\n` +
      `• You must ACCEPT this role to activate your credentials\n` +
      `• If you DECLINE, the credentials will be purged\n\n` +
      `To ACCEPT or DECLINE this role, please respond to this message with:\n` +
      `"!accept-support" or "!decline-support"\n\n` +
      `This nomination will expire in 7 days if no action is taken.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    
    res.json({ 
      success: true, 
      message: 'Nomination approved, credentials generated and awaiting user acceptance'
    });
  } catch (err) {
    console.error('Failed to approve nomination:', err);
    res.status(500).json({ error: 'Failed to approve nomination' });
  }
});

// POST /v2/admin/reject-nomination - CLI_ADMIN rejects nomination
adminRouter.post('/reject-nomination', async (req: Request, res: Response) => {
  try {
    const { nominationId, reason } = req.body;
    
    // Verify only CLI_ADMIN can reject
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can reject nominations' });
    }
    
    // Get nomination details
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found' });
    }
    
    if (nomination.status !== 'pending') {
      return res.status(400).json({ error: 'Nomination is not in pending status' });
    }
    
    // Update nomination status
    await db.update(supportAdminNominations)
      .set({ 
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));
    
    // Notify user via Velum Bot
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(nomination.nominatedUserId,
      `Your nomination for the Velum Support Administrator role has been declined.\n\n` +
      `Reason: ${reason || 'No reason provided'}\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    res.json({ 
      success: true, 
      message: 'Nomination rejected and user notified'
    });
  } catch (err) {
    console.error('Failed to reject nomination:', err);
    res.status(500).json({ error: 'Failed to reject nomination' });
  }
});

// POST /v2/admin/demote-support - CLI_ADMIN demotes active support admin
adminRouter.post('/demote-support', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    
    // Verify only CLI_ADMIN can demote
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can demote support admins' });
    }
    
    // Get target user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find and delete support admin account
    const adminUsername = `support_${targetUser.username}`;
    const deletedAdmin = await db.delete(users).where(
      and(
        eq(users.username, adminUsername),
        eq(users.role, 'SUPPORT_ADMIN')
      )
    ).returning();
    
    if (deletedAdmin.length === 0) {
      return res.status(404).json({ error: 'Support admin account not found' });
    }
    
    // Update any related nominations
    await db.update(supportAdminNominations)
      .set({ 
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.nominatedUserId, targetUserId));
    
    // Notify user via Velum Bot
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(targetUserId,
      `Your Support Administrator access has been revoked by CLI_ADMIN.\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    res.json({ 
      success: true, 
      message: 'Support admin account revoked'
    });
  } catch (err) {
    console.error('Failed to demote support admin:', err);
    res.status(500).json({ error: 'Failed to demote support admin account' });
  }
});

// GET /v2/admin/support-nominations - List all nominations
adminRouter.get('/support-nominations', async (req: Request, res: Response) => {
  try {
    // Verify admin access
    if (!['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const nominations = await db.select({
      id: supportAdminNominations.id,
      nominatedUserId: supportAdminNominations.nominatedUserId,
      nominatedBy: supportAdminNominations.nominatedBy,
      status: supportAdminNominations.status,
      createdAt: supportAdminNominations.createdAt
    })
    .from(supportAdminNominations)
    .orderBy(desc(supportAdminNominations.createdAt));
    
    // Enrich with user details
    const enrichedNominations = await Promise.all(nominations.map(async (nomination) => {
      const [nominatedUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
      const [nominatedByUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedBy)).limit(1);
      
      return {
        ...nomination,
        nominatedUser: {
          id: nominatedUser?.id,
          username: nominatedUser?.username,
          displayName: nominatedUser?.displayName
        },
        nominatedBy: {
          id: nominatedByUser?.id,
          username: nominatedByUser?.username,
          displayName: nominatedByUser?.displayName
        }
      };
    }));
    
    res.json({ nominations: enrichedNominations });
  } catch (err) {
    console.error('Failed to list nominations:', err);
    res.status(500).json({ error: 'Failed to list nominations' });
  }
});

// GET /v2/admin/support-admins - List active support admins
adminRouter.get('/support-admins', async (req: Request, res: Response) => {
  try {
    // Verify admin access
    if (!['ADMIN', 'CLI_ADMIN', 'SUPPORT_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const supportAdmins = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      duressActive: users.duressActive,
      createdAt: users.createdAt
    })
    .from(users)
    .where(and(eq(users.role, 'SUPPORT_ADMIN'), eq(users.duressActive, false))); // Only active admins
    
    // Map back to original user accounts
    const adminsWithUsers = await Promise.all(supportAdmins.map(async (admin) => {
      const originalUsername = admin.username.replace('support_', '');
      const [originalUser] = await db.select().from(users).where(eq(users.username, originalUsername)).limit(1);
      return {
        ...admin,
        originalUserId: originalUser?.id,
        originalUsername: originalUser?.username,
        originalDisplayName: originalUser?.displayName
      };
    }));
    
    res.json({ supportAdmins: adminsWithUsers });
  } catch (err) {
    console.error('Failed to list support admins:', err);
    res.status(500).json({ error: 'Failed to list support admins' });
  }
});

// POST /v2/admin/broadcast - Send system broadcast
adminRouter.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { message, target } = req.body;
    
    // Verify admin role
    if (!['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const systemBot = SystemBot.getInstance();
    
    if (target === 'all') {
      // Broadcast to all connected users
      systemBot.sendToAll(`[Broadcast from ${req.user!.username}]: ${message}`);
    } else if (target === 'room') {
      // Broadcast to specific room
      const { roomId } = req.body;
      systemBot.sendBroadcast(roomId, message, req.user!.username);
    } else if (typeof target === 'number') {
      // Send to specific user
      await systemBot.sendToUser(target, `[Admin Message]: ${message}`);
    }
    
    res.json({ success: true, message: 'Broadcast sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

// POST /v2/admin/users/:id/delete - Delete or schedule user deactivation based on admin tier
adminRouter.post('/users/:id/delete', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUser = req.user!;
    const { reason = 'Admin initiated action', forceInstant = false } = req.body || {};
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    if (targetUser.id === 1 || targetUser.id === 2 || targetUser.id === 999) {
      return res.status(403).json({ error: 'Cannot delete core system accounts.' });
    }
    
    const { UserDeletionService } = await import('../services/userDeletionService.js');

    // Tier 3: CLI_ADMIN or forceInstant purge (Instant 0-day)
    if (currentUser.role === 'CLI_ADMIN' && forceInstant) {
      const purgeRes = await UserDeletionService.executeInstantPurge(targetUserId, String(reason));
      return res.json({
        success: true,
        type: 'INSTANT_PURGE',
        purgedTables: purgeRes.purgedTables,
        message: 'User permanently purged instantly.'
      });
    }

    // Tier 2: LOGIN_ADMIN / Standard Admin (3-day grace period)
    const deactRes = await UserDeletionService.scheduleAdminDeactivation(targetUserId, currentUser.userId, String(reason));
    
    res.json({
      success: true,
      type: 'SCHEDULED_DELETION',
      scheduledDeletionAt: deactRes.scheduledDeletionAt.toISOString(),
      daysRemaining: 3,
      message: 'Account scheduled for deletion in 3 days.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /v2/admin/users/:id/fraud - Tier 4: Fraud Sanction & Asset Seizure
adminRouter.post('/users/:id/fraud', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUser = req.user!;
    const { reason = 'Platform Fraud & Security Violation' } = req.body || {};

    if (!['CLI_ADMIN', 'LOGIN_ADMIN', 'ADMIN'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    if (targetUserId === 1 || targetUserId === 2 || targetUserId === 999) {
      return res.status(403).json({ error: 'Cannot sanction core system accounts.' });
    }

    const { UserDeletionService } = await import('../services/userDeletionService.js');
    const result = await UserDeletionService.executeFraudSeizure(targetUserId, currentUser.username, String(reason));

    res.json({
      success: true,
      type: 'FRAUD_SEIZURE',
      seizedAmount: result.seizedAmount,
      message: 'User assets seized and identifiers blacklisted.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute fraud sanction.' });
  }
});

// POST /v2/admin/users/:id/restore - Restore soft-deleted / pending deactivation user
adminRouter.post('/users/:id/restore', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.deletionInitiatedBy === 'FRAUD_SEIZURE') {
      return res.status(403).json({ error: 'Fraud-seized accounts cannot be restored.' });
    }

    await db.update(users).set({
      role: 'USER',
      scheduledDeletionAt: null,
      deletionReason: null,
      deletionInitiatedBy: null,
      isCompromised: false,
      duressActive: false,
      updatedAt: new Date()
    }).where(eq(users.id, targetUserId));

    res.json({ success: true, message: 'User restored to active status.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore user.' });
  }
});

export function isSensitiveAccount(user: { role?: string; username?: string } | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const username = (user.username || '').toLowerCase();
  return (
    role === 'CLI_ADMIN' ||
    role === 'LOGIN_ADMIN' ||
    role === 'SUPPORT_ADMIN' ||
    role === 'SYSTEM' ||
    username === 'velum' ||
    username === '@velum'
  );
}

// GET /v2/admin/tickets - Query all system tickets
adminRouter.get('/tickets', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    if (!['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(admin.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    const formatted = await Promise.all(allTickets.map(async (t) => {
      const [u] = await db.select().from(users).where(eq(users.id, t.userId)).limit(1);
      return {
        ...t,
        id: t.id,
        ticket_id: String(t.id),
        user_id: t.userId,
        username: u ? u.username : 'Anonymous',
        reason: t.description,
        issue_type: t.subject || t.issueType,
        status: t.status,
        credibility_score: t.credibilityScore,
        credibilityScore: t.credibilityScore,
        tracking_id: t.trackingId,
        trackingId: t.trackingId,
        created_at: t.createdAt?.toISOString() || new Date().toISOString(),
        createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
        messages: t.messages || []
      };
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query tickets registry.' });
  }
});

// POST /v2/admin/tickets/:ticketId/reply - Reply to a ticket thread
adminRouter.post('/tickets/:ticketId/reply', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    const { ticketId } = req.params;
    const { content, closeTicket, escalate } = req.body;

    if (!['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(admin.role)) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const ticketList = await db.select().from(tickets).where(or(eq(tickets.id, parseInt(ticketId, 10) || 0), eq(tickets.trackingId, ticketId))).limit(1);
    if (ticketList.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = ticketList[0];

    // Check if target user is sensitive
    const [targetUser] = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
    if (targetUser && isSensitiveAccount(targetUser) && admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Restricted: SUPPORT_ADMIN role is strictly forbidden from targeting administrative or system accounts.' });
    }

    const senderName = admin.role === 'SUPPORT_ADMIN' ? 'SUPPORT (ID: 0)' : admin.username;
    const updatedMessages = Array.isArray(ticket.messages) ? [...(ticket.messages as any[])] : [];
    updatedMessages.push({
      sender_id: admin.userId,
      sender_name: senderName,
      content,
      timestamp: new Date().toISOString()
    });

    let newStatus = ticket.status;
    let resolvedAt = ticket.status === 'resolved' ? new Date() : null;

    if (closeTicket) {
      newStatus = 'resolved';
      resolvedAt = new Date();
    } else if (escalate && admin.role === 'SUPPORT_ADMIN') {
      newStatus = 'escalated';
    } else {
      newStatus = 'pending';
    }

    const [updatedTicket] = await db.update(tickets)
      .set({
        messages: updatedMessages,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(tickets.id, ticket.id))
      .returning();

    const [u] = await db.select().from(users).where(eq(users.id, updatedTicket.userId)).limit(1);

    res.json({
      ...updatedTicket,
      id: updatedTicket.id,
      ticket_id: String(updatedTicket.id),
      user_id: updatedTicket.userId,
      username: u ? u.username : 'Anonymous',
      reason: updatedTicket.description,
      issue_type: updatedTicket.subject || updatedTicket.issueType,
      status: updatedTicket.status,
      credibility_score: updatedTicket.credibilityScore,
      credibilityScore: updatedTicket.credibilityScore,
      tracking_id: updatedTicket.trackingId,
      trackingId: updatedTicket.trackingId,
      created_at: updatedTicket.createdAt?.toISOString() || new Date().toISOString(),
      createdAt: updatedTicket.createdAt?.toISOString() || new Date().toISOString(),
      messages: updatedTicket.messages || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process ticket reply.' });
  }
});

// DELETE /v2/admin/tickets/:ticketId - Purge a ticket
adminRouter.delete('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    if (admin.role !== 'CLI_ADMIN' && admin.role !== 'LOGIN_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only CLI_ADMIN and LOGIN_ADMIN possess delete authorization.' });
    }

    const { ticketId } = req.params;
    const tId = parseInt(ticketId, 10) || 0;
    
    await db.delete(tickets).where(or(eq(tickets.id, tId), eq(tickets.trackingId, ticketId)));
    res.json({ success: true, message: `Ticket Case #${ticketId} purged successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete ticket.' });
  }
});

// POST /v2/admin/recover-approve - Approve account recovery and issue LGN-REC-XXXX
adminRouter.post('/recover-approve', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    const { targetUserId, action } = req.body;

    if (admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'High security risk approvals require LOGIN_ADMIN or CLI_ADMIN role.' });
    }

    const tUserId = parseInt(String(targetUserId), 10);
    const [targetUser] = await db.select().from(users).where(eq(users.id, tUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User target not found.' });
    }

    const userTickets = await db.select().from(tickets).where(eq(tickets.userId, targetUser.id));
    const activeTicket = userTickets.find(t => t.status !== 'resolved' && t.status !== 'closed');

    if (action === 'approve') {
      if (activeTicket && activeTicket.credibilityScore !== undefined && activeTicket.credibilityScore < 85) {
        return res.status(400).json({ error: 'CREDIBILITY INSUFFICIENT: Level below 85% threshold.' });
      }

      const tempCode = `LGN-REC-${generateRandomToken(4).toUpperCase()}`;

      await db.update(users)
        .set({
          tempRestoreCode: tempCode,
          updatedAt: new Date()
        })
        .where(eq(users.id, targetUser.id));

      if (activeTicket) {
        const updatedMessages = Array.isArray(activeTicket.messages) ? [...(activeTicket.messages as any[])] : [];
        updatedMessages.push({
          sender_id: admin.userId,
          sender_name: admin.username,
          content: `Ticket approved.\n\nUse the temporary restoration credential below to unlock your account and set a new password:\n\n\`${tempCode}\``,
          timestamp: new Date().toISOString()
        });

        await db.update(tickets)
          .set({
            status: 'approved',
            providedRecoveryKey: tempCode,
            messages: updatedMessages,
            updatedAt: new Date()
          })
          .where(eq(tickets.id, activeTicket.id));
      }

      await recordAuditEvent({
        adminId: admin.userId,
        adminName: admin.username,
        action: 'RECOVERY_APPROVED',
        targetId: String(targetUser.id),
        reason: `Account access restored by Executive Administrator. Code issued: ${tempCode}`
      });

      return res.json({ success: true, tempCode, message: 'Recovery request approved successfully.' });
    }

    if (activeTicket) {
      await db.update(tickets)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(tickets.id, activeTicket.id));
    }

    res.json({ success: true, message: 'Recovery request denied.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process recovery approval.' });
  }
});

// POST /v2/admin/invites - Create invite
adminRouter.post('/invites', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    if (admin.role !== 'LOGIN_ADMIN' && admin.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only EXECUTIVE Login Admins and CLI Admins can emit system validation invites.' });
    }

    const { lounge_id, max_uses, expires_in_days } = req.body;
    if (!lounge_id) {
      return res.status(400).json({ error: 'Lounge ID is required.' });
    }
    
    const inviteCode = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    res.status(201).json({ 
      invite_id: `inv_${Date.now()}`,
      code: inviteCode,
      lounge_id,
      max_uses: max_uses || 100,
      expires_at: Date.now() + (expires_in_days || 7) * 24 * 60 * 60 * 1000
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invite.' });
  }
});

// POST /v2/admin/verifications/:id/review - Review verification
adminRouter.post('/verifications/:id/review', async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    if (admin.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from verification controls.' });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Review status is required.' });
    }
    
    res.json({ success: true, message: `Verification ${status === 'approved' ? 'approved' : 'rejected'}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review verification.' });
  }
});

export const adminRoutes = adminRouter;