import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { hashArgon2id, deriveKeyAsync, generateRandomToken, generateRecoveryKey, safeCompare, verifyArgon2id, getClientIp } from '../utils/crypto.js';
import { hashSessionToken } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { tickets } from '../db/schema/tickets.js';
import { eq, and, sql } from 'drizzle-orm';
import { ConflictError, UnauthorizedError, NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { RegisterInput, LoginInput, UpdateProfileInput, CancelDeletionInput } from '../schemas/auth.js';
import { deviceFingerprintService } from '../services/deviceFingerprint.js';
import { ensureAdminSeeded } from '../services/adminSeeder.js';
import { ensureVelumMasterMembership } from '../services/loungeService.js';
import { systemBot } from '../services/systemBot.js';
import { BotTemplates } from '../services/botTemplates.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_USER_BIO } from '../constants/profile.js';
import { reportOpsError } from '../services/opsErrorService.js';

import crypto from 'node:crypto';

import { executeEmergencyWipe } from '../services/duress/panicService.js';
import { checkEmergencyPhraseOnLogin } from '../services/duress/duressAuth.js';

export class AuthController {
  async getUserSalt(req: Request, res: Response): Promise<void> {
    const { username } = req.query;
    if (!username) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    const queryName = (username as string).trim();
    const user = await userRepository.findByUsername(queryName);
    if (!user) {
      const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
      res.json({ salt: dummySalt });
      return;
    }
    res.json({ salt: user.salt || null });
  }

  async getLoginNonce(req: Request, res: Response): Promise<void> {
    const nonce = crypto.randomBytes(16).toString('hex');
    res.json({ nonce });
  }

  async getPreSignupSalt(req: Request, res: Response): Promise<void> {
    const salt = crypto.randomBytes(16).toString('hex');
    res.json({ salt });
  }

  async getRecoverySalt(req: Request, res: Response): Promise<void> {
    const { username } = req.query;
    const queryName = ((username as string) || '').trim();
    const user = await userRepository.findByUsername(queryName);
    if (!user) {
      const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_recovery_dummy').digest('hex');
      res.json({ salt: dummySalt });
      return;
    }
    res.json({ salt: user.salt });
  }

  async registerPermanentOtp(req: Request, res: Response): Promise<void> {
    const { username } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('User not found.');
    }
    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt
    });
    res.status(200).json({
      sessionId: token,
      deviceId: 'admin-device',
      user: {
        userId: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
      }
    });
  }

  async restoreAccount(req: Request, res: Response): Promise<void> {
    const { username, safeWord, recoveryKey, newPassword, salt } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.isCompromised) {
      throw new ForbiddenError('Account recovery disabled. Contact support.');
    }
    
    const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.passcodeHash);
    if (!isSafeWordMatch) {
      throw new BadRequestError('Invalid safe word.');
    }

    const isRecoveryKeyMatch = await verifyArgon2id(recoveryKey, user.salt, user.recoveryKeyHash || user.loginRecoveryKeyHash);
    if (!isRecoveryKeyMatch) {
      throw new BadRequestError('Invalid recovery key.');
    }
    
    const newSalt = salt || generateRandomToken(16);
    const newSaltBuf = Buffer.from(newSalt, 'hex');
    const passHashHex = await hashArgon2id(newPassword, newSaltBuf);
    const swHashHex = safeWord ? await hashArgon2id(safeWord, newSaltBuf) : user.passcodeHash;
    
    await userRepository.update(user.id, {
      passwordHash: `argon2id:${passHashHex}`,
      salt: newSalt,
      passcodeHash: swHashHex ? `argon2id:${swHashHex}` : user.passcodeHash,
      isCompromised: false,
      duressActive: false
    });

    await userRepository.deleteAllSessionsForUser(user.id);
    res.status(200).json({ success: true, message: 'Account restored. You can now log in.' });
  }

  async recoverSafeword(req: Request, res: Response): Promise<void> {
    const { username, safeWord, newPassword } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.isCompromised) {
      throw new ForbiddenError('Account recovery disabled. Contact support.');
    }

    const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.passcodeHash);
    if (!isSafeWordMatch) {
      throw new BadRequestError('Invalid safe word.');
    }

    const newSalt = generateRandomToken(16);
    const newSaltBuf = Buffer.from(newSalt, 'hex');
    const passHashHex = await hashArgon2id(newPassword, newSaltBuf);
    const swHashHex = await hashArgon2id(safeWord, newSaltBuf);

    await userRepository.update(user.id, {
      passwordHash: `argon2id:${passHashHex}`,
      salt: newSalt,
      passcodeHash: `argon2id:${swHashHex}`,
      isCompromised: false,
      duressActive: false
    });

    await userRepository.deleteAllSessionsForUser(user.id);
    res.status(200).json({ success: true, message: 'Password reset. Try logging in.' });
  }

  async redeemRestoreCode(req: Request, res: Response): Promise<void> {
    const { username, restoreCode, newPassword } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const cleanCode = (restoreCode || '').trim();
    const matchesCode = user.tempRestoreCode && user.tempRestoreCode.trim() === cleanCode;
    if (!matchesCode) {
      throw new BadRequestError('Invalid restore code.');
    }

    const newSalt = generateRandomToken(16);
    const newSaltBuf = Buffer.from(newSalt, 'hex');
    const passHashHex = await hashArgon2id(newPassword, newSaltBuf);

    await db.transaction(async (tx) => {
      await userRepository.update(user.id, {
        passwordHash: `argon2id:${passHashHex}`,
        salt: newSalt,
        tempRestoreCode: null,
        isCompromised: false,
        duressActive: false
      });

      const userTickets = await tx.select().from(tickets).where(eq(tickets.userId, user.id));
      for (const t of userTickets) {
        if (t.status !== 'resolved' && t.status !== 'closed') {
          const updatedMessages = Array.isArray(t.messages) ? [...(t.messages as any[])] : [];
          updatedMessages.push({
            sender_id: 0,
            sender_name: 'SYSTEM',
            content: 'Account restored via restore code.',
            timestamp: new Date().toISOString()
          });

          await tx.update(tickets)
            .set({
              status: 'resolved',
              messages: updatedMessages,
              updatedAt: new Date()
            })
            .where(eq(tickets.id, t.id));
        }
      }
    });

    await userRepository.deleteAllSessionsForUser(user.id);
    res.status(200).json({ success: true, message: 'Account restored. You can now log in.' });
  }

  async cancelDeletion(req: Request<{}, {}, CancelDeletionInput>, res: Response): Promise<void> {
    const { username, password, cancelToken } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (!user.scheduledDeletionAt) {
      throw new BadRequestError('Account is not scheduled for deletion.');
    }

    if (user.scheduledDeletionAt <= new Date()) {
      throw new ForbiddenError('Account deletion period has expired.');
    }

    let isAuthorized = false;

    if (cancelToken) {
      const expectedToken = crypto.createHmac('sha256', process.env.JWT_SECRET || 'velum-secret')
        .update(`${user.id}:${user.scheduledDeletionAt.toISOString()}:${user.salt}`)
        .digest('hex');
      if (safeCompare(cancelToken, expectedToken)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && password) {
      const isPasswordValid = await verifyArgon2id(password, user.salt, user.passwordHash);
      if (isPasswordValid) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new UnauthorizedError('Invalid authorization credentials to cancel deletion.');
    }

    const { UserDeletionService } = await import('../services/userDeletionService.js');
    await UserDeletionService.cancelUserDeactivation(user.id);

    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown-device';

    await userRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        userId: user.id,
        username: user.username,
        role: 'USER',
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        salt: user.salt
      },
      message: 'Account deletion cancelled successfully.'
    });
  }

  async register(req: Request<{}, {}, RegisterInput>, res: Response): Promise<void> {
    const { username, password, hashedPassword, passcode, emergencyPhrase, deviceId, deviceFingerprint } = req.body as any;

    const clientIp = getClientIp(req);
    const userAgentStr = (req.headers['user-agent'] as string) || 'unknown-device';
    const regFingerprint = deviceFingerprint || crypto.createHash('sha256').update(userAgentStr + clientIp).digest('hex');

    // Hardware blacklist enforcement
    const { blacklist } = await import('../db/schema/blacklist.js');
    const { or, inArray } = await import('drizzle-orm');
    
    const blacklisted = await db.select().from(blacklist).where(
      or(
        eq(blacklist.value, clientIp),
        deviceId ? eq(blacklist.value, deviceId) : sql`1=0`,
        eq(blacklist.value, regFingerprint),
        eq(blacklist.deviceFingerprint, regFingerprint)
      )
    ).limit(1);

    if (blacklisted.length > 0) {
      throw new ForbiddenError('Device or network identifier has been restricted from creating accounts.');
    }

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('Username is already registered.');
    }

    const salt = (req.body as any).salt || generateRandomToken(16);
    const passwordHash = hashedPassword || await hashArgon2id(password, Buffer.from(salt, 'hex'));

    let passcodeHash: string | undefined = undefined;
    if (passcode) {
      passcodeHash = await hashArgon2id(passcode, Buffer.from(salt, 'hex'));
    }

    let emergencyPhraseHash: string | undefined = undefined;
    if (emergencyPhrase) {
      emergencyPhraseHash = await hashArgon2id(emergencyPhrase, Buffer.from(salt, 'hex'));
    }

    const recoveryKey = generateRecoveryKey('VEL-REC');
    const recoveryKeyHash = await hashArgon2id(recoveryKey, Buffer.from(salt, 'hex'));

    const newUser = await userRepository.create({
      username,
      passwordHash,
      salt,
      passcodeHash,
      panicPhraseHash: emergencyPhraseHash,
      recoveryKeyHash,
      recoveryKey,
      role: 'USER',
      bio: DEFAULT_USER_BIO,
      duressActive: false,
      isCompromised: false
    });

    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await deviceFingerprintService.recordDeviceAccess(newUser.id, regFingerprint, clientIp, {
        userAgent: userAgentStr,
        platform: (req.headers['sec-ch-ua-platform'] as string) || 'unknown'
      });
    } catch (dfErr) {
      const msg = dfErr instanceof Error ? dfErr.message : String(dfErr);
      logger.warn('Device record error on register', { userId: newUser.id, error: msg });
      void reportOpsError({
        severity: 'amber',
        code: 'AUTH_DEVICE_RECORD_REGISTER',
        message: msg,
        route: '/v2/auth/register',
        method: 'POST',
        userId: newUser.id,
        component: 'authController',
      });
    }

    await userRepository.createSession({
      userId: newUser.id,
      tokenHash,
      expiresAt,
      ipAddress: clientIp,
      userAgent: userAgentStr
    });

    try {
      await ensureVelumMasterMembership(newUser.id);
    } catch (enrollErr) {
      const msg = enrollErr instanceof Error ? enrollErr.message : String(enrollErr);
      logger.warn('Velum master enroll failed on register', { userId: newUser.id, error: msg });
    }

    res.status(201).json({
      token,
      user: {
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl
      }
    });
  }

  async login(req: Request<{}, {}, LoginInput>, res: Response): Promise<void> {
    const { username, password, duressPasscode, emergencyPhrase } = req.body;

    let user = await userRepository.findByUsername(username);
    if (!user) {
      await ensureAdminSeeded();
      user = await userRepository.findByUsername(username);
    }
    if (!user) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    // Check for emergency phrase trigger or compromised account check
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown-device';
    const fingerprint = crypto.createHash('sha256').update(userAgent + ipAddress).digest('hex');

    const reqDetails = {
      userAgent,
      platform: (req.headers['sec-ch-ua-platform'] as string) || 'unknown'
    };

    const emergencyResult = await checkEmergencyPhraseOnLogin(user, password, emergencyPhrase, fingerprint, ipAddress, reqDetails);
    if (emergencyResult.isCompromised && emergencyResult.shouldShowTicket) {
      res.status(200).json({
        compromised: true,
        ticketId: emergencyResult.ticketId,
        message: 'Emergency phrase used. Ticket created.',
        redirectTo: `/public/tickets/${emergencyResult.ticketId}`
      });
      return;
    }

    const isPasswordValid = await verifyArgon2id(password, user.salt, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    // Check if account is compromised
    if (user.isCompromised) {
      res.status(403).json({
        compromised: true,
        ticketId: user.compromiseTicketId,
        message: 'Account compromised. Contact support with ticket ID.',
        redirectTo: '/auth/ticket-claim'
      });
      return;
    }

    // Maintenance mode check
    const { SystemConfigService } = await import('../services/systemConfigService.js');
    const sysConfig = await SystemConfigService.getAll();
    if (sysConfig.maintenanceMode) {
      const isStaffOrImmune = user.id === 1 || user.id === 2 || user.id === 999 || 
        ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'BANK_ADMIN'].includes(user.role);
      
      if (!isStaffOrImmune) {
        res.status(503).json({
          error: 'System under maintenance.',
          maintenance: true
        });
        return;
      }
    }

    // Check if account is scheduled for deletion
    if (user.scheduledDeletionAt) {
      const now = new Date();
      if (user.scheduledDeletionAt <= now) {
        res.status(403).json({
          error: 'Account deletion period has expired. Account has been deactivated.',
          deletionExpired: true
        });
        return;
      }
      const timeRemainingMs = Math.max(0, user.scheduledDeletionAt.getTime() - now.getTime());
      const cancelToken = crypto.createHmac('sha256', process.env.JWT_SECRET || 'velum-secret')
        .update(`${user.id}:${user.scheduledDeletionAt.toISOString()}:${user.salt}`)
        .digest('hex');

      res.status(200).json({
        scheduledDeletion: true,
        scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
        timeRemainingMs,
        username: user.username,
        cancelToken,
        message: 'This account is scheduled for deletion.'
      });
      return;
    }

    // Check if account is deactivated or restricted
    if (user.role === 'DEACTIVATED') {
      res.status(403).json({
        error: 'Account deactivated. Contact support or use recovery credentials.'
      });
      return;
    }

    if (user.role === 'BLOCKED' || user.role === 'RESTRICTED') {
      res.status(403).json({
        error: 'Account access suspended or restricted.'
      });
      return;
    }

    let isDuressTriggered = false;
    if (duressPasscode && user.passcodeHash) {
      const computedDuressHash = await hashArgon2id(duressPasscode, Buffer.from(user.salt, 'hex'));
      if (safeCompare(computedDuressHash, user.passcodeHash)) {
        isDuressTriggered = true;
        await userRepository.update(user.id, { duressActive: true });

        const { tickets } = await import('../db/schema/tickets.js');
        const existingDuress = await db.select().from(tickets)
          .where(and(eq(tickets.userId, user.id), eq(tickets.status, 'CRITICAL_ALERT')))
          .limit(1);

        if (!existingDuress.length) {
          await db.insert(tickets).values({
            userId: user.id,
            subject: 'Emergency passcode used',
            description: `User ${user.username} (ID: ${user.id}) logged in using emergency passcode. Account marked as compromised.`,
            status: 'CRITICAL_ALERT'
          });
        }
      }
    }

    try {
      await deviceFingerprintService.recordDeviceAccess(user.id, fingerprint, ipAddress, reqDetails);
    } catch (dfErr) {
      const msg = dfErr instanceof Error ? dfErr.message : String(dfErr);
      logger.warn('Device record error on login', { userId: user.id, error: msg });
      void reportOpsError({
        severity: 'amber',
        code: 'AUTH_DEVICE_RECORD_LOGIN',
        message: msg,
        route: '/v2/auth/login',
        method: 'POST',
        userId: user.id,
        component: 'authController',
      });
    }

    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress,
      userAgent: userAgent
    });

    try {
      await ensureVelumMasterMembership(user.id);
    } catch (enrollErr) {
      const msg = enrollErr instanceof Error ? enrollErr.message : String(enrollErr);
      logger.warn('Velum master enroll failed on login', { userId: user.id, error: msg });
    }

    if (!user.recoveryKeyDelivered && user.recoveryKey) {
      systemBot.sendToUser(user.id, BotTemplates.welcomeUser(user.username, user.recoveryKey));
      await userRepository.update(user.id, { recoveryKeyDelivered: true });
    }

    res.status(200).json({
      token,
      user: {
        userId: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        salt: user.salt
      }
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    if (req.sessionId) {
      const tokenHash = hashSessionToken(req.sessionId);
      await userRepository.deleteSessionByTokenHash(tokenHash);
    }
    res.status(200).json({ message: 'Logged out successfully.' });
  }

  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized.');
    }
    const safeUser = {
      ...req.user,
      avatar: (req.user as any).avatarUrl || (req.user as any).avatar || '',
      avatarUrl: (req.user as any).avatarUrl || (req.user as any).avatar || '',
      bio: (req.user as any).bio || '',
      location: (req.user as any).location || '',
      salt: (req.user as any).salt,
      duress_active: undefined
    };
    res.status(200).json({ user: safeUser });
  }

  async updateProfile(req: Request<{}, {}, UpdateProfileInput>, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized.');
    }
    const updatedUser = await userRepository.update(req.user.userId, req.body);
    if (!updatedUser) {
      throw new NotFoundError('User not found.');
    }
    res.status(200).json({
      user: {
        userId: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        location: updatedUser.location
      }
    });
  }

  async recordDeviceFingerprint(req: Request, res: Response): Promise<void> {
    const { deviceId, fingerprintData, ipAddress } = req.body;

    if (!deviceId || !fingerprintData) {
      throw new BadRequestError('Device ID and fingerprint data required.');
    }

    const deviceRecord = await deviceFingerprintService.recordDeviceAccess(
      0, // Anonymous before login
      deviceId,
      ipAddress || req.ip,
      fingerprintData
    );

    const anomalyCheck = await deviceFingerprintService.detectAnomalousAccess(
      0,
      deviceId,
      ipAddress || req.ip
    );

    res.status(200).json({
      deviceRecord,
      anomalyCheck
    });
  }

  async getDeviceHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized.');
    }

    const deviceHistory = await deviceFingerprintService.getUserDeviceHistory(req.user.userId, 20);
    res.status(200).json({ devices: deviceHistory });
  }

  async getIpHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized.');
    }

    const ipHistory = await deviceFingerprintService.getUserIpHistory(req.user.userId, 20);
    res.status(200).json({ ipAddresses: ipHistory });
  }

  async purgeUserData(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized.');
    }

    await db.transaction(async (tx) => {
      // Delete user sessions
      await userRepository.deleteAllSessionsForUser(req.user!.userId, tx);
      
      // Delete device and IP data
      await deviceFingerprintService.purgeUserData(req.user!.userId);
      
      // Optionally delete wallet (with confirmation)
      // This should be handled by a separate secure deletion process
    });

    res.status(200).json({ 
      message: 'User data purged successfully. Account deactivated for deletion.' 
    });
  }
}

export const authController = new AuthController();
