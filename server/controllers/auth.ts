import { Request, Response } from 'express';
import crypto from 'crypto';
import { 
  db, 
  loadDb, 
  saveDb, 
  ensureVelumSystemDM, 
  generateLoginNonce, 
  verifyAndConsumeNonce 
} from '../db.js';
import { validateCredentials, executePanicWipe, createNewSession, performUserRegistration } from '../services/authService.js';
import { userRepository } from '../db/userRepository.js';
import { 
  hashArgon2id, 
  verifyArgon2id, 
  checkStepOTP, 
  getStepOTP 
} from '../utils/crypto.js';
import { generateUlid } from '../utils/ulid.js';
import { generateSessionToken, rateLimiterCache } from '../middleware.js';
import { cleanIp, getIpGeoLocation } from '../utils.js';
import { calculateBackoffMs } from '../crypto.js';
import { User, Session, Ticket } from '../../src/types.js';

export const getPreSignupSalt = (req: Request, res: Response) => {
  const salt = crypto.randomBytes(32).toString('hex');
  res.json({ salt });
};

export const getLoginNonce = (req: Request, res: Response) => {
  const nonce = generateLoginNonce();
  res.json({ nonce });
};

export const getSession = (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: No active session.' });
    }
    res.json({
      userId: Number(user.user_id),
      username: user.username,
      role: user.role,
      status: user.status
    });
  } catch (err) {
    console.error('Session validation error:', err);
    res.status(500).json({ error: 'Internal validation error.' });
  }
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, password, safeWord, panicPhrase, inviteCode, deviceFingerprint, recoveryKeyHash, recoveryKey, salt, plainRecoveryKey } = req.body;

    if (!username || !password || !safeWord || !panicPhrase) {
      return res.status(400).json({ error: 'Missing required registration parameters.' });
    }

    if (username.trim().includes(' ')) {
      return res.status(400).json({ error: 'Username must not contain any spaces.' });
    }

    loadDb();

    const ipAddress = cleanIp(req);

    const { userId, deviceId } = await performUserRegistration({
      username,
      passwordHex: password,
      safeWordHex: safeWord,
      panicPhraseHex: panicPhrase,
      inviteCode,
      deviceFingerprint,
      recoveryKeyHash,
      recoveryKey,
      salt,
      plainRecoveryKey,
      ipAddress
    });

    res.json({
      success: true,
      userId,
      username,
      role: 'USER',
      deviceId
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(400).json({ error: err.message || 'Failed to complete registration.' });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fingerprint, token, nonce } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password.' });
    }

    if (!nonce || !verifyAndConsumeNonce(nonce)) {
      return res.status(400).json({ error: 'Cryptographic challenge handshake expired or replayed. Please retry.' });
    }

    if (!/^[0-9a-fA-F]{64}$/.test(password)) {
      return res.status(400).json({ error: 'Invalid password credential structure.' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'local-client';
    const ipStr = Array.isArray(ip) ? ip[0] : String(ip);

    const ipRlKey = `ip:${ipStr}`;
    const ipRecord = rateLimiterCache.get(ipRlKey);
    if (ipRecord && ipRecord.blockUntil && Date.now() < ipRecord.blockUntil) {
      const waitSeconds = Math.ceil((ipRecord.blockUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many login failures. Please wait ${waitSeconds} seconds.` });
    }

    const userRlKey = `user:${username.trim().toLowerCase()}`;
    const userRecord = rateLimiterCache.get(userRlKey);
    if (userRecord && userRecord.blockUntil && Date.now() < userRecord.blockUntil) {
      const waitSeconds = Math.ceil((userRecord.blockUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many login failures. Please wait ${waitSeconds} seconds.` });
    }

    loadDb();

    const queryName = username.trim();
    const user = userRepository.findByUsername(queryName);

    if (user && user.role === 'SUPPORT_ADMIN') {
      const baseCleanName = user.username.replace(/^SA-/, '');
      const baseUser = userRepository.findByUsername(baseCleanName);
      if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
        return res.status(403).json({ error: 'FAIL: Security credentials revoked. Companion support operator nomination status is invalid.' });
      }
    }

    if (user && user.activation_status === 'AWAITING_ACTIVATION') {
      return res.json({
        needsActivation: true,
        userId: user.user_id,
        username: user.username,
        role: user.role
      });
    }
    
    if (user) {
      const isPanicPhrase = await verifyArgon2id(password, user.salt, user.panic_phrase_hash);
      if (isPanicPhrase) {
        executePanicWipe();

        const deviceId = `dev_${Date.now()}`;
        const ipId = `ip_${Date.now()}`;
        const ipClean = cleanIp(req);
        const geoBase = await getIpGeoLocation(ipClean);
        const { sessionId } = createNewSession(user.user_id, deviceId, ipId);

        const signedToken = generateSessionToken(user.user_id, user.username, 'USER', deviceId, sessionId);
        return res.json({
          success: true,
          user: {
            userId: user.user_id,
            username: user.username,
            role: 'USER',
            status: 'active'
          },
          profile: {
            profile_id: `p_${user.user_id}`,
            user_id: user.user_id,
            bio: 'Proud Velum user.',
            avatar: 'user',
            location: geoBase,
            updated_at: new Date().toISOString()
          },
          sessionId: signedToken,
          deviceId
        });
      }
    }

    let isPasswordValid = false;
    if (user) {
      const authResult = await validateCredentials(user, password);
      isPasswordValid = authResult.isValid;
    } else {
      const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
      const dummyHash = `argon2id:${dummySalt}:${crypto.createHash('sha256').update('dummy_hash_placeholder').digest('hex')}`;
      await verifyArgon2id(password, dummySalt, dummyHash);
    }

    if (!user || !isPasswordValid) {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'local-client';
      const ipStr = Array.isArray(ip) ? ip[0] : String(ip);

      if (username) {
        const userRlKey = `user:${username.trim().toLowerCase()}`;
        const uRecord = rateLimiterCache.get(userRlKey) || { attempts: 0, blockUntil: 0 };
        uRecord.attempts += 1;
        const backoff = calculateBackoffMs(uRecord.attempts);
        if (backoff > 0) {
          uRecord.blockUntil = Date.now() + backoff;
        }
        rateLimiterCache.set(userRlKey, uRecord);
      }

      const ipRlKey = `ip:${ipStr}`;
      const ipRecord = rateLimiterCache.get(ipRlKey) || { attempts: 0, blockUntil: 0 };
      ipRecord.attempts += 1;
      const backoff = calculateBackoffMs(ipRecord.attempts);
      if (backoff > 0) {
        ipRecord.blockUntil = Date.now() + backoff;
      }
      rateLimiterCache.set(ipRlKey, ipRecord);

      db.suspicious_events.push({
        event_id: `se_${Date.now()}`,
        entity_type: 'user',
        entity_id: username,
        risk_level: 'intermediate',
        description: `Failed login attempt for account ${username}`,
        created_at: new Date().toISOString()
      });
      saveDb();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const successIp = req.ip || req.headers['x-forwarded-for'] || 'local-client';
    const successIpStr = Array.isArray(successIp) ? successIp[0] : String(successIp);
    if (username) {
      rateLimiterCache.delete(`user:${username.trim().toLowerCase()}`);
    }
    rateLimiterCache.delete(`ip:${successIpStr}`);

    if (user.role === 'USER' && (user.needs_reset || !user.salt)) {
      return res.json({ needsMigration: true, userId: user.user_id, username: user.username });
    }

    if (user.status === 'compromised') {
      db.tickets = db.tickets || [];
      let ticket = db.tickets.find(t => t.user_id === user.user_id && t.issue_type === 'recovery_request' && t.status !== 'resolved');
      if (!ticket) {
        const ticketId = `t_${Date.now()}`;
        const tracking_uuid = `ticket_t_${crypto.randomUUID()}`;
        ticket = {
          ticket_id: ticketId,
          user_id: user.user_id,
          username: user.username,
          issue_type: 'recovery_request',
          status: 'open',
          assigned_admin: null,
          created_at: new Date().toISOString(),
          resolved_at: null,
          credibility_score: 95,
          tracking_id: tracking_uuid,
          messages: [
            {
              sender_id: 0,
              sender_name: 'SYSTEM',
              content: 'SECURITY EVENT INITIATED. Account quarantined from emergency panic phrase trigger. High-credibility restore process started.',
              timestamp: new Date().toISOString()
            },
            {
              sender_id: 0,
              sender_name: 'SYSTEM',
              content: 'To coordinate with central control administrators and obtain your restore code, please formulate details in the chat below.',
              timestamp: new Date().toISOString()
            }
          ]
        };
        db.tickets.push(ticket);
        db.audit_logs.push({
          log_id: `al_${Date.now()}`,
          admin_id: 0,
          admin_name: 'SYSTEM',
          action: 'panic_lock',
          target_type: 'user',
          target_id: user.user_id.toString(),
          reason: 'Auto-recovery ticket instantiated securely on authenticated login attempt.',
          timestamp: new Date().toISOString()
        });
        saveDb();
      }

      return res.status(403).json({ 
        error: 'SECURITY LOCK: This account is flagged as COMPROMISED. A priority support escalation ticket is online.',
        compromisedPortalActive: true,
        ticket: {
          ticket_id: ticket.ticket_id,
          status: ticket.status,
          issue_type: ticket.issue_type,
          created_at: ticket.created_at,
          resolved_at: ticket.resolved_at,
          credibility_score: ticket.credibility_score,
          tracking_id: ticket.tracking_id,
          provided_recovery_key: ticket.provided_recovery_key || null,
          messages: (ticket.messages || []).map(m => ({
            sender_name: m.sender_id === 0 ? 'System' : (m.sender_name.startsWith('SA-') || m.sender_name === 'Admin' || m.sender_name === 'cli_admin' || m.sender_name === 'Midnight' || m.sender_name === 'Lexie' || m.sender_name === 'lexie' || m.sender_name === '午夜兔子' || m.sender_name === 'LEXIE' ? 'Support operator' : 'Client'),
            content: m.content,
            timestamp: m.timestamp
          }))
        }
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended by system administrators.' });
    }

    const ipClean = cleanIp(req);
    const resolvedFingerprint = (fingerprint || req.headers['user-agent'] || 'Generic Web User Agent') as string;
    const geoBase = await getIpGeoLocation(ipClean);

    const profile = db.profiles.find(p => p.user_id === user.user_id);
    if (profile) {
      (profile as any).ip_address = ipClean;
      (profile as any).device_fingerprint = resolvedFingerprint;
      if (!profile.location || profile.location === 'Poland') {
        profile.location = geoBase;
      }
      profile.updated_at = new Date().toISOString();
    }

    const isNewIp = !db.ip_addresses.some(ip => ip && ip.user_id === user.user_id && ip.ip_address === ipClean);
    const isNewDevice = !db.devices.some(dev => dev && dev.user_id === user.user_id && dev.fingerprint === resolvedFingerprint);

    if (isNewIp || isNewDevice) {
      console.warn(`[SYS-SECURE] Suspicious login detected for user ${user.username}: New IP or device fingerprint.`);
      db.suspicious_events = db.suspicious_events || [];
      db.suspicious_events.push({
        event_id: `se_${Date.now()}`,
        user_id: user.user_id,
        ip_address: ipClean,
        device_fingerprint: resolvedFingerprint,
        event_type: 'suspicious_login',
        details: `Login from new IP (${ipClean}) or new device fingerprint.`,
        timestamp: new Date().toISOString()
      } as any);
    }

    const ipId = `ip_${Date.now()}`;
    db.ip_addresses.push({
      ip_id: ipId,
      user_id: user.user_id,
      ip_address: ipClean,
      risk_score: 5,
      accounts_linked: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });

    const deviceId = `dev_${Date.now()}`;
    db.devices.push({
      device_id: deviceId,
      user_id: user.user_id,
      fingerprint: resolvedFingerprint,
      risk_score: 5,
      accounts_linked: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      status: 'trusted'
    });

    const { sessionId } = createNewSession(user.user_id, deviceId, ipId);

    ensureVelumSystemDM(user.user_id, user.username, '');

    const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        status: user.status
      },
      profile,
      sessionId: signedToken,
      deviceId
    });
  } catch (err: any) {
    console.error('[AUTH LOGIN DETAILED RUNTIME ERROR]:', err);
    res.status(500).json({ error: `Handshake internal runtime exception: ${err.message}` });
  }
};

export const registerPermanentOtp = async (req: Request, res: Response) => {
  try {
    const { username, password, permanentOtp } = req.body;

    if (!username || !password || !permanentOtp) {
      return res.status(400).json({ error: 'Username, password, and permanent OTP are required.' });
    }

    loadDb();

    const queryName = username.trim();
    const user = userRepository.findByUsername(queryName);

    if (!user) {
      return res.status(404).json({ error: 'User context not found.' });
    }

    const isPasswordValid = await verifyArgon2id(password, user.salt, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.role !== 'LOGIN_ADMIN' && user.role !== 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'FAIL: Only web administrators can set permanent OTP keys.' });
    }

    const otpClean = permanentOtp.trim();
    if (otpClean.length < 4) {
      return res.status(400).json({ error: 'Permanent security OTP must contain at least 4 alphanumeric characters.' });
    }

    user.permanent_otp = otpClean;
    saveDb();

    const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') as string;
    const ipClean = Array.isArray(clientIp) ? clientIp[0].split(',')[0].trim() : clientIp.split(',')[0].trim().replace('::ffff:', '');
    const resolvedFingerprint = 'Velum-Secure-Client-v3';

    const geoBase = await getIpGeoLocation(ipClean);

    const profile = db.profiles.find(p => p.user_id === user.user_id);
    if (profile) {
      (profile as any).ip_address = ipClean;
      (profile as any).device_fingerprint = resolvedFingerprint;
      if (!profile.location) {
        profile.location = geoBase;
      }
      profile.updated_at = new Date().toISOString();
    }

    const ipId = `ip_${Date.now()}`;
    db.ip_addresses.push({
      ip_id: ipId,
      user_id: user.user_id,
      ip_address: ipClean,
      risk_score: 5,
      accounts_linked: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });

    const deviceId = `dev_${Date.now()}`;
    db.devices.push({
      device_id: deviceId,
      user_id: user.user_id,
      fingerprint: resolvedFingerprint,
      risk_score: 5,
      accounts_linked: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      status: 'trusted'
    });

    const sessionId = generateUlid();
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

    const newSession: Session = {
      session_id: hashedSessionId,
      user_id: user.user_id,
      device_id: deviceId,
      ip_id: ipId,
      status: 'active',
      start_time: new Date().toISOString(),
      end_time: null,
      activity_metrics: { messagesSent: 0, lastPing: new Date().toISOString() }
    };

    db.sessions.push(newSession);
    saveDb();

    ensureVelumSystemDM(user.user_id, user.username, '');

    const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

    let destination = 'chat';
    if ((user.role as string) === 'CLI_ADMIN') destination = 'cli';
    else if ((user.role as string) === 'LOGIN_ADMIN') destination = 'admin';

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        status: user.status
      },
      profile,
      sessionId: signedToken,
      deviceId,
      destination
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register permanent OTP.' });
  }
};

export const migrateUser = async (req: Request, res: Response) => {
  try {
    const { userId, username, password, safeWord, panicPhrase } = req.body;

    if (!userId || !username || !password || !safeWord || !panicPhrase) {
      return res.status(400).json({ error: 'All migration fields are required.' });
    }

    const user = userRepository.findById(parseInt(userId, 10));
    if (!user) {
      return res.status(404).json({ error: 'User context not found.' });
    }

    let formattedUsername = username.trim();
    if (formattedUsername.includes(' ')) {
      return res.status(400).json({ error: 'Username must not contain any spaces.' });
    }
    if (!formattedUsername.startsWith('@')) {
      formattedUsername = `@${formattedUsername}`;
    }

    const duplicate = userRepository.findByUsername(formattedUsername);
    if (duplicate && duplicate.user_id !== user.user_id) {
      return res.status(400).json({ error: 'That username handle is already taken.' });
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const saltBuf = Buffer.from(salt, 'hex');

    const password_hash_raw = await hashArgon2id(password, saltBuf);
    const password_hash = `argon2id:${password_hash_raw}`;

    const safe_word_hash_raw = await hashArgon2id(safeWord, saltBuf);
    const safe_word_hash = `argon2id:${safe_word_hash_raw}`;

    const panic_phrase_hash_raw = await hashArgon2id(panicPhrase, saltBuf);
    const panic_phrase_hash = `argon2id:${panic_phrase_hash_raw}`;

    user.username = formattedUsername;
    user.salt = salt;
    user.password_hash = password_hash;
    user.safe_word_hash = safe_word_hash;
    user.panic_phrase_hash = panic_phrase_hash;
    user.needs_reset = false;
    user.updated_at = new Date().toISOString();

    saveDb();

    res.json({ success: true, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to migrate credentials.' });
  }
};

export const getOtpStatus = (req: Request, res: Response) => {
  res.json({ otp: getStepOTP() });
};

export const activateAdmin = async (req: Request, res: Response) => {
  try {
    const { userId, newPassword, newSafeWord, newPanicPhrase } = req.body;
    if (!userId || !newPassword || !newSafeWord || !newPanicPhrase) {
      return res.status(400).json({ error: 'All configuration parameters are required.' });
    }

    const user = userRepository.findById(parseInt(userId, 10));
    if (!user || user.role !== 'SUPPORT_ADMIN') {
      return res.status(404).json({ error: 'Administrative user profile not found.' });
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const saltBuf = Buffer.from(salt, 'hex');

    const password_hash_raw = await hashArgon2id(newPassword, saltBuf);
    const password_hash = `argon2id:${password_hash_raw}`;

    const safe_word_hash_raw = await hashArgon2id(newSafeWord, saltBuf);
    const safe_word_hash = `argon2id:${safe_word_hash_raw}`;

    const panic_phrase_hash_raw = await hashArgon2id(newPanicPhrase, saltBuf);
    const panic_phrase_hash = `argon2id:${panic_phrase_hash_raw}`;

    user.salt = salt;
    user.password_hash = password_hash;
    user.safe_word_hash = safe_word_hash;
    user.panic_phrase_hash = panic_phrase_hash;
    user.activation_status = 'ACTIVATED';
    user.updated_at = new Date().toISOString();

    saveDb();

    const deviceId = `dev_admin_${Math.random().toString(36).substring(2, 8)}`;
    const sessionId = generateUlid();
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

    const newSession: Session = {
      session_id: hashedSessionId,
      user_id: user.user_id,
      device_id: deviceId,
      ip_id: 'ip_mock',
      status: 'active',
      start_time: new Date().toISOString(),
      end_time: null,
      activity_metrics: { messagesSent: 0, lastPing: new Date().toISOString() }
    };

    db.sessions.push(newSession);
    saveDb();

    const profile = db.profiles.find(p => p.user_id === user.user_id);
    const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        status: user.status
      },
      profile,
      sessionId: signedToken,
      deviceId
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to activate administrator account.' });
  }
};

export const logoutUser = (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId) {
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    db.sessions = db.sessions.map(s => {
      if (s.session_id === sessionId || s.session_id === hashedSessionId) {
        return { ...s, status: 'revoked', end_time: new Date().toISOString() };
      }
      return s;
    });
    saveDb();
  }
  res.json({ success: true });
};

export const panicUser = async (req: Request, res: Response) => {
  try {
    const { userId, username, panicPhrase } = req.body;

    if (!panicPhrase) {
      return res.status(400).json({ error: 'Emergency trigger panic phrase required.' });
    }

    loadDb();

    let user;
    if (userId) {
      user = userRepository.findById(parseInt(userId, 10));
    } else if (username) {
      user = userRepository.findByUsername(username.trim());
    } else {
      return res.status(400).json({ error: 'User context and target account parameter are required.' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Target user context not found in cryptographic database.' });
    }

    let isPanicMatch = false;
    if (user.panic_phrase_hash && user.panic_phrase_hash.startsWith('argon2id:')) {
      isPanicMatch = await verifyArgon2id(panicPhrase, user.salt, user.panic_phrase_hash);
    } else if (user.salt) {
      const candidateHash = crypto.createHash('sha256').update(user.salt + panicPhrase).digest('hex');
      isPanicMatch = candidateHash === user.panic_phrase_hash;
    } else {
      isPanicMatch = user.panic_phrase_hash.toLowerCase() === panicPhrase.toLowerCase();
    }

    if (!isPanicMatch) {
      return res.status(400).json({ error: 'Verification failed: Emergency panic phrase match invalid.' });
    }

    user.status = 'compromised';
    user.updated_at = new Date().toISOString();

    db.sessions = db.sessions.map(s => {
      if (s.user_id === user.user_id) {
        return { ...s, status: 'revoked', end_time: new Date().toISOString() };
      }
      return s;
    });

    db.tickets = db.tickets || [];
    let ticket = db.tickets.find(t => t.user_id === user.user_id && t.issue_type === 'recovery_request' && t.status !== 'resolved');
    if (!ticket) {
      const ticketId = `t_${Date.now()}`;
      const tracking_uuid = `ticket_t_${crypto.randomUUID()}`;
      ticket = {
        ticket_id: ticketId,
        user_id: user.user_id,
        username: user.username,
        issue_type: 'recovery_request',
        status: 'open',
        assigned_admin: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
        credibility_score: 95,
        tracking_id: tracking_uuid,
        messages: [
          {
            sender_id: 0,
            sender_name: 'SYSTEM',
            content: 'SECURITY EVENT INITIATED. Account quarantined from emergency panic phrase trigger. High-credibility restore process started.',
            timestamp: new Date().toISOString()
          },
          {
            sender_id: 0,
            sender_name: 'SYSTEM',
            content: 'To coordinate with central control administrators and obtain your restore code, please formulate details in the chat below.',
            timestamp: new Date().toISOString()
          }
        ]
      };
      db.tickets.push(ticket);
    }

    db.suspicious_events.push({
      event_id: `se_${Date.now()}`,
      entity_type: 'user',
      entity_id: user.user_id.toString(),
      risk_level: 'critical',
      description: `PANIC PHRASE ACTIVATED for user ID ${user.user_id}. Session containment triggered immediately.`,
      created_at: new Date().toISOString()
    });

    db.audit_logs = db.audit_logs || [];
    db.audit_logs.push({
      log_id: `al_${Date.now()}`,
      admin_id: 0,
      admin_name: 'SYSTEM',
      action: 'panic_lock',
      target_type: 'user',
      target_id: user.user_id.toString(),
      reason: `CRITICAL SEC_ALERT: Account "${user.username}" quarantined via emergency panic phrase trigger. Sessions Terminated. Auto-recovery ticket #${ticket.ticket_id} instantiated.`,
      timestamp: new Date().toISOString()
    });

    saveDb();

    res.json({
      success: true,
      message: 'CRITICAL SHIELD ACTIVATED. Account enters quarantine immediately. All connected sessions destroyed. Access ticket created.',
      ticket: {
        ticket_id: ticket.ticket_id,
        status: ticket.status,
        issue_type: ticket.issue_type,
        created_at: ticket.created_at,
        resolved_at: ticket.resolved_at,
        credibility_score: ticket.credibility_score,
        tracking_id: ticket.tracking_id,
        provided_recovery_key: ticket.provided_recovery_key || null,
        messages: (ticket.messages || []).map(m => ({
          sender_name: m.sender_id === 0 ? 'System' : (m.sender_name.startsWith('SA-') || m.sender_name === 'Admin' || m.sender_name === 'cli_admin' || m.sender_name === 'Midnight' || m.sender_name === 'Lexie' || m.sender_name === 'lexie' || m.sender_name === '午夜兔子' || m.sender_name === 'LEXIE' ? 'Support operator' : 'Client'),
          content: m.content,
          timestamp: m.timestamp
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process panic trigger.' });
  }
};

export const emergencyPanicUser = async (req: Request, res: Response) => {
  req.url = '/api/auth/panic';
  return (req.app as any)._router.handle(req, res);
};

export const getRecoverySalt = (req: Request, res: Response) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  const queryName = (username as string).trim();
  const user = userRepository.findByUsername(queryName);
  if (!user) {
    const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy_recovery').digest('hex');
    return res.json({ salt: dummySalt });
  }

  if (user.recovery_key_hash && user.recovery_key_hash.startsWith('argon2id:')) {
    const parts = user.recovery_key_hash.split(':');
    if (parts.length === 3) {
      return res.json({ salt: parts[1] });
    }
  }

  return res.json({ salt: user.salt || null });
};

export const getUserSalt = (req: Request, res: Response) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  const queryName = (username as string).trim();
  const user = userRepository.findByUsername(queryName);
  if (!user) {
    const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
    return res.json({ salt: dummySalt });
  }
  return res.json({ salt: user.salt || null });
};

async function executeAccountRestoration(req: Request, res: Response) {
  const { username, safeWord, recoveryKey, newPassword, salt: clientSalt } = req.body;

  if (!username || !safeWord || !recoveryKey || !newPassword) {
    return res.status(400).json({ error: 'All recovery fields (Username, Safe Word, Recovery Key, and Password) are required.' });
  }

  loadDb();

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (!user) {
    return res.status(404).json({ error: 'User handle not found in databases.' });
  }

  if (user.status === 'compromised') {
    return res.status(403).json({ 
      error: 'CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.' 
    });
  }

  const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.safe_word_hash);

  if (!isSafeWordMatch) {
    return res.status(400).json({ error: 'Invalid Safe Word entered.' });
  }

  let matchesRecoveryKey = false;
  if (user.recovery_key_hash && user.recovery_key_hash.startsWith('argon2id:')) {
    const parts = user.recovery_key_hash.split(':');
    if (parts.length === 3) {
      const computedHash = await hashArgon2id(recoveryKey, Buffer.from(parts[1], 'hex'));
      if (computedHash === parts[2]) {
        matchesRecoveryKey = true;
      }
    }
  }

  if (!matchesRecoveryKey) {
    return res.status(400).json({ error: 'Invalid Recovery Key entered.' });
  }

  const newSalt = clientSalt || crypto.randomBytes(32).toString('hex');
  const newSaltBuf = Buffer.from(newSalt, 'hex');
  const passHashHex = await hashArgon2id(newPassword, newSaltBuf);
  const swHashHex = await hashArgon2id(safeWord, newSaltBuf);

  user.salt = newSalt;
  user.password_hash = `argon2id:${passHashHex}`;
  user.safe_word_hash = `argon2id:${swHashHex}`;
  user.needs_reset = false;
  user.status = 'active';
  user.updated_at = new Date().toISOString();

  db.sessions = db.sessions.map(s => {
    if (s.user_id === user.user_id) {
      return { ...s, status: 'revoked', end_time: new Date().toISOString() };
    }
    return s;
  });

  if (db.tickets) {
    const ticket = db.tickets.find(t => t.user_id === user.user_id && t.provided_recovery_key === recoveryKey);
    if (ticket) {
      ticket.status = 'resolved';
      ticket.resolved_at = new Date().toISOString();
      if (!ticket.messages) ticket.messages = [];
      ticket.messages.push({
        sender_id: 0,
        sender_name: 'SYSTEM',
        content: 'Account restored successfully via automated recovery verification sequence.',
        timestamp: new Date().toISOString()
      });
    }
  }

  if (!db.recovery_events) db.recovery_events = [];
  db.recovery_events.push({
    event_id: `rec_auto_${Date.now()}`,
    user_id: user.user_id,
    method: 'automatic_recovery',
    approved_by: null,
    timestamp: new Date().toISOString(),
    notes: 'Account access and password reset successfully authenticated via Recovery Key and Safe Word parameters.'
  });

  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.push({
    log_id: `al_${Date.now()}`,
    admin_id: 0,
    admin_name: 'SYSTEM',
    action: 'restore',
    target_type: 'user',
    target_id: user.user_id.toString(),
    reason: `Account access restored for "${user.username}" via automated Recovery Key & Safe Word validation.`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return res.json({ success: true, message: 'Account successfully restored. You can now log in with your new password.' });
}

export const recoverAutomatic = async (req: Request, res: Response) => {
  return await executeAccountRestoration(req, res);
};

export const recoverAccount = async (req: Request, res: Response) => {
  return await executeAccountRestoration(req, res);
};

export const restoreAccount = async (req: Request, res: Response) => {
  return await executeAccountRestoration(req, res);
};

export const redeemRestoreCode = async (req: Request, res: Response) => {
  try {
    const { username, restoreCode, newPassword } = req.body;

    if (!username || !restoreCode || !newPassword) {
      return res.status(400).json({ error: 'All fields (Username, Code, New Password) are required.' });
    }

    loadDb();

    const queryName = username.trim();
    const user = userRepository.findByUsername(queryName);

    if (!user) {
      return res.status(404).json({ error: 'User handle not found in databases.' });
    }

    const cleanCode = restoreCode.trim();
    const matchesCode = (user as any).temp_restore_code && (user as any).temp_restore_code === cleanCode;

    if (!matchesCode) {
      return res.status(400).json({ error: 'Invalid or incorrect restoration code.' });
    }

    const newSalt = crypto.randomBytes(32).toString('hex');
    const newSaltBuf = Buffer.from(newSalt, 'hex');
    const passHashHex = await hashArgon2id(newPassword, newSaltBuf);

    user.salt = newSalt;
    user.password_hash = `argon2id:${passHashHex}`;
    user.status = 'active';
    delete (user as any).temp_restore_code;
    user.updated_at = new Date().toISOString();

    const ticket = db.tickets.find(t => t.user_id === user.user_id && t.provided_recovery_key === cleanCode);
    if (ticket) {
      ticket.status = 'resolved';
      ticket.resolved_at = new Date().toISOString();
      if (!ticket.messages) ticket.messages = [];
      ticket.messages.push({
        sender_id: 0,
        sender_name: 'SYSTEM',
        content: 'Account restored successfully via Secure Restoration Code redemption channel.',
        timestamp: new Date().toISOString()
      });
    }

    db.recovery_events.push({
      event_id: `rec_code_${Date.now()}`,
      user_id: user.user_id,
      method: 'restoration_code_redemption' as any,
      approved_by: null,
      timestamp: new Date().toISOString(),
      notes: 'Account unlocked and new credentials established via verified restoration code.'
    });

    db.audit_logs.push({
      log_id: `al_${Date.now()}`,
      admin_id: 0,
      admin_name: 'SYSTEM',
      action: 'restore',
      target_type: 'user',
      target_id: user.user_id.toString(),
      reason: `Account access restored for "${user.username}" via administrative code validation.`,
      timestamp: new Date().toISOString()
    });

    saveDb();

    res.json({ success: true, message: 'Account successfully restored. You can now log in with your new password.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to redeem restoration code.' });
  }
};

export const recoverSafeword = async (req: Request, res: Response) => {
  try {
    const { username, safeWord, newPassword } = req.body;

    if (!username || !safeWord || !newPassword) {
      return res.status(400).json({ error: 'All recovery fields are required.' });
    }

    loadDb();

    const queryName = username.trim();
    const user = userRepository.findByUsername(queryName);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.status === 'compromised') {
      return res.status(403).json({ 
        error: 'CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.' 
      });
    }

    const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.safe_word_hash);

    if (isSafeWordMatch) {
      const newSalt = crypto.randomBytes(32).toString('hex');
      const newSaltBuf = Buffer.from(newSalt, 'hex');

      const passHashHex = await hashArgon2id(newPassword, newSaltBuf);
      const swHashHex = await hashArgon2id(safeWord, newSaltBuf);

      user.salt = newSalt;
      user.password_hash = `argon2id:${passHashHex}`;
      user.safe_word_hash = `argon2id:${swHashHex}`;
      user.needs_reset = false;
      user.status = 'active';
      user.updated_at = new Date().toISOString();

      db.recovery_events.push({
        event_id: `rec_sw_${Date.now()}`,
        user_id: user.user_id,
        method: 'automatic_recovery',
        approved_by: null,
        timestamp: new Date().toISOString(),
        notes: 'Safe Word reset successful. Password updated to high-security format.'
      });

      saveDb();
      return res.json({ success: true, message: 'Password reset successful. Try logging in now.' });
    } else {
      return res.status(400).json({ error: 'Invalid Safe Word entered.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to recover via safeword.' });
  }
};
