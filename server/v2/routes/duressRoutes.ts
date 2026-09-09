import { Router } from 'express';
import { executeEmergencyWipe } from '../services/duress/panicService.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Request, Response } from 'express';

export const duressRouter = Router();

// POST /panic - Manual emergency trigger from Settings
duressRouter.post('/panic', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await executeEmergencyWipe(userId, 'MANUAL_SETTINGS_TRIGGER');
    res.json({
      success: true,
      ticketId: result.ticketId,
      message: 'Emergency wipe executed.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute emergency wipe.' });
  }
});
