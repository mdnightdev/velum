import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { tickets, Ticket } from '../db/schema/tickets.js';
import { eq, desc } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import type { Request, Response } from 'express';

export const ticketRouter = Router();

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

ticketRouter.use(authMiddleware);

ticketRouter.get('/admin/tickets', authMiddleware, async (req: Request, res: Response) => {
  const allTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  
  const formatted = allTickets.map((t: Ticket) => ({
    id: t.id,
    ticket_id: String(t.id),
    user_id: t.userId,
    username: req.user!.username,
    reason: t.subject,
    issue_type: t.subject,
    status: t.status,
    created_at: t.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
    messages: []
  }));
  
  res.json(formatted);
});

ticketRouter.post('/tickets', authMiddleware, async (req: Request, res: Response) => {
  const { reason, issueType, credentialsForwarded } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Reason is required.' });
  }
  
  const [newTicket] = await db.insert(tickets).values({
    userId: req.user!.userId,
    subject: issueType || 'general_support',
    description: reason,
    status: 'OPEN'
  }).returning();
  
  const formatted = {
    ticket_id: String(newTicket.id),
    user_id: newTicket.userId,
    reason: newTicket.description,
    issue_type: newTicket.subject,
    status: newTicket.status,
    created_at: newTicket.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: newTicket.createdAt?.toISOString() || new Date().toISOString(),
    messages: []
  };
  
  res.status(201).json(formatted);
});

ticketRouter.get('/user/tickets', authMiddleware, async (req: Request, res: Response) => {
  const userTickets = await db.select().from(tickets).where(eq(tickets.userId, req.user!.userId)).orderBy(desc(tickets.createdAt));
  
  const formatted = userTickets.map((t: Ticket) => ({
    ticket_id: String(t.id),
    id: String(t.id),
    user_id: t.userId,
    reason: t.description,
    issue_type: t.subject,
    status: t.status,
    created_at: t.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
    credentials_forwarded: null,
    messages: []
  }));
  
  res.json(formatted);
});

ticketRouter.delete('/user/tickets/:ticketId', authMiddleware, async (req: Request, res: Response) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  
  const ticket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket.length) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }
  
  if (ticket[0].userId !== req.user!.userId && req.user!.role !== 'CLI_ADMIN' && req.user!.role !== 'SUPPORT_ADMIN') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  
  await db.delete(tickets).where(eq(tickets.id, ticketId));
  
  res.json({ message: 'Ticket deleted successfully.' });
});

ticketRouter.post('/user/tickets/:ticketId/close', authMiddleware, async (req: Request, res: Response) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  
  const ticket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket.length) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }
  
  if (ticket[0].userId !== req.user!.userId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  
  await db.update(tickets).set({ status: 'RESOLVED', updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  
  res.json({ message: 'Ticket marked as closed.' });
});

ticketRouter.post('/user/tickets/:ticketId/reply', authMiddleware, async (req: Request, res: Response) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Reply content is required.' });
  }
  
  const ticket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket.length) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }
  
  await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  
  res.json({ message: 'Reply submitted successfully.' });
});

ticketRouter.post('/admin/tickets/:ticketId/reply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const { closeTicket, escalate } = req.body;

    const ticketList = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (!ticketList.length) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    let newStatus = 'OPEN';
    if (closeTicket) {
      newStatus = 'RESOLVED';
    } else if (escalate) {
      newStatus = 'ESCALATED';
    } else {
      newStatus = 'IN_PROGRESS';
    }

    const [updated] = await db.update(tickets).set({
      status: newStatus,
      updatedAt: new Date()
    }).where(eq(tickets.id, ticketId)).returning();

    const formatted = {
      id: updated.id,
      ticket_id: String(updated.id),
      user_id: updated.userId,
      username: req.user!.username,
      reason: updated.subject,
      issue_type: updated.subject,
      status: updated.status,
      created_at: updated.createdAt?.toISOString() || new Date().toISOString(),
      createdAt: updated.createdAt?.toISOString() || new Date().toISOString(),
      messages: []
    };

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit ticket reply.' });
  }
});

export const clientDiagnosticsList: any[] = [];

ticketRouter.post('/support/diagnostics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const logId = `diag_${Date.now()}`;
    const newLog = {
      id: logId,
      user_id: req.user!.userId,
      username: req.user!.username,
      status: 'pending',
      app_version: payload.app_version || '2.0.0',
      ip_address: req.ip || '127.0.0.1',
      screen_resolution: payload.screen_resolution || '1920x1080',
      device_pixel_ratio: payload.device_pixel_ratio || 1,
      viewport_size: payload.viewport_size || '1920x1080',
      online_status: payload.online_status !== undefined ? payload.online_status : true,
      connection_type: payload.connection_type || 'unknown',
      storage_summary: payload.storage_summary || {},
      user_agent: payload.user_agent || req.headers['user-agent'] || 'Unknown',
      created_at: new Date().toISOString(),
      notes: payload.notes || '',
      error_buffer: payload.error_buffer || []
    };
    
    clientDiagnosticsList.push(newLog);
    res.status(201).json({ success: true, log_id: logId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save diagnostic logs.' });
  }
});

export const ticketRoutes = ticketRouter;