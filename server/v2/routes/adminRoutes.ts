import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { sessions } from '../db/schema/sessions.js';
import { tickets } from '../db/schema/tickets.js';
import { eq, desc } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import type { Request, Response } from 'express';
import { clientDiagnosticsList } from './ticketRoutes.js';

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

// POST /v2/admin/nominate - Nominate support admin
adminRouter.post('/nominate', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }
    
    // Mock success
    res.json({ success: true, message: 'Support admin nomination submitted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to nominate support admin.' });
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