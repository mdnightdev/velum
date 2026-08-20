import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { webauthnService } from '../services/webauthnService.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { hashSessionToken } from '../middleware/auth.js';

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

// TTL in-memory challenge store for stateless WebAuthn handshakes
const challengeStore = new Map<string, { challenge: string; origin: string; rpID: string; expiresAt: number }>();

function cleanupChallenges() {
  const now = Date.now();
  for (const [key, val] of challengeStore.entries()) {
    if (val.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}

function getOriginAndRpId(req: Request) {
  const origin = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:3000');
  let rpID = 'localhost';
  try {
    rpID = new URL(origin).hostname;
  } catch {
    rpID = req.hostname || 'localhost';
  }
  return { origin, rpID };
}

export class WebauthnController {
  // Generate registration options (requires auth)
  async generateRegistrationOptions(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      cleanupChallenges();
      const { origin, rpID } = getOriginAndRpId(req);
      const options = await webauthnService.generateRegistrationOptions(
        user.userId,
        user.username,
        rpID
      );
      
      challengeStore.set(`reg_${user.userId}`, {
        challenge: options.challenge,
        origin,
        rpID,
        expiresAt: Date.now() + 300000 // 5 mins
      });
      
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate registration options' });
    }
  }

  // Verify registration and store credential (requires auth)
  async verifyRegistration(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { response, nickname } = req.body;
    const stored = challengeStore.get(`reg_${user.userId}`);
    
    if (!stored || stored.expiresAt < Date.now()) {
      res.status(400).json({ error: 'No active registration challenge' });
      return;
    }

    try {
      const registrationInfo = await webauthnService.verifyRegistration(
        user.userId,
        response,
        stored.challenge,
        stored.origin,
        stored.rpID
      );

      // Update nickname if provided
      if (nickname && registrationInfo.credentialId) {
        await webauthnService.updatePasskeyNickname(
          user.userId,
          registrationInfo.credentialId,
          nickname
        );
      }

      challengeStore.delete(`reg_${user.userId}`);

      res.json({ 
        verified: true, 
        credentialId: registrationInfo.credentialId 
      });
    } catch (error) {
      res.status(400).json({ error: 'Registration verification failed' });
    }
  }

  // Generate authentication options (login)
  async generateAuthenticationOptions(req: Request, res: Response): Promise<void> {
    const username = (req.body?.username || req.query?.username || '') as string;

    try {
      cleanupChallenges();
      const { origin, rpID } = getOriginAndRpId(req);
      const options = await webauthnService.generateAuthenticationOptions(
        username || undefined,
        rpID
      );
      
      const key = username ? `auth_${username.trim()}` : 'auth_anonymous';
      challengeStore.set(key, {
        challenge: options.challenge,
        origin,
        rpID,
        expiresAt: Date.now() + 300000
      });
      
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate authentication options' });
    }
  }

  // Verify authentication and create session (login)
  async verifyAuthentication(req: Request, res: Response): Promise<void> {
    const { response, username } = req.body;
    const key = username ? `auth_${String(username).trim()}` : 'auth_anonymous';
    const stored = challengeStore.get(key) || challengeStore.get('auth_anonymous');
    
    if (!stored || stored.expiresAt < Date.now()) {
      res.status(400).json({ error: 'No active authentication challenge' });
      return;
    }

    try {
      const authResult = await webauthnService.verifyAuthentication(
        response,
        stored.challenge,
        stored.origin,
        stored.rpID
      );

      challengeStore.delete(key);
      challengeStore.delete('auth_anonymous');

      // Create session for the user
      const user = await userRepository.findById(authResult.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashSessionToken(sessionToken);

      await userRepository.createSession({
        userId: authResult.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      res.json({
        verified: true,
        sessionId: sessionToken,
        sessionToken,
        user: {
          id: user.id,
          userId: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName || user.username,
          avatarUrl: user.avatarUrl || ''
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Authentication verification failed' });
    }
  }

  // Get user's passkeys (requires auth)
  async getPasskeys(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const passkeys = await webauthnService.getUserPasskeys(user.userId);
      res.json({ passkeys });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get passkeys' });
    }
  }

  // Delete a passkey (requires auth)
  async deletePasskey(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { credentialId } = req.params;
    if (!credentialId) {
      res.status(400).json({ error: 'Credential ID is required' });
      return;
    }

    try {
      const success = await webauthnService.deletePasskey(user.userId, credentialId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Passkey not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete passkey' });
    }
  }

  // Update passkey nickname (requires auth)
  async updatePasskeyNickname(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { credentialId } = req.params;
    const { nickname } = req.body;

    if (!credentialId || !nickname) {
      res.status(400).json({ error: 'Credential ID and nickname are required' });
      return;
    }

    try {
      const success = await webauthnService.updatePasskeyNickname(
        user.userId,
        credentialId,
        nickname
      );
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Passkey not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update passkey nickname' });
    }
  }
}

export const webauthnController = new WebauthnController();