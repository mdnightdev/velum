import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { tickets, Ticket, reports } from '../db/schema/tickets.js';
import { eq, desc } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import type { Request, Response } from 'express';
import { generateRandomToken } from '../utils/crypto.js';

export const ticketRouter = Router();

ticketRouter.use(authMiddleware);



ticketRouter.post('/tickets', authMiddleware, async (req: Request, res: Response) => {
  const { reason, issueType, credentialsForwarded } = req.body;

    const [recent] = await db.select().from(tickets)
      .where(eq(tickets.userId, req.user!.userId))
      .orderBy(desc(tickets.createdAt))
      .limit(1);

    if (recent && recent.createdAt && (Date.now() - new Date(recent.createdAt).getTime() < 60000)) {
      return res.status(429).json({ error: "Too many tickets. Please wait 60s." });
    }

  
  if (!reason) {
    return res.status(400).json({ error: 'Reason is required.' });
  }
  
  const trackingUuid = `TK-${generateRandomToken(12).toUpperCase()}`;

  const [newTicket] = await db.insert(tickets).values({
    userId: req.user!.userId,
    subject: issueType || 'general_support',
    description: reason,
    trackingId: trackingUuid,
    status: 'OPEN'
  }).returning();
  
  const formatted = {
    ticket_id: String(newTicket.id),
    user_id: newTicket.userId,
    reason: newTicket.description,
    issue_type: newTicket.subject,
    status: newTicket.status,
    tracking_id: newTicket.trackingId,
    trackingId: newTicket.trackingId,
    created_at: newTicket.createdAt?.toISOString() || new Date().toISOString(),
    createdAt: newTicket.createdAt?.toISOString() || new Date().toISOString(),
    messages: Array.isArray(newTicket.messages) ? newTicket.messages : []
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
    tracking_id: t.trackingId,
    trackingId: t.trackingId,
    credentials_forwarded: null,
    messages: Array.isArray(t.messages) ? t.messages : []
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
  
  const currentTicket = ticket[0];
  const updatedMessages = Array.isArray(currentTicket.messages) ? [...(currentTicket.messages as any[])] : [];
  updatedMessages.push({
    sender_id: req.user!.userId,
    sender_name: req.user!.username,
    content,
    timestamp: new Date().toISOString()
  });

  await db.update(tickets).set({ 
    messages: updatedMessages,
    updatedAt: new Date() 
  }).where(eq(tickets.id, ticketId));
  
  res.json({ message: 'Reply submitted successfully.', messages: updatedMessages });
});



export const clientDiagnosticsList: any[] = [];

const diagnosticsRateLimit = new Map<number, number>();

ticketRouter.post('/support/diagnostics', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.user && req.user.role && req.user.role.includes('ADMIN')) {
      return res.status(403).json({ error: 'Admins cannot submit client diagnostics.' });
    }

    const now = Date.now();
    const lastSubmit = diagnosticsRateLimit.get(req.user!.userId) || 0;
    if (now - lastSubmit < 60000) { // 1 minute cooldown
      return res.status(429).json({ error: 'Too many diagnostic reports. Please wait before submitting again.' });
    }
    diagnosticsRateLimit.set(req.user!.userId, now);

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

ticketRouter.post('/reports/:id/escalate', authMiddleware, async (req: Request, res: Response) => {
  if (!req.user || !['LOGIN_ADMIN', 'ADMIN', 'CLI_ADMIN', 'SUPPORT_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only administrators can escalate reports to CLI.' });
  }

  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) {
    return res.status(400).json({ error: 'Invalid report ID.' });
  }

  const [existing] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!existing) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  await db.update(reports).set({
    status: 'escalated',
    updatedAt: new Date()
  }).where(eq(reports.id, reportId));

  res.json({ success: true, message: `Report #${reportId} escalated to CLI investigation.` });
});

export const ticketRoutes = ticketRouter;
