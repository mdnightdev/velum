import crypto from 'crypto';
import { db, saveDb, ensureVelumSystemDM } from '../db.js';
import { verifyArgon2id, hashArgon2id } from '../services/cryptoService.js';
import { generateUlid, generatePrefixedId } from '../utils/ulid.js';
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
  db.messages = (db.messages || []).filter(m => m.room_id === 'velum_lounge');
  db.lounges = [];
  db.market_listings = [];
  db.escrow_transactions = [];
  db.tickets = [];
  db.recovery_events = [];
  db.suspicious_events = [];
  db.invites = [];
  saveDb(true);
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

  const sessionId = generateUlid();
  const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
  const SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

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

  db.sessions.push(newSession);
  saveDb();
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
  // Seed the 4 official frontend simulated financial methods for the new user
  if (!db.external_financial_accounts) db.external_financial_accounts = [];
  if (!db.payment_methods) db.payment_methods = [];

  const defaultMethods = [
    { kind: 'CARD', institution: 'Visa', number: '4222 2222 2222 4242', label: 'Visa Card ****4242', balance: 500000 },
    { kind: 'CARD', institution: 'Mastercard', number: '5105 1051 0510 5105', label: 'Mastercard ****5105', balance: 500000 },
    { kind: 'CARD', institution: 'American Express', number: '3782 8224 6310 005', label: 'American Express ****0005', balance: 500000 },
    { kind: 'BANK_ACCOUNT', institution: 'Taiwan Cooperative Bank', number: '7000 0012 3456 7890', label: 'Taiwan Cooperative Bank ****7890', balance: 1500000 }
  ];

  db.external_financial_accounts = db.external_financial_accounts || [];
  db.payment_methods = db.payment_methods || [];

  defaultMethods.forEach((method, index) => {
    const accountToken = generatePrefixedId('tok');
    
    db.external_financial_accounts!.push({
      account_token: accountToken,
      user_id: userId,
      account_kind: method.kind,
      institution: method.institution,
      masked_number: method.number,
      available_cents: method.balance,
      expires_at_sim: method.kind === 'CARD' ? Date.now() + 31536000000 * 3 : null,
      is_active: true,
      created_at: Date.now()
    });

    db.payment_methods!.push({
      payment_method_id: generatePrefixedId('pm'),
      user_id: userId,
      method_type: method.kind,
      external_account_token: accountToken,
      display_label: method.label,
      is_default: index === 0, // Sets Visa as default initially
      status: 'ACTIVE',
      added_at: Date.now()
    });
  });



  saveDb();

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
  if (ipRecord && ipRecord.blockUntil && Date.now() < ipRecord.blockUntil) {
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

  if (user.needs_reset || !user.salt) {
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

