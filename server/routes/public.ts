import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, loadDb, saveDb, isUserBlocked } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { generatePrefixedId } from '../utils/ulid.js';
import { ClientDiagnosticLog } from '../../src/types.js';

export const publicRouter = express.Router();

function getBuildVersionInfo() {
  let version = '2.1.51';
  let buildNumber = 1052;
  let buildStage = 'Release Candidate Stream';
  let buildChannel = 'Production';

  try {
    const versionPath = path.join(process.cwd(), 'version.json');
    if (fs.existsSync(versionPath)) {
      const raw = fs.readFileSync(versionPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (parsed.version) version = parsed.version;
        if (parsed.buildNumber) buildNumber = Number(parsed.buildNumber);
        if (parsed.buildStage) buildStage = parsed.buildStage;
        if (parsed.buildChannel) buildChannel = parsed.buildChannel;
      }
    }
  } catch (err) {
    console.error('Error reading version.json in public router:', err);
  }

  loadDb();
  const increments = Number(db.buildIncrementCount || 0);
  const currentBuild = buildNumber + increments;

  return {
    version: version,
    buildNumber: currentBuild,
    fullVersion: `v${version}-b${currentBuild}`,
    displayVersion: `v${version}.${currentBuild}`,
    status: 'OPTIMAL',
    buildStage: buildStage,
    buildChannel: buildChannel,
    timestamp: new Date().toISOString()
  };
}

// Version mismatch synchronization heartbeat check
publicRouter.get('/public/version', (req, res) => {
  res.json(getBuildVersionInfo());
});

// Endpoint to increment build version on system updates
publicRouter.post('/public/version/increment', (req, res) => {
  try {
    loadDb();
    db.buildIncrementCount = Number(db.buildIncrementCount || 0) + 1;
    saveDb();
    res.json(getBuildVersionInfo());
  } catch (err) {
    res.status(500).json({ error: 'Failed to increment build version' });
  }
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

// Client diagnostic logs submission endpoint
publicRouter.post('/support/diagnostics', (req, res) => {
  try {
    const payload = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';

    let userId: number | string | undefined = undefined;
    let username: string | undefined = undefined;

    // Optional auth extraction
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      loadDb();
      const hashedSessionId = crypto.createHash('sha256').update(token).digest('hex');
      const sess = (db.sessions || []).find(s => s && (s.token === token || s.session_id === token || s.session_id === hashedSessionId) && s.status !== 'expired');
      if (sess) {
        userId = sess.user_id;
        const u = (db.users || []).find(user => user && Number(user.user_id) === Number(userId));
        if (u) username = u.username;
      }
    }

    const logEntry: ClientDiagnosticLog = {
      id: generatePrefixedId('diag'),
      user_id: userId || payload.user_id || 'guest',
      username: username || payload.username || 'Anonymous',
      ip_address: clientIp,
      user_agent: payload.user_agent || req.headers['user-agent'] || 'Unknown',
      screen_resolution: payload.screen_resolution || '0x0',
      device_pixel_ratio: Number(payload.device_pixel_ratio) || 1,
      viewport_size: payload.viewport_size || '0x0',
      online_status: payload.online_status !== undefined ? Boolean(payload.online_status) : true,
      connection_type: payload.connection_type || 'unknown',
      storage_summary: payload.storage_summary || {
        localStorage_keys_count: 0,
        localStorage_approx_size_kb: 0,
        serviceWorker_active: false,
        indexedDb_supported: true
      },
      error_buffer: Array.isArray(payload.error_buffer) ? payload.error_buffer : [],
      app_version: payload.app_version || '2.1.51',
      notes: payload.notes || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    loadDb();
    if (!db.diagnostic_logs) db.diagnostic_logs = [];
    db.diagnostic_logs.push(logEntry);

    // Keep last 200 diagnostic logs
    if (db.diagnostic_logs.length > 200) {
      db.diagnostic_logs = db.diagnostic_logs.slice(-200);
    }

    saveDb();
    res.json({ success: true, log_id: logEntry.id });
  } catch (err: any) {
    console.error('Error recording client diagnostics:', err);
    res.status(500).json({ error: 'Failed to record diagnostic payload.' });
  }
});


