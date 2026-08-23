import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { currencyConverter } from '../services/currencyConverter.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { auditLogs } from '../db/schema/audit_logs.js';
import { sessions } from '../db/schema/sessions.js';
import { devices } from '../db/schema/devices.js';
import { tickets } from '../db/schema/tickets.js';
import { eq, desc } from 'drizzle-orm';
import { clientDiagnosticsList } from './ticketRoutes.js';

export const utilityRouter = Router();

utilityRouter.get('/users', async (req, res) => {
  const allUsers = await db.select().from(users).limit(50);
  res.json({ users: allUsers });
});

utilityRouter.get('/admin/tickets', async (req, res) => {
  try {
    const dbTickets = await db.select().from(tickets).orderBy(desc(tickets.createdAt)).limit(100);
    const formatted = dbTickets.map(t => ({
      ticket_id: String(t.id),
      id: String(t.id),
      user_id: t.userId,
      reason: t.description,
      issue_type: t.subject,
      status: t.status.toLowerCase(),
      created_at: t.createdAt?.toISOString() || new Date().toISOString(),
      createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
      messages: []
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin tickets.' });
  }
});

utilityRouter.get('/admin/diagnostics', async (req, res) => {
  const dbLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(50);
  const dbSessions = await db.select({
    id: sessions.id,
    userId: sessions.userId,
    ipAddress: sessions.ipAddress,
    userAgent: sessions.userAgent,
    createdAt: sessions.createdAt,
    username: users.username
  })
  .from(sessions)
  .leftJoin(users, eq(sessions.userId, users.id))
  .orderBy(desc(sessions.createdAt))
  .limit(50);
  
  const dbDevices = await db.select().from(devices).orderBy(desc(devices.lastSeen)).limit(50);

  const mappedLogs = dbLogs.map(l => ({
    log_id: l.logId,
    admin_id: l.adminId,
    admin_name: l.adminName,
    action: l.action,
    target_id: l.targetId,
    reason: l.reason,
    timestamp: l.timestamp.toISOString()
  }));

  const mappedSessions = dbSessions.map(s => ({
    session_id: String(s.id),
    user_id: s.userId,
    username: s.username || `User #${s.userId}`,
    ip_address: s.ipAddress || '127.0.0.1',
    user_agent: s.userAgent || 'Unknown',
    created_at: s.createdAt.toISOString()
  }));

  const mappedDevices = dbDevices.map(d => ({
    device_id: d.deviceId,
    device_fingerprint: d.deviceFingerprint,
    user_agent: d.userAgent || 'Unknown',
    platform: d.platform || 'Unknown',
    screen_resolution: d.screenResolution || '1920x1080',
    timezone: d.timezone || 'UTC',
    language: d.language || 'en',
    last_seen: d.lastSeen.toISOString(),
    access_count: d.accessCount
  }));

  const suspicious: any[] = [];

  res.json({
    suspicious,
    logs: mappedLogs,
    diagnostic_logs: clientDiagnosticsList,
    invites: [],
    sanctions: [],
    sessions: mappedSessions,
    devices: mappedDevices
  });
});


utilityRouter.get('/public/version', (req, res) => res.json({ version: '2.0.0', latestIncrement: 0 }));

utilityRouter.get('/payments/currencies', (req, res) => {
  const currencies = ['USDT', 'VLM', 'USD', 'EUR', 'GBP'];
  res.json({ currencies });
});

utilityRouter.get('/payments/rates', (req, res) => {
  res.json({ rates: currencyConverter.getAllRates() });
});

utilityRouter.post('/payments/convert', (req, res) => {
  const { amount, from, to } = req.body;
  try {
    const converted = currencyConverter.convert(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
    const rate = currencyConverter.getRate(from.toUpperCase(), to.toUpperCase());
    res.status(200).json({ 
      original: amount, 
      from: from.toUpperCase(), 
      to: to.toUpperCase(), 
      converted,
      rate: rate || 0
    });
  } catch (error) {
    res.status(400).json({ error: 'Currency conversion failed' });
  }
});

utilityRouter.get('/payments/balances', (req, res) => res.json({ balances: [] }));
utilityRouter.get('/payments/methods', (req, res) => res.json({ methods: [] }));

// ---------------------------------------------------------------------------
// Self-Hosted OTA Live Update Endpoints
// ---------------------------------------------------------------------------
utilityRouter.get('/ota/manifest', (req, res) => {
  const manifestPath = path.join(process.cwd(), 'public', 'ota', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return res.json(data);
    } catch (e) {}
  }
  res.json({
    version: '2.2.0',
    buildTime: new Date().toISOString(),
    bundleUrl: '/v2/ota/bundle.zip'
  });
});

utilityRouter.get('/ota/bundle.zip', (req, res) => {
  const zipPath = path.join(process.cwd(), 'public', 'ota', 'bundle.zip');
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'OTA update bundle not found. Run npm run build first.' });
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="bundle.zip"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(zipPath);
});
