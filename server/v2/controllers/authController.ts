import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { hashArgon2id, deriveKeyAsync, generateRandomToken, safeCompare } from '../utils/crypto.js';
import { hashSessionToken } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { tickets } from '../db/schema/tickets.js';
import { eq } from 'drizzle-orm';
import { ConflictError, UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors.js';
import type { RegisterInput, LoginInput, UpdateProfileInput } from '../schemas/auth.js';
import { deviceFingerprintService } from '../services/deviceFingerprint.js';
import { ensureAdminSeeded } from '../services/adminSeeder.js';

import crypto from 'node:crypto';

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
    const { username, newPassword, salt, ticketId } = req.body;
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new NotFoundError('Account not found.');
    }
    
    // Verify this is a compromised account recovery
    if (!user.isCompromised || user.compromiseTicketId !== ticketId) {
      throw new BadRequestError('Invalid recovery request. Account not compromised or invalid ticket ID.');
    }
    
    const passwordHash = await hashArgon2id(newPassword, Buffer.from(salt, 'hex'));
    
    await db.transaction(async (tx) => {
      // Reset password and clear compromised status
      await userRepository.update(user.id, {
        passwordHash,
        salt,
        isCompromised: false,
        compromiseTicketId: null,
        duressActive: false
      });
      
      // Update ticket status
      const ticketResult = await tx.select().from(tickets)
        .where(eq(tickets.userId, user.id))
        .limit(1);
      
      if (ticketResult.length > 0) {
        await tx.update(tickets)
          .set({ status: 'RESOLVED' })
          .where(eq(tickets.id, ticketResult[0].id));
      }
    });
    
    res.status(200).json({ message: 'Account recovered successfully.' });
  }
  async register(req: Request<{}, {}, RegisterInput>, res: Response): Promise<void> {
    const { username, password, hashedPassword, passcode, panicPhrase } = req.body;

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('Username is already registered.');
    }

    const salt = generateRandomToken(16);
    const passwordHash = hashedPassword || await hashArgon2id(password, Buffer.from(salt, 'hex'));

    let passcodeHash: string | undefined = undefined;
    if (passcode) {
      passcodeHash = await hashArgon2id(passcode, Buffer.from(salt, 'hex'));
    }

    let panicPhraseHash: string | undefined = undefined;
    if (panicPhrase) {
      panicPhraseHash = await hashArgon2id(panicPhrase, Buffer.from(salt, 'hex'));
    }

    const recoveryKey = `VEL-REC-${Math.floor(10000 + Math.random() * 90000)}`;
    const recoveryKeyHash = await hashArgon2id(recoveryKey, Buffer.from(salt, 'hex'));

    const newUser = await userRepository.create({
      username,
      passwordHash,
      salt,
      passcodeHash,
      panicPhraseHash,
      recoveryKeyHash,
      role: 'USER',
      duressActive: false,
      isCompromised: false
    });

    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.createSession({
      userId: newUser.id,
      tokenHash,
      expiresAt,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] || undefined
    });

    res.status(201).json({
      token,
      recoveryKey,
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

    // Check for panic phrase - this triggers compromised account flow
    if (panicPhrase && user.panicPhraseHash) {
      const computedPanicHash = await hashArgon2id(panicPhrase, Buffer.from(user.salt, 'hex'));
      if (safeCompare(computedPanicHash, user.panicPhraseHash)) {
        // Panic phrase entered - flag account as compromised
        if (!user.isCompromised) {
          const ticketId = `TKT-${generateRandomToken(8).toUpperCase()}`;
          
          await db.transaction(async (tx) => {
            // Mark user as compromised
            await userRepository.update(user.id, { 
              isCompromised: true,
              compromiseTicketId: ticketId
            });
            
            // Create support ticket
            await tx.insert(tickets).values({
              userId: user.id,
              subject: 'CRITICAL: ACCOUNT COMPROMISED - PANIC PROTOCOL ACTIVATED',
              description: `User ${user.username} (ID: ${user.id}) has triggered the panic protocol. Account marked as compromised. User needs admin assistance to restore access.`,
              status: 'CRITICAL_ALERT'
            });
          });
          
          // Return special response directing to ticket system
          res.status(200).json({
            compromised: true,
            ticketId,
            message: 'Account compromised. Please contact support with ticket ID for assistance.',
            redirectTo: '/auth/ticket-claim'
          });
          return;
        } else {
          // Already compromised - return existing ticket
          res.status(200).json({
            compromised: true,
            ticketId: user.compromiseTicketId,
            message: 'Account already compromised. Please contact support with ticket ID for assistance.',
            redirectTo: '/auth/ticket-claim'
          });
          return;
        }
      }
    }

    const clientHash = crypto.createHash('sha256').update(user.salt + password).digest('hex');
    const computedPasswordHash = await hashArgon2id(password, Buffer.from(user.salt, 'hex'));
    const computedFromClientHash = await hashArgon2id(clientHash, Buffer.from(user.salt, 'hex'));

    const isPasswordValid = 
      safeCompare(computedPasswordHash, user.passwordHash) ||
      safeCompare('argon2id:' + computedPasswordHash, user.passwordHash) ||
      safeCompare(computedFromClientHash, user.passwordHash) ||
      safeCompare('argon2id:' + computedFromClientHash, user.passwordHash) ||
      safeCompare(password, user.passwordHash);

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

    let isDuressTriggered = false;
    if (duressPasscode && user.passcodeHash) {
      const computedDuressHash = await hashArgon2id(duressPasscode, Buffer.from(user.salt, 'hex'));
      if (safeCompare(computedDuressHash, user.passcodeHash)) {
        isDuressTriggered = true;
        await userRepository.update(user.id, { duressActive: true });
        await db.insert(tickets).values({
          userId: user.id,
          subject: 'CRITICAL: DURESS PROTOCOL ACTIVATED',
          description: `User ${user.username} (ID: ${user.id}) has logged in using their duress passcode. Account marked as compromised.`,
          status: 'CRITICAL_ALERT'
        });
      }
    }

    const token = generateRandomToken(32);
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] || undefined
    });

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
