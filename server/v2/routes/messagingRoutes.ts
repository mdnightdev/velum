import { Router, Request, Response, NextFunction } from 'express';
import { auth } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { loungeRepository } from '../repositories/loungeRepository.js';
import { safeParseInt } from '../utils/validation.js';
import { processReadReceipt } from '../services/messaging/readReceiptService.js';
import { processDeliveryReceipt } from '../services/messaging/deliveryReceiptService.js';
import { typingDebouncer } from '../services/messaging/typingDebouncer.js';

export const messagingRouter = Router();

// POST /v2/lounges/:id/read - Read cursor synchronization endpoint
messagingRouter.post('/lounges/:id/read', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const currentUserId = req.user!.userId;
    const { last_read_msg_id, last_read_seq } = req.body;

    const lastReadMsgId = safeParseInt(last_read_msg_id, 0);
    const lastReadSeq = last_read_seq ? safeParseInt(last_read_seq, 0) : undefined;

    if (lastReadMsgId <= 0 && (!lastReadSeq || lastReadSeq <= 0)) {
      return res.status(400).json({ error: 'Valid last_read_msg_id or last_read_seq is required.' });
    }

    const allLounges = await loungeRepository.findAll();
    const targetLounge = allLounges.find(l => l.slug === rawId || l.id.toString() === rawId);

    if (!targetLounge) {
      return res.status(404).json({ error: 'Lounge not found.' });
    }

    const result = await processReadReceipt(
      currentUserId,
      targetLounge.id,
      lastReadMsgId,
      lastReadSeq
    );

    res.json({
      status: 'ok',
      read_cursor: {
        room_id: rawId,
        lounge_id: targetLounge.id,
        user_id: currentUserId,
        last_read_msg_id: result.lastReadMsgId,
        last_read_seq: result.lastReadSeq,
        timestamp: result.timestamp
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /v2/messaging/delivery - Single/Batch delivery receipt confirmation
messagingRouter.post('/messaging/delivery', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const { message_id } = req.body;

    const msgId = parseInt(message_id, 10);
    if (isNaN(msgId)) {
      return res.status(400).json({ error: 'Valid message_id is required.' });
    }

    const result = await processDeliveryReceipt(msgId, currentUserId);

    res.json({
      status: 'ok',
      receipt: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /v2/messaging/typing - Ephemeral typing state trigger
messagingRouter.post('/messaging/typing', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const { room_id, is_typing } = req.body;

    if (!room_id) {
      return res.status(400).json({ error: 'room_id is required.' });
    }

    const username = req.user!.username || `User_${currentUserId}`;

    if (is_typing !== false) {
      typingDebouncer.registerTyping(room_id, currentUserId, username);
    } else {
      typingDebouncer.clearTyping(room_id, currentUserId);
    }

    res.json({ status: 'ok', active_typers: typingDebouncer.getActiveTypers(room_id) });
  } catch (err) {
    next(err);
  }
});
