import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { dmService } from '../services/dmService.js';
import { blockedSendErrorMessage } from '../utils/blockCopy.js';
import { logger } from '../utils/logger.js';
import { getDmRoomAliases, resetUnread } from '../../websocket/unreadManager.js';
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
    
    // Automatically mark incoming messages as read and clear Redis unread aliases
    const primaryRoom = peerId === 999 ? `dm_velum_${userId}` : `dm_${peerId}`;
    Promise.all([
      dmService.markAsRead(userId, peerId),
      resetUnread(userId, primaryRoom)
    ]).catch(err => {
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
    const { body, encrypted, replyTo, expires_in: expiresInBody } = req.body;

    if (isNaN(peerId) || peerId <= 0) {
      return res.status(400).json({ error: 'Invalid peer user ID' });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Message body cannot be empty' });
    }

    const expiresInRaw = expiresInBody != null ? Number(expiresInBody) : null;
    const expiresIn =
      expiresInRaw != null && Number.isFinite(expiresInRaw) && expiresInRaw > 0
        ? Math.min(expiresInRaw, 7 * 24 * 60 * 60)
        : null;

    const message = await dmService.sendMessage(
      userId,
      peerId,
      body.trim(),
      !!encrypted,
      replyTo ? parseInt(replyTo, 10) : undefined,
      expiresIn
    );

    res.status(201).json({ message });
  } catch (err) {
    const blocked = (err as Error & { code?: string })?.code === 'BLOCKED' || (err as Error)?.message === 'BLOCKED';
    if (blocked) {
      const reason = (err as Error & { blockReason?: string }).blockReason;
      return res.status(403).json({
        error: blockedSendErrorMessage(reason),
        code: 'BLOCKED',
        blockReason: reason || 'peer',
      });
    }
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

    try {
      const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
      const aliases = getDmRoomAliases(peerId, userId);
      for (const room_id of aliases) {
        broadcastToUserDevices(userId, {
          type: 'room_cleared',
          room_id,
          peer_id: peerId,
          cleared_till_id: lastId
        });
      }
    } catch (wsErr) {
      logger.warn('Failed to broadcast room_cleared event', { error: (wsErr as Error).message });
    }

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
