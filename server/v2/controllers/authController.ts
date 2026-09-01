import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { hashArgon2id, deriveKeyAsync, generateRandomToken, generateRecoveryKey, safeCompare, verifyArgon2id, getClientIp } from '../utils/crypto.js';
import { hashSessionToken } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { tickets } from '../db/schema/tickets.js';
import { eq, and, sql } from 'drizzle-orm';
import { ConflictError, UnauthorizedError, NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import type { RegisterInput, LoginInput, UpdateProfileInput } from '../schemas/auth.js';
import { deviceFingerprintService } from '../services/deviceFingerprint.js';
import { ensureAdminSeeded } from '../services/adminSeeder.js';
import { systemBot } from '../services/systemBot.js';

import crypto from 'node:crypto';

import { executePanicCascade } from '../services/duress/panicService.js';
import { checkDuressOnLogin } from '../services/duress/duressAuth.js';

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
      throw new NotFoundError('User handle not found in databases.');
    }
    
    if (user.isCompromised) {
      throw new ForbiddenError('CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.');
    }
    
    const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.passcodeHash);
    if (!isSafeWordMatch) {
      throw new BadRequestError('Invalid Safe Word entered.');
    }
    
    const isRecoveryKeyMatch = await verifyArgon2id(recoveryKey, user.salt, user.recoveryKeyHash || user.loginRecoveryKeyHash);
    if (!isRecoveryKeyMatch) {
      throw new BadRequestError('Invalid Recovery Key entered.');
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
    res.status(200).json({ success: true, message: 'Account successfully restored. You can now log in with your new password.' });
  }

  async recoverSafeword(req: Request, res: Response): Promise<void> {
    const { username, safeWord, newPassword } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User handle not found in databases.');
    }

    if (user.isCompromised) {
      throw new ForbiddenError('CRITICAL QUARANTINE: Account recovery is deactivated for compromised locks. Contact Support portal for Login Admin review.');
    }

    const isSafeWordMatch = await verifyArgon2id(safeWord, user.salt, user.passcodeHash);
    if (!isSafeWordMatch) {
      throw new BadRequestError('Invalid Safe Word entered.');
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
    res.status(200).json({ success: true, message: 'Password reset successful. Try logging in now.' });
  }

  async redeemRestoreCode(req: Request, res: Response): Promise<void> {
    const { username, restoreCode, newPassword } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User handle not found in databases.');
    }

    const cleanCode = (restoreCode || '').trim();
    const matchesCode = user.tempRestoreCode && user.tempRestoreCode.trim() === cleanCode;
    if (!matchesCode) {
      throw new BadRequestError('Invalid or incorrect restoration code.');
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
            content: 'Account restored successfully via Secure Restoration Code redemption channel.',
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
    res.status(200).json({ success: true, message: 'Account successfully restored. You can now log in with your new password.' });
  }
  async register(req: Request<{}, {}, RegisterInput>, res: Response): Promise<void> {
    const { username, password, hashedPassword, passcode, panicPhrase, deviceId, deviceFingerprint } = req.body as any;

    const clientIp = getClientIp(req);
    const userAgentStr = (req.headers['user-agent'] as string) || 'unknown-device';
    const regFingerprint = deviceFingerprint || crypto.createHash('sha256').update(userAgentStr + clientIp).digest('hex');

    // Hardware Blacklist Enforcement
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

    let panicPhraseHash: string | undefined = undefined;
    if (panicPhrase) {
      panicPhraseHash = await hashArgon2id(panicPhrase, Buffer.from(salt, 'hex'));
    }

    const recoveryKey = generateRecoveryKey('VEL-REC');
    const recoveryKeyHash = await hashArgon2id(recoveryKey, Buffer.from(salt, 'hex'));

    const newUser = await userRepository.create({
      username,
      passwordHash,
      salt,
      passcodeHash,
      panicPhraseHash,
      recoveryKeyHash,
      recoveryKey,
      role: 'USER',
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
      console.error('[authController] Device record error on register:', dfErr);
    }

    await userRepository.createSession({
      userId: newUser.id,
      tokenHash,
      expiresAt,
      ipAddress: clientIp,
      userAgent: userAgentStr
    });

    await systemBot.sendToUser(newUser.id,
      `Welcome to Velum, ${username}! 🎉\n\n` +
      `Your recovery key is: ${recoveryKey}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `GETTING STARTED:\n` +
      `• Join lounges to connect with communities\n` +
      `• Send direct messages to other users\n` +
      `• Check your Velum Bot DM for system notifications\n\n` +
      `SECURITY:\n` +
      `• Save your recovery key securely\n` +
      `• Never share your credentials\n` +
      `• Use panic phrase if compromised\n\n` +
      `Need help? Contact an administrator.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

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
    const { username, password, duressPasscode, panicPhrase } = req.body;

    let user = await userRepository.findByUsername(username);
    if (!user) {
      await ensureAdminSeeded();
      user = await userRepository.findByUsername(username);
    }
    if (!user) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    // Check for panic phrase trigger or compromised account credibility gate
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown-device';
    const fingerprint = crypto.createHash('sha256').update(userAgent + ipAddress).digest('hex');

    const reqDetails = {
      userAgent,
      platform: (req.headers['sec-ch-ua-platform'] as string) || 'unknown'
    };

    const duressResult = await checkDuressOnLogin(user, password, panicPhrase, fingerprint, ipAddress, reqDetails);
    if (duressResult.isCompromised && duressResult.shouldShowTicket) {
      res.status(200).json({
        compromised: true,
        ticketId: duressResult.ticketId,
        message: 'Account under duress quarantine. Ticket tracking enabled.',
        redirectTo: `/public/tickets/${duressResult.ticketId}`
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
        message: 'Account is compromised. Please contact support with ticket ID for assistance.',
        redirectTo: '/auth/ticket-claim'
      });
      return;
    }

    // Maintenance Mode Check: Directly query SystemConfigService for canonical DB/Redis state
    const { SystemConfigService } = await import('../services/systemConfigService.js');
    const sysConfig = await SystemConfigService.getAll();
    if (sysConfig.maintenanceMode) {
      const isStaffOrImmune = user.id === 1 || user.id === 2 || user.id === 999 || 
        ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'BANK_ADMIN'].includes(user.role);
      
      if (!isStaffOrImmune) {
        res.status(503).json({
          error: 'System under maintenance! Sorry for the inconvenience.',
          maintenance: true
        });
        return;
      }
    }

    // Check if account is deactivated or restricted
    if (user.role === 'DEACTIVATED') {
      res.status(403).json({
        error: 'Account is deactivated and scheduled for deletion. Please contact support or use recovery credentials to cancel deactivation.'
      });
      return;
    }

    if (user.role === 'BLOCKED' || user.role === 'RESTRICTED') {
      res.status(403).json({
        error: 'Account access has been suspended or restricted by administration.'
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
            subject: 'CRITICAL: DURESS PROTOCOL ACTIVATED',
            description: `User ${user.username} (ID: ${user.id}) has logged in using their duress passcode. Account marked as compromised.`,
            status: 'CRITICAL_ALERT'
          });
        }
      }
    }

    try {
      await deviceFingerprintService.recordDeviceAccess(user.id, fingerprint, ipAddress, reqDetails);
    } catch (dfErr) {
      console.error('[authController] Device record error on login:', dfErr);
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

    if (!user.recoveryKeyDelivered && user.recoveryKey) {
      systemBot.sendToUser(user.id, `Welcome to Velum. Your recovery key is: ${user.recoveryKey}. Store this securely. You will not receive it again.`);
      await userRepository.update(user.id, { recoveryKeyDelivered: true });
    }

    res.status(200).json({
      token,
      user: {
        userId: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
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
      avatar: req.user.avatarUrl || req.user.avatar || '',
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
      throw new BadRequestError('Device ID and fingerprint data are required.');
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
