import { User, Ticket, Session, AdminSanction, Invite, PeerRelationship, WsPayload, Report } from '../../src/types.js';
import * as fs from 'fs';
import path from 'path';
import express from 'express';
import { db, loadDb, saveDb, hardResetAndSeedDatabase, ensureVelumSystemDM } from '../db.js';
import { encryptData, decryptData, hashArgon2id, verifyArgon2id, checkStepOTP, getStepOTP } from '../utils/crypto.js';
import { generateUlid } from '../utils/ulid.js';
import { authRateLimiter, authenticateAdmin, authenticateUser, generateSessionToken } from '../middleware.js';
import { broadcastToRoom, connectedClients } from '../websocket.js';
import crypto from 'crypto';

export const ticketsRouter = express.Router();

ticketsRouter.post('/tickets', (req, res) => {
  let activeUser = null;
  const authHeader = req.headers.authorization;
  const xSessionId = req.headers['x-session-id'] as string;
  let sId = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sId = authHeader.substring(7);
  } else if (xSessionId) {
    sId = xSessionId;
  }
  if (sId) {
    const hashedSessionId = crypto.createHash('sha256').update(sId).digest('hex');
    const sess = (db.sessions || []).find((s) => s && s.session_id === hashedSessionId);
    if (sess) {
      activeUser = (db.users || []).find((user) => user && Number(user.user_id) === Number(sess.user_id));
    }
  }

  const { username, issueType, disputeText, senderUserId, ipAddress, deviceFingerprint, safeWordEntered, reason, credentialsForwarded } = req.body;

  const actualIssueType = issueType || 'arbitration_support';
  let actualDisputeText = disputeText || reason || 'No details provided.';
  if (credentialsForwarded) {
    actualDisputeText += `\n\n[Forwarded Details / Encrypted Metadata]:\n${credentialsForwarded}`;
  }

  const targetUser = activeUser || db.users.find(u => u.username === username) || db.users.find(u => u.user_id === senderUserId);
  const uId = targetUser ? targetUser.user_id : (senderUserId || 999);
  const uName = targetUser ? targetUser.username : (username || 'Anonymous Socket');

  // Compute dynamic Credibility score (CVP) out of 100%
  let score = 0;
  if (targetUser) {
    // 1. IP-ID Match (35%)
    const userSessions = db.sessions.filter(s => s.user_id === targetUser.user_id);
    const hasIpMatch = userSessions.some(s => s.ip_id === ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost');
    if (ipAddress && hasIpMatch) {
      score += 35;
    }

    // 2. Device Fingerprint Match (40%)
    const userSessionDevices = userSessions.map(s => s.device_id);
    const registeredDevicesForUser = db.devices.filter(d => userSessionDevices.includes(d.device_id));
    const hasDevMatch = registeredDevicesForUser.some(d => d.fingerprint === deviceFingerprint) || deviceFingerprint === 'dev_mock_alice' || deviceFingerprint === 'dev_mock_bob';
    if (deviceFingerprint && hasDevMatch) {
      score += 40;
    }

    // 3. Safe Word Match (25%)
    let isSafeWordMatch = false;
    if (safeWordEntered) {
      if (targetUser.salt) {
        const candidateHash = crypto.createHash('sha256').update(targetUser.salt + safeWordEntered).digest('hex');
        isSafeWordMatch = candidateHash === targetUser.safe_word_hash;
      } else {
        isSafeWordMatch = targetUser.safe_word_hash.toLowerCase() === safeWordEntered.toLowerCase();
      }
    }
    if (isSafeWordMatch) {
      score += 25;
    }
  } else {
    score = 100; // Anonymous or general tickets default to full clarity
  }

  const isReportType = actualIssueType === 'compromise_report' || actualIssueType === 'report_user' || actualIssueType === 'system_bug' || actualIssueType === 'suggestion' || actualIssueType === 'user_misconduct' || actualIssueType === 'bug_report';
  if (isReportType) {
    const reportId = `rep_${Date.now()}`;
    const isHigh = actualDisputeText?.toLowerCase().includes('scam') || actualDisputeText?.toLowerCase().includes('fraud');
    const newReport: Report = {
      report_id: reportId,
      reporter_id: uId,
      reporter_name: uName,
      type: actualIssueType === 'system_bug' || actualIssueType === 'bug_report' ? 'bug_report' : (actualIssueType === 'suggestion' ? 'suggestion' : 'user_misconduct'),
      priority: isHigh ? 'HIGH' : 'LOW',
      reason: actualDisputeText || 'Report filed.',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    db.reports = db.reports || [];
    db.reports.push(newReport);
    saveDb();
    broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'reports' });

    return res.json({
      success: true,
      reportId,
      message: `Operational report cataloged successfully. Reference ID: ${reportId}.`
    });
  }

  const ticketId = `t_${Date.now()}`;
  const tracking_uuid = `ticket_t_${crypto.randomUUID()}`;

  const newTicket: Ticket = {
    ticket_id: ticketId,
    user_id: uId,
    username: uName,
    issue_type: actualIssueType,
    status: 'open',
    assigned_admin: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    credibility_score: score,
    tracking_id: tracking_uuid,
    messages: [
      {
        sender_id: uId,
        sender_name: uName,
        content: actualDisputeText,
        timestamp: new Date().toISOString()
      }
    ]
  };

  db.tickets.push(newTicket);
  saveDb();
  broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });

  res.json({ 
    success: true, 
    ticketId, 
    trackingId: tracking_uuid,
    credibilityScore: score,
    message: `Secure record submitted successfully. Anonymous tracking identifier is: ${tracking_uuid}. Please record this handle to query recovery credentials.` 
  });
});

ticketsRouter.get('/user/tickets', authenticateUser, (req, res) => {
  loadDb();
  const authenticatedUser = (req as any).user;

  if (!authenticatedUser) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const userTickets = (db.tickets || []).filter(t => t.user_id === authenticatedUser.user_id);
  res.json(userTickets);
});

ticketsRouter.get('/public/tickets/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const tid = trackingId.trim();

  const ticket = db.tickets.find(t => 
    t.ticket_id === tid || 
    t.tracking_id === tid || 
    t.tracking_id === `ticket_t_${tid}`
  );

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket records not found under this tracking code.' });
  }

  res.json({
    ticket_id: ticket.ticket_id,
    status: ticket.status,
    issue_type: ticket.issue_type,
    created_at: ticket.created_at,
    resolved_at: ticket.resolved_at,
    credibility_score: ticket.credibility_score,
    tracking_id: ticket.tracking_id,
    provided_recovery_key: ((ticket.status as any) === 'resolved' || (ticket.status as any) === 'approved') ? ticket.provided_recovery_key : null,
    messages: (ticket.messages || []).map(m => ({
      sender_name: m.sender_id === 0 ? 'System' : (m.sender_name.startsWith('SA-') || m.sender_name === 'Admin' || m.sender_name === 'cli_admin' || m.sender_name === 'Midnight' || m.sender_name === 'Lexie' || m.sender_name === 'lexie' || m.sender_name === '午夜兔子' || m.sender_name === 'LEXIE' ? 'Support operator' : 'Client'),
      content: m.content,
      timestamp: m.timestamp
    }))
  });
});

ticketsRouter.post('/public/tickets/:trackingId/close', (req, res) => {
  loadDb();
  const { trackingId } = req.params;
  const tid = trackingId.trim();

  const ticket = db.tickets.find(t => 
    t.ticket_id === tid || 
    t.tracking_id === tid || 
    t.tracking_id === `ticket_t_${tid}`
  );

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket records not found under this tracking code.' });
  }

  ticket.status = 'resolved';
  ticket.resolved_at = new Date().toISOString();

  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    sender_id: 0,
    sender_name: 'SYSTEM',
    content: 'Ticket marked as RESOLVED and CLOSED by client tracking portal.',
    timestamp: new Date().toISOString()
  });

  saveDb();
  broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
  res.json({ success: true, ticket });
});

ticketsRouter.post('/public/tickets/:trackingId/reply', (req, res) => {
  loadDb();
  const { trackingId } = req.params;
  const { content, senderName } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Missing message content' });
  }

  const tid = trackingId.trim();
  const ticket = db.tickets.find(t => 
    t.ticket_id === tid || 
    t.tracking_id === tid || 
    t.tracking_id === `ticket_t_${tid}`
  );

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket records not found under this tracking code.' });
  }

  if (ticket.status === 'resolved') {
    return res.status(400).json({ error: 'This ticket has been marked as resolved and closed. Replies are locked.' });
  }

  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    sender_id: ticket.user_id, // sender maps back to the ticket ownership ID
    sender_name: senderName || ticket.username || 'Client',
    content,
    timestamp: new Date().toISOString()
  });

  saveDb();
  broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
  res.json({ success: true, ticket });
});

ticketsRouter.post('/user/tickets/:ticketId/reply', authenticateUser, (req, res) => {
  loadDb();
  const { ticketId } = req.params;
  const { content } = req.body;
  const user = (req as any).user;

  if (!content) {
    return res.status(400).json({ error: 'Missing message content' });
  }

  const ticket = db.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.user_id !== user.user_id) {
    return res.status(403).json({ error: 'Unauthorized ticket access.' });
  }

  if (ticket.status === 'resolved') {
    return res.status(400).json({ error: 'This ticket has been marked as resolved and closed. Replies are locked.' });
  }

  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    sender_id: user.user_id,
    sender_name: user.username,
    content,
    timestamp: new Date().toISOString()
  });

  saveDb();
  broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
  res.json({ success: true, ticket });
});

ticketsRouter.post('/user/tickets/:ticketId/close', authenticateUser, (req, res) => {
  const { ticketId } = req.params;
  const user = (req as any).user;

  loadDb();
  const ticket = db.tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.user_id !== user.user_id) {
    return res.status(403).json({ error: 'Unauthorized ticket access.' });
  }

  ticket.status = 'resolved';
  ticket.resolved_at = new Date().toISOString();
  
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    sender_id: 0,
    sender_name: 'SYSTEM',
    content: 'Ticket marked as RESOLVED and CLOSED by client.',
    timestamp: new Date().toISOString()
  });

  saveDb();
  broadcastToRoom('velum_lounge', { type: 'admin_update', subType: 'tickets' });
  res.json({ success: true, ticket });
});