import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthenticatedUser {
  userId: number;
  username: string;
  role: string;
  duress_active?: boolean;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const xSessionId = req.headers['x-session-id'] || req.headers['x-session-token'];
  if (typeof xSessionId === 'string' && xSessionId.trim().length > 0) {
    return xSessionId.trim();
  }
  if (req.query?.sessionToken && typeof req.query.sessionToken === 'string') {
    return req.query.sessionToken.trim();
  }
  return null;
}

import { config } from '../config.js';

export function hashSessionToken(token: string): string {
  const secret = config.HMAC_SECRET || config.JWT_SECRET || 'default_hmac_secret_key_32b!';
  return crypto.createHmac('sha256', secret).update(token.trim()).digest('hex');
}

export function createAuthMiddleware(
  findSessionAndUser: (hashedToken: string) => Promise<{ user: AuthenticatedUser; expiresAt?: string | Date; lastPing?: string | Date } | null>
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractSessionToken(req);
      if (!token) {
        throw new UnauthorizedError('Session required.');
      }

      const hashedToken = hashSessionToken(token);
      const sessionResult = await findSessionAndUser(hashedToken);

      if (!sessionResult) {
        throw new UnauthorizedError('Session expired.');
      }

      if (sessionResult.expiresAt) {
        const expiresTime = new Date(sessionResult.expiresAt).getTime();
        if (Date.now() > expiresTime) {
          throw new UnauthorizedError('Session expired. Please log in.');
        }
      }

      // Maintenance mode enforcement
      const { SystemConfigService } = await import('../services/systemConfigService.js');
      const sysConfig = await SystemConfigService.getAll();
      if (sysConfig.maintenanceMode) {
        const u = sessionResult.user;
        const isStaff = [1, 2, 999].includes(u.userId) ||
          ['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'BANK_ADMIN'].includes(u.role);

        if (!isStaff) {
          const graceEndsAtStr = await SystemConfigService.get('maintenance_grace_ends_at', '0');
          const graceEndsAt = parseInt(graceEndsAtStr, 10) || 0;
          if (Date.now() > graceEndsAt) {
            throw new UnauthorizedError('Platform maintenance mode active. Session terminated.');
          }
        }
      }

      req.user = sessionResult.user;
      req.sessionId = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdminRole(allowedRoles = ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN']) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access denied.'));
    }
    next();
  };
}

export const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const { userRepository } = await import('../repositories/userRepository.js');
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName || result.user.username,
      avatarUrl: result.user.avatarUrl || ''
    },
    expiresAt: result.session.expiresAt
  };
});

export const auth = authMiddleware;


