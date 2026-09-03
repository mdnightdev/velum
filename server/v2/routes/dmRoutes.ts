import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { dmService } from '../services/dmService.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

export const dmRouter = Router();

dmRouter.use(authMiddleware);

// GET /v2/dm/:peer - Fetch direct messages with a user
dmRouter.get('/:peer', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const peerId = parseInt(req.params.peer, 10);

    if (isNaN(peerId) || peerId <= 0) {
      return res.status(400).json({ error: 'Invalid peer user ID' });
    }

    const messages = await dmService.getConversation(userId, peerId);
    
    // Automatically mark incoming messages as read
    dmService.markAsRead(userId, peerId).catch(err => {
      logger.debug('Failed to mark DMs as read', { error: (err as Error).message });
    });

    res.json({ messages });
  } catch (err) {
    logger.error('Failed to fetch direct messages', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// POST /v2/dm/:peer - Send direct message
dmRouter.post('/:peer', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const peerId = parseInt(req.params.peer, 10);
    const { body, encrypted, replyTo } = req.body;

    if (isNaN(peerId) || peerId <= 0) {
      return res.status(400).json({ error: 'Invalid peer user ID' });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Message body cannot be empty' });
    }

    const message = await dmService.sendMessage(
      userId,
      peerId,
      body.trim(),
      !!encrypted,
      replyTo ? parseInt(replyTo, 10) : undefined
    );

    res.status(201).json({ message });
  } catch (err) {
    logger.error('Failed to send direct message', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE /v2/dm/:peer - Clear direct message conversation for requesting user
dmRouter.delete('/:peer', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const peerId = parseInt(req.params.peer, 10);

    if (isNaN(peerId) || peerId <= 0) {
      return res.status(400).json({ error: 'Invalid peer user ID' });
    }

    const { lastId } = await dmService.clearConversation(userId, peerId);

    res.json({
      success: true,
      clearedTillId: lastId,
      message: 'Conversation cleared'
    });
  } catch (err) {
    logger.error('Failed to clear direct messages', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
});
