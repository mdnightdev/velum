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
const challengeStore = new Map<string, { challenge: string; allowedOrigins: string[]; rpID: string; expiresAt: number }>();

function cleanupChallenges() {
  const now = Date.now();
  for (const [key, val] of challengeStore.entries()) {
    if (val.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}

function resolveWebauthnContext(req: Request) {
  // 1. Resolve host and protocol (handling reverse proxies like Nginx/Cloudflare)
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host || req.hostname || 'localhost';
  const rawHost = String(hostHeader).split(',')[0].trim();
  const hostname = rawHost.split(':')[0]; // strip port

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || (req.secure ? 'https' : 'http');

  // 2. Resolve rpID dynamically:
  // If explicitly configured via RP_ID env, respect it; otherwise extract clean root/subdomain hostname
  let rpID = process.env.RP_ID || hostname;
  if (rpID === '127.0.0.1' || rpID === '0.0.0.0') {
    rpID = 'localhost';
  }

  // 3. Resolve allowed origins dynamically:
  const allowedOrigins = new Set<string>();

  if (process.env.ORIGIN) {
    process.env.ORIGIN.split(',').forEach(o => allowedOrigins.add(o.trim()));
  }

  const reqOrigin = req.headers.origin;
  if (reqOrigin) {
    allowedOrigins.add(reqOrigin);
  }

  const reqReferer = req.headers.referer;
  if (reqReferer) {
    try {
      const parsed = new URL(reqReferer);
      allowedOrigins.add(parsed.origin);
    } catch {}
  }

  // Constructed origins matching current host
  allowedOrigins.add(`${proto}://${rawHost}`);
  allowedOrigins.add(`https://${rawHost}`);
  allowedOrigins.add(`http://${rawHost}`);

  // Mobile / Capacitor / PWA origin bindings
  allowedOrigins.add('https://localhost');
  allowedOrigins.add('http://localhost');
  allowedOrigins.add('capacitor://localhost');
  allowedOrigins.add('ionic://localhost');

  // Development environment ports
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://127.0.0.1:5173');
    allowedOrigins.add('https://localhost:3000');
    allowedOrigins.add('https://localhost:5173');
  }

  return {
    rpID,
    allowedOrigins: Array.from(allowedOrigins)
  };
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
      const { rpID, allowedOrigins } = resolveWebauthnContext(req);
      const options = await webauthnService.generateRegistrationOptions(
        user.userId,
        user.username,
        rpID
      );
      
      challengeStore.set(`reg_${user.userId}`, {
        challenge: options.challenge,
        allowedOrigins,
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
        stored.allowedOrigins,
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
      const { rpID, allowedOrigins } = resolveWebauthnContext(req);
      const options = await webauthnService.generateAuthenticationOptions(
        username || undefined,
        rpID
      );
      
      const key = username ? `auth_${username.trim()}` : 'auth_anonymous';
      challengeStore.set(key, {
        challenge: options.challenge,
        allowedOrigins,
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
        stored.allowedOrigins,
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