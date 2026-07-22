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
import {
  validateCredentials,
  executePanicWipe,
  createNewSession,
  performUserRegistration,
  performUserLogin,
  performPermanentOtpRegistration,
  performUserMigration,
  performAdminActivation,
  performUserLogout,
  performUserPanic,
  performAccountRestoration,
  performRestoreCodeRedemption,
  performSafewordRecovery
} from '../services/authService.js';
import { userRepository } from '../db/userRepository.js';
import { hashArgon2id, 
  verifyArgon2id } from '../services/cryptoService.js';
import { checkStepOTP, getStepOTP } from '../services/otpService.js';
import { generateUlid, generatePrefixedId } from '../utils/ulid.js';
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
    const { username, password, fingerprint, nonce } = req.body;

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

    const resolvedFingerprint = (fingerprint || req.headers['user-agent'] || 'Generic Web User Agent') as string;

    loadDb();

    const result = await performUserLogin({
      username,
      passwordHex: password,
      ipAddress: ipStr,
      fingerprint: resolvedFingerprint,
      generateSessionToken,
      rateLimiterCache,
      calculateBackoffMs
    });

    if (result.status === 'RATE_LIMITED') {
      return res.status(429).json({ error: `Too many login failures. Please wait ${result.waitSeconds} seconds.` });
    }

    if (result.status === 'REVOKED_SUPPORT') {
      return res.status(403).json({ error: 'FAIL: Security credentials revoked. Companion support operator nomination status is invalid.' });
    }

    if (result.status === 'NEEDS_ACTIVATION') {
      return res.json({
        needsActivation: true,
        userId: result.user.user_id,
        username: result.user.username,
        role: result.user.role
      });
    }

    if (result.status === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (result.status === 'NEEDS_MIGRATION') {
      return res.json({ needsMigration: true, userId: result.user.user_id, username: result.user.username });
    }

    if (result.status === 'COMPROMISED') {
      return res.status(403).json({ 
        error: 'SECURITY LOCK: This account is flagged as COMPROMISED. A priority support escalation ticket is online.',
        compromisedPortalActive: true,
        ticket: {
          ticket_id: result.ticket.ticket_id,
          status: result.ticket.status,
          issue_type: result.ticket.issue_type,
          created_at: result.ticket.created_at,
          resolved_at: result.ticket.resolved_at,
          credibility_score: result.ticket.credibility_score,
          tracking_id: result.ticket.tracking_id,
          provided_recovery_key: result.ticket.provided_recovery_key || null,
          messages: (result.ticket.messages || []).map((m: any) => {
            const senderUser = (db.users || []).find((u: any) => u && Number(u.user_id) === Number(m.sender_id));
            const isOperator = m.sender_id === 0 ? false : (
              (senderUser && ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN'].includes(senderUser.role)) ||
              m.sender_name.startsWith('SA-') ||
              m.sender_name.startsWith('SUPPORT') ||
              ['Admin', 'cli_admin', 'Midnight', 'Lexie', 'lexie', '午夜兔子', 'LEXIE'].includes(m.sender_name)
            );
            return {
              sender_name: m.sender_id === 0 ? 'System' : (isOperator ? 'Support operator' : 'Client'),
              content: m.content,
              timestamp: m.timestamp
            };
          })
        }
      });
    }

    if (result.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account has been suspended by system administrators.' });
    }

    res.json({
      success: true,
      user: result.user,
      profile: result.profile,
      sessionId: result.signedToken,
      deviceId: result.deviceId
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(400).json({ error: err.message || 'Login sequence failed.' });
  }
};
export const registerPermanentOtp = async (req: Request, res: Response) => {
  try {
    const { username, password, permanentOtp } = req.body;

    if (!username || !password || !permanentOtp) {
      return res.status(400).json({ error: 'Username, password, and permanent OTP are required.' });
    }

    const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') as string;
    const ipClean = Array.isArray(clientIp) ? clientIp[0].split(',')[0].trim() : clientIp.split(',')[0].trim().replace('::ffff:', '');
    const resolvedFingerprint = 'Velum-Secure-Client-v3';

    loadDb();

    const result = await performPermanentOtpRegistration({
      username,
      passwordHex: password,
      permanentOtp,
      ipAddress: ipClean,
      fingerprint: resolvedFingerprint
    });

    res.json({
      success: true,
      user: result.user,
      profile: result.profile,
      sessionId: result.sessionId,
      deviceId: result.deviceId,
      destination: result.destination
    });
  } catch (err: any) {
    if (err.message === 'User context not found.') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Invalid credentials.') {
      return res.status(401).json({ error: err.message });
    }
    if (err.message === 'FAIL: Only web administrators can set permanent OTP keys.') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message === 'Permanent security OTP must contain at least 4 alphanumeric characters.') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to register permanent OTP.' });
  }
};

export const migrateUser = async (req: Request, res: Response) => {
  try {
    const { userId, username, password, safeWord, panicPhrase } = req.body;

    if (!userId || !username || !password || !safeWord || !panicPhrase) {
      return res.status(400).json({ error: 'All migration fields are required.' });
    }

    const result = await performUserMigration({
      userId,
      username,
      passwordHex: password,
      safeWordHex: safeWord,
      panicPhraseHex: panicPhrase
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'User context not found.') {
      return res.status(404).json({ error: err.message });
    }
    if (
      err.message === 'Username must not contain any spaces.' ||
      err.message === 'That username handle is already taken.'
    ) {
      return res.status(400).json({ error: err.message });
    }
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

    loadDb();

    const result = await performAdminActivation({
      userId,
      newPasswordHex: newPassword,
      newSafeWordHex: newSafeWord,
      newPanicPhraseHex: newPanicPhrase
    });

    res.json({
      success: true,
      user: result.user,
      profile: result.profile,
      sessionId: result.sessionId,
      deviceId: result.deviceId
    });
  } catch (err: any) {
    if (err.message === 'Administrative user profile not found.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to activate administrator account.' });
  }
};

export const logoutUser = (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId) {
    performUserLogout(sessionId);
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

    const result = await performUserPanic({ userId, username, panicPhrase });

    res.json({
      success: true,
      message: result.message,
      ticket: {
        ticket_id: result.ticket.ticket_id,
        status: result.ticket.status,
        issue_type: result.ticket.issue_type,
        created_at: result.ticket.created_at,
        resolved_at: result.ticket.resolved_at,
        credibility_score: result.ticket.credibility_score,
        tracking_id: result.ticket.tracking_id,
        provided_recovery_key: result.ticket.provided_recovery_key || null,
        messages: (result.ticket.messages || []).map((m: any) => ({
          sender_name: m.sender_id === 0 ? 'System' : (m.sender_name.startsWith('SA-') || m.sender_name === 'Admin' || m.sender_name === 'cli_admin' || m.sender_name === 'Midnight' || m.sender_name === 'Lexie' || m.sender_name === 'lexie' || m.sender_name === '午夜兔子' || m.sender_name === 'LEXIE' ? 'Support operator' : 'Client'),
          content: m.content,
          timestamp: m.timestamp
        }))
      }
    });
  } catch (err: any) {
    if (
      err.message === 'User context and target account parameter are required.' ||
      err.message === 'Verification failed: Emergency panic phrase match invalid.'
    ) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Target user context not found in cryptographic database.') {
      return res.status(404).json({ error: err.message });
    }
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

  try {
    const result = await performAccountRestoration({
      username,
      safeWord,
      recoveryKey,
      newPasswordHex: newPassword,
      clientSalt
    });

    return res.json(result);
  } catch (err: any) {
    if (err.message === 'User handle not found in databases.') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.') {
      return res.status(403).json({ error: err.message });
    }
    if (
      err.message === 'Invalid Safe Word entered.' ||
      err.message === 'Invalid Recovery Key entered.'
    ) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to execute account restoration.' });
  }
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

    const result = await performRestoreCodeRedemption({
      username,
      restoreCode,
      newPasswordHex: newPassword
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'User handle not found in databases.') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Invalid or incorrect restoration code.') {
      return res.status(400).json({ error: err.message });
    }
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

    const result = await performSafewordRecovery({
      username,
      safeWord,
      newPasswordHex: newPassword
    });

    return res.json(result);
  } catch (err: any) {
    if (err.message === 'User not found.') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message === 'Invalid Safe Word entered.') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to recover via safeword.' });
  }
};
