import crypto from 'crypto';
import { db, saveDb, ensureVelumSystemDM } from '../db.js';
import { verifyArgon2id, hashArgon2id } from '../utils/crypto.js';
import { generateUlid, generatePrefixedId } from '../utils/ulid.js';
import { cleanIp, getIpGeoLocation } from '../utils.js';
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
    uid: `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}`
  };

  userRepository.create(newUser);

  ensureVelumSystemDM(newUser.user_id, newUser.username, plainRecoveryKey || serverGeneratedPlainKey || '');

  const geoBase = await getIpGeoLocation(ipAddress);

  db.profiles.push({
    profile_id: `p_${userId}`,
    user_id: userId,
    bio: 'Proud Velum user.',
    avatar: 'user',
    settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 },
    updated_at: new Date().toISOString(),
    location: geoBase ?? null,
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

  saveDb();

  return { userId, deviceId };
}
