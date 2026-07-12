import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, loadDb, saveDb, isUserBlocked } from '../db.js';
import { authenticateUser } from '../middleware.js';

export const publicRouter = express.Router();

let BUILD_VERSION = 'v2.5.4';
try {
  const versionPath = path.join(process.cwd(), 'version.json');
  if (fs.existsSync(versionPath)) {
    const raw = fs.readFileSync(versionPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version) {
      BUILD_VERSION = parsed.version;
    }
  }
} catch (err) {
  console.error('Error reading version.json in public router:', err);
}

// Version mismatch synchronization heartbeat check
publicRouter.get('/public/version', (req, res) => {
  res.json({
    version: BUILD_VERSION,
    status: 'OPTIMAL',
    timestamp: new Date().toISOString()
  });
});

// Guest check for support ticket status
publicRouter.get('/public/tickets/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    loadDb();

    db.tickets = db.tickets || [];
    const ticket = db.tickets.find((t) => t && t.ticket_id === ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket signature not found.' });
    }

    res.json(ticket);
  } catch (err: any) {
    console.error('Error in public tickets GET:', err);
    res.status(500).json({ error: 'Failed to find ticket' });
  }
});

// Guest reply or append credentials validation on ticket
publicRouter.post('/public/tickets/:ticketId/reply', (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reply, credentials } = req.body;

    loadDb();
    db.tickets = db.tickets || [];

    const index = db.tickets.findIndex((t) => t && t.ticket_id === ticketId);
    if (index === -1) {
      return res.status(404).json({ error: 'Ticket signature not located.' });
    }

    const ticket = db.tickets[index];
    
    // Append reply text or credentials
    if (reply) {
      ticket.reason = `${ticket.reason}\n\n[Guest Update]: ${reply}`;
    }
    if (credentials) {
      ticket.credentials_forwarded = `${ticket.credentials_forwarded || ''}\n[Update]: ${credentials}`.trim();
    }

    ticket.updated_at = new Date().toISOString();
    db.tickets[index] = ticket;

    saveDb();
    res.json({ success: true, ticket });
  } catch (err: any) {
    console.error('Error public reply:', err);
    res.status(500).json({ error: 'Failed to record details.' });
  }
});

// Authenticated lists of users on node
publicRouter.get('/users', authenticateUser, (req, res) => {
  try {
    loadDb();
    
    const callingUser = (req as any).user;
    const isCallingUserAdmin = callingUser && (
      callingUser.role === 'SUPPORT_ADMIN' || 
      callingUser.role === 'SYSTEM_ADMIN' || 
      callingUser.role === 'LOGIN_ADMIN' || 
      callingUser.role === 'ADMIN' || 
      (typeof callingUser.role === 'string' && callingUser.role.includes('ADMIN'))
    );

    // Express users with zero hashed credential leakage
    let publicUsers = (db.users || []).map((u) => {
      // Find matching location details from profiles
      const prof = (db.profiles || []).find((p) => p && Number(p.user_id) === Number(u.user_id));
      return {
        userId: u.user_id,
        username: u.username,
        role: u.role,
        status: u.status,
        last_seen_at: u.last_seen_at || null,
        location: prof?.location || 'Warsaw, Poland'
      };
    });

    // Retain all users (including executives) in the directory so everyone exists in the lounge together
    if (callingUser) {
      const callingUserId = Number(callingUser.user_id);
      publicUsers = publicUsers.filter((u) => {
        return !isUserBlocked(callingUserId, u.userId);
      });
    }

    res.json(publicUsers);
  } catch (err: any) {
    console.error('Error fetching users list:', err);
    res.status(500).json({ error: 'Failed to list active users.' });
  }
});

// Retrieve online/offline presence status for a particular userId
publicRouter.get('/users/:userId/status', authenticateUser, (req, res) => {
  try {
    const { userId } = req.params;
    const targetUserId = parseInt(userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Valid user identity required.' });
    }

    loadDb();
    const u = (db.users || []).find((user) => user && Number(user.user_id) === targetUserId);
    if (!u) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      userId: u.user_id,
      username: u.username,
      last_seen_at: u.last_seen_at || null
    });
  } catch (err: any) {
    console.error('Error fetching user status:', err);
    res.status(500).json({ error: 'Failed to access status.' });
  }
});

