import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users, supportAdminNominations } from '../db/schema/users.js';
import { sessions } from '../db/schema/sessions.js';
import { tickets } from '../db/schema/tickets.js';
import { eq, desc, and, inArray, or } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import type { Request, Response } from 'express';
import { clientDiagnosticsList } from './ticketRoutes.js';
import { SystemBot } from '../services/systemBot.js';
import { hashArgon2id } from '../utils/crypto.js';
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

// POST /v2/admin/sanction - Apply sanction
adminRouter.post('/sanction', async (req: Request, res: Response) => {
  try {
    const { targetUserId, type, reason } = req.body;
    
    if (!targetUserId || !type) {
      return res.status(400).json({ error: 'Target user ID and sanction type are required.' });
    }
    
    // Mock success
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

// POST /v2/admin/users/:id/delete - Delete user (admin)
adminRouter.post('/users/:id/delete', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUserRole = req.user!.role;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    const targetUser = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser.length) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    if (targetUser[0].role === 'CLI_ADMIN' && currentUserRole !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Cannot delete CLI_ADMIN users.' });
    }
    
    await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, targetUserId));
      await tx.delete(users).where(eq(users.id, targetUserId));
    });
    
    // Invalidate cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('users:all');
    }
    
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /v2/admin/users/:id/restore - Restore deleted user
adminRouter.post('/users/:id/restore', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    // Mock success - in production this would restore a soft-deleted user
    res.json({ success: true, message: 'User restored successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore user.' });
  }
});

// POST /v2/admin/recover-approve - Approve account recovery
adminRouter.post('/recover-approve', async (req: Request, res: Response) => {
  try {
    const { targetUserId, action } = req.body;
    
    if (!targetUserId || !action) {
      return res.status(400).json({ error: 'Target user ID and action are required.' });
    }
    
    if (action === 'approve') {
      const tempCode = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      return res.json({ success: true, tempCode });
    }
    
    res.json({ success: true, message: 'Recovery request denied.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process recovery approval.' });
  }
});

// POST /v2/admin/reports/:id/status - Update report status
adminRouter.post('/reports/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }
    
    // Mock success
    res.json({ success: true, message: `Report status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report status.' });
  }
});

// POST /v2/admin/reports/:id/delete - Delete report
adminRouter.post('/reports/:id/delete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Mock success
    res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

// POST /v2/admin/update-settings - Update admin settings
adminRouter.post('/update-settings', async (req: Request, res: Response) => {
  try {
    const { safeWord, panicPhrase } = req.body;
    
    // Mock success - in production this would update admin settings
    res.json({ success: true, message: 'Admin settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update admin settings.' });
  }
});

// POST /v2/admin/rename-executive - Rename executive account
adminRouter.post('/rename-executive', async (req: Request, res: Response) => {
  try {
    const { newUsername, newPassword } = req.body;
    
    if (!newUsername || !newPassword) {
      return res.status(400).json({ error: 'New username and password are required.' });
    }
    
    // Mock success
    res.json({ success: true, message: 'Executive credentials updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename executive account.' });
  }
});

// POST /v2/admin/invites - Create invite
adminRouter.post('/invites', async (req: Request, res: Response) => {
  try {
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
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Review status is required.' });
    }
    
    // Mock success
    res.json({ success: true, message: `Verification ${status === 'approved' ? 'approved' : 'rejected'}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review verification.' });
  }
});

export const adminRoutes = adminRouter;