import { Router } from 'express';
import { db } from '../db/client.js';
import { tickets } from '../db/schema/tickets.js';
import { users } from '../db/schema/users.js';
import { eq, or } from 'drizzle-orm';
import type { Request, Response } from 'express';

export const userPublicRouter = Router();

// GET /v2/public/tickets/:trackingId - Unauthenticated public ticket tracking lookup
userPublicRouter.get('/tickets/:trackingId', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;

    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required.' });
    }

    const numericId = parseInt(trackingId, 10) || 0;

    // Search by trackingId or compromiseTicketId on users table
    let ticketResult = await db.select().from(tickets).where(
      or(
        eq(tickets.trackingId, trackingId),
        eq(tickets.id, numericId)
      )
    ).limit(1);

    if (ticketResult.length === 0) {
      // Try searching for user with matching compromiseTicketId
      const targetUsers = await db.select().from(users).where(eq(users.compromiseTicketId, trackingId)).limit(1);
      if (targetUsers.length > 0) {
        ticketResult = await db.select().from(tickets).where(eq(tickets.userId, targetUsers[0].id)).limit(1);
      }
    }

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: 'Ticket not located.' });
    }

    const ticket = ticketResult[0];

    res.json({
      ticket_id: ticket.id.toString(),
      ticketId: ticket.id.toString(),
      userId: ticket.userId,
      subject: ticket.subject,
      description: ticket.description,
      issue_type: ticket.issueType,
      status: ticket.status,
      credibility_score: ticket.credibilityScore,
      tracking_id: ticket.trackingId,
      provided_recovery_key: ticket.providedRecoveryKey,
      messages: ticket.messages || [],
      created_at: ticket.createdAt,
      updated_at: ticket.updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query ticket tracking state.' });
  }
});

// POST /v2/public/tickets/:trackingId/reply - Unauthenticated public ticket reply
userPublicRouter.post('/tickets/:trackingId/reply', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    const { content, senderName } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const numericId = parseInt(trackingId, 10) || 0;

    let ticketResult = await db.select().from(tickets).where(
      or(
        eq(tickets.trackingId, trackingId),
        eq(tickets.id, numericId)
      )
    ).limit(1);

    if (ticketResult.length === 0) {
      const targetUsers = await db.select().from(users).where(eq(users.compromiseTicketId, trackingId)).limit(1);
      if (targetUsers.length > 0) {
        ticketResult = await db.select().from(tickets).where(eq(tickets.userId, targetUsers[0].id)).limit(1);
      }
    }

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: 'Ticket not located.' });
    }

    const ticket = ticketResult[0];
    const updatedMessages = Array.isArray(ticket.messages) ? [...(ticket.messages as any[])] : [];

    updatedMessages.push({
      sender_id: ticket.userId,
      sender_name: senderName || 'Client',
      content,
      timestamp: new Date().toISOString()
    });

    await db.update(tickets)
      .set({
        messages: updatedMessages,
        status: ticket.status === 'open' ? 'open' : 'pending',
        updatedAt: new Date()
      })
      .where(eq(tickets.id, ticket.id));

    res.json({
      success: true,
      ticket: {
        ticket_id: ticket.id.toString(),
        ticketId: ticket.id.toString(),
        status: ticket.status,
        messages: updatedMessages
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to append ticket reply.' });
  }
});

export const userPublicRoutes = userPublicRouter;