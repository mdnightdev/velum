import crypto from 'crypto';
import { db, saveDb, ensureVelumSystemDM } from '../db.js';
import { verifyArgon2id } from '../utils/crypto.js';
import { generateUlid } from '../utils/ulid.js';
import { cleanIp, getIpGeoLocation } from '../utils.js';
import { Session, User } from '../../src/types.js';

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
