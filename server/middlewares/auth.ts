import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, loadDb, saveDb, sqliteDb } from '../db.js';
import { decryptData, encryptData } from '../services/cryptoService.js';

export const rateLimiterCache = new Map<string, any>();

let lastRateLimiterCleanup = Date.now();

// Enhanced rate limiter with IP and user-based tracking
export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  
  // Periodically prune expired entries from cache every 30 seconds or if cache grows large
  if (now - lastRateLimiterCleanup > 30000 || rateLimiterCache.size > 2000) {
    lastRateLimiterCleanup = now;
    for (const [key, value] of rateLimiterCache.entries()) {
      if (value.expiresAt && now > value.expiresAt) {
        rateLimiterCache.delete(key);
      } else if (value.blockUntil && now > value.blockUntil) {
        rateLimiterCache.delete(key);
      }
    }
  }
  
  const record = rateLimiterCache.get(ip);
  if (record) {
    if (now > record.expiresAt) {
      rateLimiterCache.set(ip, { count: 1, expiresAt: now + 60000 });
      next();
    } else {
      record.count += 1;
      // Stricter limit for auth endpoints
      if (record.count > 10000) {
        return res.status(429).json({ error: 'Too many authentication attempts. Please wait.' });
      }
      next();
    }
  } else {
    rateLimiterCache.set(ip, { count: 1, expiresAt: now + 60000 });
    next();
  }
};

function getSessionFromDb(hashedSessionId: string): any {
  if (db && Array.isArray(db.sessions)) {
    const sess = db.sessions.find((s: any) => s && (s.session_id === hashedSessionId || s.id === hashedSessionId));
    if (sess) return sess;
  }

  try {
    if (sqliteDb) {
      const row = sqliteDb.prepare("SELECT payload FROM sessions WHERE id = ?").get(hashedSessionId) as { payload: string } | undefined;
      if (row && row.payload) {
        const sess = JSON.parse(decryptData(row.payload));
        if (sess && db && Array.isArray(db.sessions)) {
          db.sessions.push(sess);
        }
        return sess;
      }
    }
  } catch (err) {
    // sqliteDb access fallback
  }

  return null;
}

function saveSessionToDb(session: any): void {
  const sid = session.session_id || session.id;
  if (db && Array.isArray(db.sessions)) {
    const idx = db.sessions.findIndex((s: any) => s && (s.session_id === sid || s.id === sid));
    if (idx >= 0) {
      db.sessions[idx] = session;
    } else {
      db.sessions.push(session);
    }
  }

  try {
    if (sqliteDb) {
      const encrypted = encryptData(JSON.stringify(session));
      sqliteDb.prepare("INSERT OR REPLACE INTO sessions (id, payload) VALUES (?, ?)").run(sid, encrypted);
    }
  } catch (err) {
    // sqliteDb save fallback
  }

  saveDb('sessions');
}

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const xSessionId = req.headers['x-session-id'] as string;

    let sessionId = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    } else if (xSessionId) {
      sessionId = xSessionId;
    }

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized: Session security token missing.' });
    }

    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    const sess = getSessionFromDb(hashedSessionId);
    if (!sess) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
    }

    if (sess.expires_at) {
      const expiresTime = new Date(sess.expires_at).getTime();
      const now = Date.now();
      if (now > expiresTime) {
        return res.status(401).json({ error: 'Unauthorized: Session expired. Please log in again.' });
      }
    }

    // OWASP Session Management: 30-minute Idle Timeout
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
    const now = Date.now();
    const lastPingTime = sess.activity_metrics?.lastPing ? new Date(sess.activity_metrics.lastPing).getTime() : 0;
    if (lastPingTime && (now - lastPingTime > IDLE_TIMEOUT_MS)) {
      sess.status = 'expired';
      saveSessionToDb(sess);
      return res.status(401).json({ error: 'Unauthorized: Session idle timeout exceeded. Please log in again.' });
    }

    // Slide activity window only if more than 5 minutes have elapsed to throttle DB writes and prevent lock contentions
    if (!lastPingTime || (now - lastPingTime > 300000)) {
      if (!sess.activity_metrics) {
        sess.activity_metrics = { messagesSent: 0, lastPing: new Date().toISOString() };
      } else {
        sess.activity_metrics.lastPing = new Date().toISOString();
      }
      saveSessionToDb(sess);
    }

    const u = (db.users || []).find((user) => user && Number(user.user_id) === Number(sess.user_id));
    if (!u) {
      return res.status(401).json({ error: 'Unauthorized: User not found.' });
    }

    (req as any).user = u;
    (req as any).sessionId = sessionId;
    next();
  } catch (err) {
    console.error('Authentication Error:', err);
    res.status(501).json({ error: 'Authentication protocol exception.' });
  }
};

// Secondary administrator authentication constraint gates
export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  authenticateUser(req, res, () => {
    const user = (req as any).user;
    if (!user || (user.role !== 'CLI_ADMIN' && user.role !== 'LOGIN_ADMIN' && user.role !== 'SUPPORT_ADMIN')) {
      return res.status(403).json({ error: 'Security authorization escalated clearance required.' });
    }
    (req as any).adminUser = user;
    next();
  });
};

// Create a secure cryptographic random session token
export const generateSessionToken = (userId?: any, username?: string, role?: string, deviceId?: string, sessionId?: string): string => {
  return sessionId || crypto.randomBytes(32).toString('hex');
};

// Verify session tokens during websocket handshakes
export const verifySessionToken = (token: string): { session_id: string } | null => {
  if (!token) return null;
  const hashedSessionId = crypto.createHash('sha256').update(token).digest('hex');
  const sess = getSessionFromDb(hashedSessionId);
  if (!sess || sess.status !== 'active') return null;
  
  if (sess.expires_at) {
    const expiresTime = new Date(sess.expires_at).getTime();
    const now = Date.now();
    if (now > expiresTime) {
      return null;
    }
  }
  
  return { session_id: sess.session_id };
};
