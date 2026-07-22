import crypto from 'crypto';
import { db, saveDb, ensureVelumSystemDM, sqliteDb } from '../db.js';
import { verifyArgon2id, hashArgon2id, encryptData } from '../services/cryptoService.js';
import { generateUlid, generateSecureSessionToken, generatePrefixedId } from '../utils/ulid.js';
import { cleanIp, getIpGeoLocation, getIpGeoData, getCurrencyForCountryCode } from '../utils.js';
import { Session, User } from '../../src/types.js';
import { userRepository } from '../db/userRepository.js';

export interface LoginValidationResult {
  isValid: boolean;
  usedRecoveryBypass?: boolean;
  needsMigration?: boolean;
}

/**
 * Validate standard credentials and Argon2id passwords
 */
export async function validateCredentials(
  user: User,
  passwordHex: string
): Promise<LoginValidationResult> {
  const isPasswordValid = await verifyArgon2id(passwordHex, user.salt, user.password_hash);
  
  if (!isPasswordValid && user.role === 'USER' && user.recovery_key_hash) {
    const isRecoveryKeyMatch = await verifyArgon2id(passwordHex, undefined, user.recovery_key_hash);
    if (isRecoveryKeyMatch) {
      user.needs_reset = true;
      saveDb();
      return { isValid: true, usedRecoveryBypass: true };
    }
  }

  return { isValid: isPasswordValid };
}

/**
 * Execute standard SQL WAL cascade purging for panic triggers
 */
export function executePanicWipe() {
  db.messages = [];
  db.lounges = [];
  db.market_listings = [];
  db.escrow_transactions = [];
  db.tickets = [];
  db.recovery_events = [];
  db.suspicious_events = [];
  db.invites = [];
  saveDb();
}

/**
 * Instantiate a new session and save to database
 */
export function createNewSession(
  userId: number,
  deviceId: string,
  ipId: string
): { sessionId: string; sessionRecord: Session } {
  // Revoke active sessions for this user
  db.sessions = db.sessions.map(s => {
    if (s.user_id === userId && s.status === 'active') {
      return { ...s, status: 'revoked', end_time: new Date().toISOString() };
    }
    return s;
  });

  const sessionId = generateSecureSessionToken();
  const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
  const SESSION_EXPIRATION_MS = 1 * 60 * 60 * 1000;

  const newSession: Session = {
    session_id: hashedSessionId,
    user_id: userId,
    device_id: deviceId,
    ip_id: ipId,
    status: 'active',
    start_time: new Date().toISOString(),
    end_time: null,
    expires_at: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
    activity_metrics: { messagesSent: 0, lastPing: new Date().toISOString() }
  };

  try {
    sqliteDb.prepare("INSERT OR REPLACE INTO sessions (id, payload) VALUES (?, ?)").run(newSession.session_id, encryptData(JSON.stringify(newSession)));
  } catch (err) {
    console.error('Failed to write session directly to SQLite:', err);
  }
  db.sessions.push(newSession);
  return { sessionId, sessionRecord: newSession };
}

/**
 * Core business logic for user registration
 */
export async function performUserRegistration(params: {
  username: string;
  passwordHex: string;
  safeWordHex: string;
  panicPhraseHex: string;
  inviteCode?: string;
  deviceFingerprint?: string;
  recoveryKeyHash?: string;
  recoveryKey?: string;
  salt?: string;
  plainRecoveryKey?: string;
  ipAddress: string;
}): Promise<{ userId: number; deviceId: string }> {
  const {
    username,
    passwordHex,
    safeWordHex,
    panicPhraseHex,
    inviteCode,
    deviceFingerprint,
    recoveryKeyHash,
    recoveryKey,
    salt: clientSalt,
    plainRecoveryKey,
    ipAddress,
  } = params;

  let formattedUsername = username.trim();
  const existingUser = userRepository.findByUsername(formattedUsername);
  if (existingUser) {
    throw new Error('Username handle already taken.');
  }

  if (inviteCode) {
    const invite = db.invites.find(i => i.code === inviteCode && i.status === 'active');
    if (!invite) {
      throw new Error('Invalid or expired invite code.');
    }
    invite.status = 'used';
    invite.used_at = new Date().toISOString();
  }

  const userId = userRepository.nextId();
  
  let finalRecoveryKeyHash = recoveryKeyHash;
  let serverGeneratedPlainKey = '';
  if (recoveryKey && clientSalt) {
    finalRecoveryKeyHash = `argon2id:${clientSalt}:${recoveryKey}`;
  } else if (!finalRecoveryKeyHash) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const rawKey = `VEL-REC-${code}`;
    const keySalt = crypto.randomBytes(32);
    const hashHex = await hashArgon2id(rawKey, keySalt);
    finalRecoveryKeyHash = `argon2id:${keySalt.toString('hex')}:${hashHex}`;
    serverGeneratedPlainKey = rawKey;
  }

  const salt = clientSalt || crypto.randomBytes(32).toString('hex');
  const saltBuf = Buffer.from(salt, 'hex');
  
  const password_hash_raw = await hashArgon2id(passwordHex, saltBuf);
  const password_hash = `argon2id:${password_hash_raw}`;
  
  const safe_word_hash_raw = await hashArgon2id(safeWordHex, saltBuf);
  const safe_word_hash = `argon2id:${safe_word_hash_raw}`;
  
  const panic_phrase_hash_raw = await hashArgon2id(panicPhraseHex, saltBuf);
  const panic_phrase_hash = `argon2id:${panic_phrase_hash_raw}`;

  const geoBase = await getIpGeoData(ipAddress);

  const newUser: User = {
    user_id: userId,
    username: formattedUsername,
    salt,
    password_hash,
    safe_word_hash,
    panic_phrase_hash,
    recovery_key_hash: finalRecoveryKeyHash,
    role: 'USER',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    uid: `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}`,
    preferred_currency: getCurrencyForCountryCode(geoBase.countryCode)
  };

  userRepository.create(newUser);

  ensureVelumSystemDM(newUser.user_id, newUser.username, plainRecoveryKey || serverGeneratedPlainKey || '');

  db.profiles.push({
    profile_id: `p_${userId}`,
    user_id: userId,
    bio: 'Proud Velum user.',
    avatar: 'user',
    settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 },
    updated_at: new Date().toISOString(),
    location: geoBase.location ?? null,
    ip_address: ipAddress,
    device_fingerprint: deviceFingerprint || 'Generic Web User Agent'
  } as any);

  const deviceId = generatePrefixedId('dev');
  db.devices.push({
    device_id: deviceId,
    user_id: userId,
    fingerprint: deviceFingerprint || 'Generic Web User Agent',
    risk_score: 5,
    accounts_linked: 1,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: 'trusted'
  });

  const ipId = generatePrefixedId('ip');
  db.ip_addresses.push({
    ip_id: ipId,
    user_id: userId,
    ip_address: ipAddress,
    risk_score: 5,
    accounts_linked: 1,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString()
  });
  saveDb(true);
  return { userId, deviceId };
}


export type LoginAttemptResult = 
  | { status: 'SUCCESS'; user: any; profile: any; sessionId: string; deviceId: string; signedToken: string }
  | { status: 'NEEDS_ACTIVATION'; user: any }
  | { status: 'NEEDS_MIGRATION'; user: any }
  | { status: 'COMPROMISED'; tracking_uuid: string; ticket: any }
  | { status: 'RATE_LIMITED'; waitSeconds: number }
  | { status: 'SUSPENDED' }
  | { status: 'REVOKED_SUPPORT' }
  | { status: 'INVALID_CREDENTIALS' };

import { generateSessionToken, rateLimiterCache } from '../middleware.js';
import { calculateBackoffMs } from '../crypto.js';

export async function performUserLogin(params: {
  username: string;
  passwordHex: string;
  ipAddress: string;
  fingerprint: string;
  generateSessionToken: any;
  rateLimiterCache: any;
  calculateBackoffMs: any;
}): Promise<LoginAttemptResult> {
  const { username, passwordHex, ipAddress, fingerprint, generateSessionToken, rateLimiterCache, calculateBackoffMs } = params;

  const ipRlKey = `ip:${ipAddress}`;
  const ipRecord = rateLimiterCache.get(ipRlKey);
  if (false && ipRecord && ipRecord.blockUntil && Date.now() < ipRecord.blockUntil) {
    return { status: 'RATE_LIMITED', waitSeconds: Math.ceil((ipRecord.blockUntil - Date.now()) / 1000) };
  }

  const userRlKey = `user:${username.trim().toLowerCase()}`;
  const userRecord = rateLimiterCache.get(userRlKey);
  if (userRecord && userRecord.blockUntil && Date.now() < userRecord.blockUntil) {
    return { status: 'RATE_LIMITED', waitSeconds: Math.ceil((userRecord.blockUntil - Date.now()) / 1000) };
  }

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (user && user.role === 'SUPPORT_ADMIN') {
    const baseCleanName = user.username.replace(/^SA-/, '');
    const baseUser = userRepository.findByUsername(baseCleanName);
    if (!baseUser || baseUser.promotion_status !== 'APPROVED_SUPPORT') {
      return { status: 'REVOKED_SUPPORT' };
    }
  }

  if (user && user.activation_status === 'AWAITING_ACTIVATION') {
    return { status: 'NEEDS_ACTIVATION', user };
  }

  if (user) {
    const isPanicPhrase = await verifyArgon2id(passwordHex, user.salt, user.panic_phrase_hash);
    if (isPanicPhrase) {
      executePanicWipe();

      const deviceId = generatePrefixedId('dev');
      const ipId = generatePrefixedId('ip');
      const geoBase = await getIpGeoLocation(ipAddress);
      const { sessionId } = createNewSession(user.user_id, deviceId, ipId);

      const signedToken = generateSessionToken(user.user_id, user.username, 'USER', deviceId, sessionId);
      return {
        status: 'SUCCESS',
        user: { userId: user.user_id, username: user.username, role: 'USER', status: 'active' },
        profile: {
          profile_id: `p_${user.user_id}`,
          user_id: user.user_id,
          bio: 'Proud Velum user.',
          avatar: 'user',
          location: geoBase,
          updated_at: new Date().toISOString()
        },
        sessionId,
        deviceId,
        signedToken
      };
    }
  }

  let isPasswordValid = false;
  if (user) {
    const authResult = await validateCredentials(user, passwordHex);
    isPasswordValid = authResult.isValid;
  } else {
    const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
    const dummyHash = `argon2id:${dummySalt}:${crypto.createHash('sha256').update('dummy_hash_placeholder').digest('hex')}`;
    await verifyArgon2id(passwordHex, dummySalt, dummyHash);
  }

  if (!user || !isPasswordValid) {
    const uRecord = rateLimiterCache.get(userRlKey) || { attempts: 0, blockUntil: 0 };
    uRecord.attempts += 1;
    const backoff1 = calculateBackoffMs(uRecord.attempts);
    if (backoff1 > 0) uRecord.blockUntil = Date.now() + backoff1;
    rateLimiterCache.set(userRlKey, uRecord);

    const iRecord = rateLimiterCache.get(ipRlKey) || { attempts: 0, blockUntil: 0 };
    iRecord.attempts += 1;
    const backoff2 = calculateBackoffMs(iRecord.attempts);
    if (backoff2 > 0) iRecord.blockUntil = Date.now() + backoff2;
    rateLimiterCache.set(ipRlKey, iRecord);

    db.suspicious_events.push({
      event_id: generatePrefixedId('se'),
      entity_type: 'user',
      entity_id: username,
      risk_level: 'intermediate',
      description: `Failed login attempt for account ${username}`,
      created_at: new Date().toISOString()
    } as any);
    saveDb();
    return { status: 'INVALID_CREDENTIALS' };
  }

  rateLimiterCache.delete(userRlKey);
  rateLimiterCache.delete(ipRlKey);

  const isAdminRole = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
  if ((user.needs_reset || !user.salt) && !isAdminRole) {
    return { status: 'NEEDS_MIGRATION', user };
  }

  if (user.status === 'compromised') {
    db.tickets = db.tickets || [];
    let ticket = db.tickets.find(t => t.user_id === user.user_id && t.issue_type === 'recovery_request' && t.status !== 'resolved');
    if (!ticket) {
      const ticketId = generatePrefixedId('t');
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
          { sender_id: 0, sender_name: 'SYSTEM', content: 'SECURITY EVENT INITIATED. Account quarantined from emergency panic phrase trigger. High-credibility restore process started.', timestamp: new Date().toISOString() },
          { sender_id: 0, sender_name: 'SYSTEM', content: 'To coordinate with central control administrators and obtain your restore code, please formulate details in the chat below.', timestamp: new Date().toISOString() }
        ]
      } as any;
      if (ticket) db.tickets.push(ticket as any);
      db.audit_logs.push({
        log_id: generatePrefixedId('al'),
        admin_id: 0,
        admin_name: 'SYSTEM',
        action: 'panic_lock',
        target_type: 'user',
        target_id: user.user_id.toString(),
        reason: 'Auto-recovery ticket instantiated securely on authenticated login attempt.',
        timestamp: new Date().toISOString()
      } as any);
      saveDb();
    }
    return { status: 'COMPROMISED', tracking_uuid: ticket?.tracking_id || '', ticket: ticket! };
  }

  if (user.status === 'suspended') {
    return { status: 'SUSPENDED' };
  }

  const geoBase = await getIpGeoLocation(ipAddress);
  const profile = db.profiles.find(p => p.user_id === user.user_id);
  if (profile) {
    (profile as any).ip_address = ipAddress;
    (profile as any).device_fingerprint = fingerprint;
    if (!profile.location || profile.location === 'Poland') {
      profile.location = geoBase;
    }
    profile.updated_at = new Date().toISOString();
  }

  const isNewIp = !db.ip_addresses.some(ip => ip && ip.user_id === user.user_id && ip.ip_address === ipAddress);
  const isNewDevice = !db.devices.some(dev => dev && dev.user_id === user.user_id && dev.fingerprint === fingerprint);

  if (isNewIp || isNewDevice) {
    console.warn(`[SYS-SECURE] Suspicious login detected for user ${user.username}: New IP or device fingerprint.`);
    db.suspicious_events = db.suspicious_events || [];
    db.suspicious_events.push({
      event_id: generatePrefixedId('se'),
      user_id: user.user_id,
      ip_address: ipAddress,
      device_fingerprint: fingerprint,
      event_type: 'suspicious_login',
      details: `Login from new IP (${ipAddress}) or new device fingerprint.`,
      timestamp: new Date().toISOString()
    } as any);
  }

  const ipId = generatePrefixedId('ip');
  db.ip_addresses.push({
    ip_id: ipId,
    user_id: user.user_id,
    ip_address: ipAddress,
    risk_score: 5,
    accounts_linked: 1,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    associated_fingerprints: [fingerprint]
  } as any);

  const deviceId = generatePrefixedId('dev');
  db.devices.push({
    device_id: deviceId,
    user_id: user.user_id,
    fingerprint,
    trust_score: 50,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    associated_ips: [ipAddress]
  } as any);
  saveDb();

  const { sessionId } = createNewSession(user.user_id, deviceId, ipId);
  const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

  return {
    status: 'SUCCESS',
    user: {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      status: user.status
    },
    profile,
    sessionId,
    deviceId,
    signedToken
  };
}

export async function performPermanentOtpRegistration(params: {
  username: string;
  passwordHex: string;
  permanentOtp: string;
  ipAddress: string;
  fingerprint: string;
}): Promise<{
  user: any;
  profile: any;
  sessionId: string;
  deviceId: string;
  destination: string;
}> {
  const { username, passwordHex, permanentOtp, ipAddress, fingerprint } = params;

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (!user) {
    throw new Error('User context not found.');
  }

  const isPasswordValid = await verifyArgon2id(passwordHex, user.salt, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials.');
  }

  if (user.role !== 'LOGIN_ADMIN' && user.role !== 'SUPPORT_ADMIN') {
    throw new Error('FAIL: Only web administrators can set permanent OTP keys.');
  }

  const otpClean = permanentOtp.trim();
  if (otpClean.length < 4) {
    throw new Error('Permanent security OTP must contain at least 4 alphanumeric characters.');
  }

  user.permanent_otp = otpClean;
  saveDb();

  const geoBase = await getIpGeoLocation(ipAddress);

  const profile = db.profiles.find(p => p.user_id === user.user_id);
  if (profile) {
    (profile as any).ip_address = ipAddress;
    (profile as any).device_fingerprint = fingerprint;
    if (!profile.location) {
      profile.location = geoBase;
    }
    profile.updated_at = new Date().toISOString();
  }

  const ipId = generatePrefixedId('ip');
  db.ip_addresses.push({
    ip_id: ipId,
    user_id: user.user_id,
    ip_address: ipAddress,
    risk_score: 5,
    accounts_linked: 1,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString()
  });

  const deviceId = generatePrefixedId('dev');
  db.devices.push({
    device_id: deviceId,
    user_id: user.user_id,
    fingerprint,
    risk_score: 5,
    accounts_linked: 1,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: 'trusted'
  });

  const sessionId = generateSecureSessionToken();
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

  try {
    sqliteDb.prepare("INSERT OR REPLACE INTO sessions (id, payload) VALUES (?, ?)").run(newSession.session_id, encryptData(JSON.stringify(newSession)));
  } catch (err) {
    console.error('Failed to write session directly to SQLite:', err);
  }
  db.sessions.push(newSession);

  ensureVelumSystemDM(user.user_id, user.username, '');

  const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

  let destination = 'chat';
  if ((user.role as string) === 'CLI_ADMIN') destination = 'cli';
  else if ((user.role as string) === 'LOGIN_ADMIN') destination = 'admin';

  return {
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
  };
}

export async function performUserMigration(params: {
  userId: string;
  username: string;
  passwordHex: string;
  safeWordHex: string;
  panicPhraseHex: string;
}): Promise<{ success: boolean; username: string }> {
  const { userId, username, passwordHex, safeWordHex, panicPhraseHex } = params;

  const user = userRepository.findById(parseInt(userId, 10));
  if (!user) {
    throw new Error('User context not found.');
  }

  if (user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN') {
    throw new Error('FAIL: Administrative users are not permitted to use this migration flow.');
  }

  let formattedUsername = username.trim();
  if (user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN') {
    formattedUsername = user.username;
  } else {
    if (formattedUsername.includes(' ')) {
      throw new Error('Username must not contain any spaces.');
    }
    if (!formattedUsername.startsWith('@')) {
      formattedUsername = `@${formattedUsername}`;
    }
  }

  const duplicate = userRepository.findByUsername(formattedUsername);
  if (duplicate && duplicate.user_id !== user.user_id) {
    throw new Error('That username handle is already taken.');
  }

  const salt = user.salt || crypto.randomBytes(32).toString('hex');
  const saltBuf = Buffer.from(salt, 'hex');

  const password_hash_raw = await hashArgon2id(passwordHex, saltBuf);
  const password_hash = `argon2id:${password_hash_raw}`;

  const safe_word_hash_raw = await hashArgon2id(safeWordHex, saltBuf);
  const safe_word_hash = `argon2id:${safe_word_hash_raw}`;

  const panic_phrase_hash_raw = await hashArgon2id(panicPhraseHex, saltBuf);
  const panic_phrase_hash = `argon2id:${panic_phrase_hash_raw}`;

  user.username = formattedUsername;
  user.salt = salt;
  user.password_hash = password_hash;
  user.safe_word_hash = safe_word_hash;
  user.panic_phrase_hash = panic_phrase_hash;
  user.needs_reset = false;
  user.updated_at = new Date().toISOString();

  saveDb();

  return { success: true, username: user.username };
}

export async function performAdminActivation(params: {
  userId: string;
  newPasswordHex: string;
  newSafeWordHex: string;
  newPanicPhraseHex: string;
}): Promise<{
  user: any;
  profile: any;
  sessionId: string;
  deviceId: string;
}> {
  const { userId, newPasswordHex, newSafeWordHex, newPanicPhraseHex } = params;

  const user = userRepository.findById(parseInt(userId, 10));
  if (!user || user.role !== 'SUPPORT_ADMIN') {
    throw new Error('Administrative user profile not found.');
  }

  const salt = crypto.randomBytes(32).toString('hex');
  const saltBuf = Buffer.from(salt, 'hex');

  const password_hash_raw = await hashArgon2id(newPasswordHex, saltBuf);
  const password_hash = `argon2id:${password_hash_raw}`;

  const safe_word_hash_raw = await hashArgon2id(newSafeWordHex, saltBuf);
  const safe_word_hash = `argon2id:${safe_word_hash_raw}`;

  const panic_phrase_hash_raw = await hashArgon2id(newPanicPhraseHex, saltBuf);
  const panic_phrase_hash = `argon2id:${panic_phrase_hash_raw}`;

  user.salt = salt;
  user.password_hash = password_hash;
  user.safe_word_hash = safe_word_hash;
  user.panic_phrase_hash = panic_phrase_hash;
  user.activation_status = 'ACTIVATED';
  user.updated_at = new Date().toISOString();

  saveDb();

  const deviceId = `dev_admin_${Math.random().toString(36).substring(2, 8)}`;
  const sessionId = generateSecureSessionToken();
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

  try {
    sqliteDb.prepare("INSERT OR REPLACE INTO sessions (id, payload) VALUES (?, ?)").run(newSession.session_id, encryptData(JSON.stringify(newSession)));
  } catch (err) {
    console.error('Failed to write session directly to SQLite:', err);
  }
  db.sessions.push(newSession);

  const profile = db.profiles.find(p => p.user_id === user.user_id);
  const signedToken = generateSessionToken(user.user_id, user.username, user.role, deviceId, sessionId);

  return {
    user: {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      status: user.status
    },
    profile,
    sessionId: signedToken,
    deviceId
  };
}

export function performUserLogout(sessionId: string): void {
  const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
  db.sessions = db.sessions.map(s => {
    if (s.session_id === sessionId || s.session_id === hashedSessionId) {
      return { ...s, status: 'revoked', end_time: new Date().toISOString() };
    }
    return s;
  });
  saveDb(true);
}

export async function performUserPanic(params: {
  userId?: string;
  username?: string;
  panicPhrase: string;
}): Promise<{ success: boolean; message: string; ticket: any }> {
  const { userId, username, panicPhrase } = params;

  let user;
  if (userId) {
    user = userRepository.findById(parseInt(userId, 10));
  } else if (username) {
    user = userRepository.findByUsername(username.trim());
  } else {
    throw new Error('User context and target account parameter are required.');
  }

  if (!user) {
    throw new Error('Target user context not found in cryptographic database.');
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
    throw new Error('Verification failed: Emergency panic phrase match invalid.');
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
  let ticket: any = db.tickets.find(t => t.user_id === user.user_id && t.issue_type === 'recovery_request' && t.status !== 'resolved');
  if (!ticket) {
    const ticketId = generatePrefixedId('t');
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
    } as any;
    db.tickets.push(ticket);
  }

  db.suspicious_events.push({
    event_id: generatePrefixedId('se'),
    entity_type: 'user',
    entity_id: user.user_id.toString(),
    risk_level: 'critical',
    description: `PANIC PHRASE ACTIVATED for user ID ${user.user_id}. Session containment triggered immediately.`,
    created_at: new Date().toISOString()
  } as any);

  db.audit_logs = db.audit_logs || [];
  db.audit_logs.push({
    log_id: generatePrefixedId('al'),
    admin_id: 0,
    admin_name: 'SYSTEM',
    action: 'panic_lock',
    target_type: 'user',
    target_id: user.user_id.toString(),
    reason: `CRITICAL SEC_ALERT: Account "${user.username}" quarantined via emergency panic phrase trigger. Sessions Terminated. Auto-recovery ticket #${ticket.ticket_id} instantiated.`,
    timestamp: new Date().toISOString()
  } as any);

  saveDb();

  return {
    success: true,
    message: 'CRITICAL SHIELD ACTIVATED. Account enters quarantine immediately. All connected sessions destroyed. Access ticket created.',
    ticket
  };
}

export async function performAccountRestoration(params: {
  username: string;
  safeWord: string;
  recoveryKey: string;
  newPasswordHex: string;
  clientSalt?: string;
}): Promise<{ success: boolean; message: string }> {
  const { username, safeWord, recoveryKey, newPasswordHex, clientSalt } = params;

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (!user) {
    throw new Error('User handle not found in databases.');
  }

  if (user.status === 'compromised') {
    throw new Error('CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.');
  }

  const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.safe_word_hash);

  if (!isSafeWordMatch) {
    throw new Error('Invalid Safe Word entered.');
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
    throw new Error('Invalid Recovery Key entered.');
  }

  const newSalt = clientSalt || crypto.randomBytes(32).toString('hex');
  const newSaltBuf = Buffer.from(newSalt, 'hex');
  const passHashHex = await hashArgon2id(newPasswordHex, newSaltBuf);
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
    event_id: generatePrefixedId('rec_auto'),
    user_id: user.user_id,
    method: 'automatic_recovery',
    approved_by: null,
    timestamp: new Date().toISOString(),
    notes: 'Account access and password reset successfully authenticated via Recovery Key and Safe Word parameters.'
  });

  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.push({
    log_id: generatePrefixedId('al'),
    admin_id: 0,
    admin_name: 'SYSTEM',
    action: 'restore',
    target_type: 'user',
    target_id: user.user_id.toString(),
    reason: `Account access restored for "${user.username}" via automated Recovery Key & Safe Word validation.`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return { success: true, message: 'Account successfully restored. You can now log in with your new password.' };
}

export async function performRestoreCodeRedemption(params: {
  username: string;
  restoreCode: string;
  newPasswordHex: string;
}): Promise<{ success: boolean; message: string }> {
  const { username, restoreCode, newPasswordHex } = params;

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (!user) {
    throw new Error('User handle not found in databases.');
  }

  const cleanCode = restoreCode.trim();
  const matchesCode = (user as any).temp_restore_code && (user as any).temp_restore_code === cleanCode;

  if (!matchesCode) {
    throw new Error('Invalid or incorrect restoration code.');
  }

  const newSalt = crypto.randomBytes(32).toString('hex');
  const newSaltBuf = Buffer.from(newSalt, 'hex');
  const passHashHex = await hashArgon2id(newPasswordHex, newSaltBuf);

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

  if (!db.recovery_events) db.recovery_events = [];
  db.recovery_events.push({
    event_id: generatePrefixedId('rec_code'),
    user_id: user.user_id,
    method: 'restoration_code_redemption' as any,
    approved_by: null,
    timestamp: new Date().toISOString(),
    notes: 'Account unlocked and new credentials established via verified restoration code.'
  });

  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.push({
    log_id: generatePrefixedId('al'),
    admin_id: 0,
    admin_name: 'SYSTEM',
    action: 'restore',
    target_type: 'user',
    target_id: user.user_id.toString(),
    reason: `Account access restored for "${user.username}" via administrative code validation.`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  return { success: true, message: 'Account successfully restored. You can now log in with your new password.' };
}

export async function performSafewordRecovery(params: {
  username: string;
  safeWord: string;
  newPasswordHex: string;
}): Promise<{ success: boolean; message: string }> {
  const { username, safeWord, newPasswordHex } = params;

  const queryName = username.trim();
  const user = userRepository.findByUsername(queryName);

  if (!user) {
    throw new Error('User not found.');
  }

  if (user.status === 'compromised') {
    throw new Error('CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.');
  }

  const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.safe_word_hash);

  if (!isSafeWordMatch) {
    throw new Error('Invalid Safe Word entered.');
  }

  const newSalt = crypto.randomBytes(32).toString('hex');
  const newSaltBuf = Buffer.from(newSalt, 'hex');

  const passHashHex = await hashArgon2id(newPasswordHex, newSaltBuf);
  const swHashHex = await hashArgon2id(safeWord, newSaltBuf);

  user.salt = newSalt;
  user.password_hash = `argon2id:${passHashHex}`;
  user.safe_word_hash = `argon2id:${swHashHex}`;
  user.needs_reset = false;
  user.status = 'active';
  user.updated_at = new Date().toISOString();

  if (!db.recovery_events) db.recovery_events = [];
  db.recovery_events.push({
    event_id: generatePrefixedId('rec_sw'),
    user_id: user.user_id,
    method: 'automatic_recovery',
    approved_by: null,
    timestamp: new Date().toISOString(),
    notes: 'Safe Word reset successful. Password updated to high-security format.'
  });

  saveDb();
  return { success: true, message: 'Password reset successful. Try logging in now.' };
}

