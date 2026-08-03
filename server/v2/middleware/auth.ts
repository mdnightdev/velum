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

/**
 * Extract session token from Authorization header or x-session-id header.
 */
export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const xSessionId = req.headers['x-session-id'];
  if (typeof xSessionId === 'string' && xSessionId.trim().length > 0) {
    return xSessionId.trim();
  }
  return null;
}

/**
 * Hash session token using SHA-256 for secure database index lookup.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Authentication middleware template for v2 routes.
 * Decouples session loading logic so repositories/services supply user lookup.
 */
export function createAuthMiddleware(
  findSessionAndUser: (hashedToken: string) => Promise<{ user: AuthenticatedUser; expiresAt?: string | Date; lastPing?: string | Date } | null>
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractSessionToken(req);
      if (!token) {
        throw new UnauthorizedError('Unauthorized: Session token missing.');
      }

      const hashedToken = hashSessionToken(token);
      const sessionResult = await findSessionAndUser(hashedToken);

      if (!sessionResult) {
        throw new UnauthorizedError('Unauthorized: Session expired or invalid.');
      }

      if (sessionResult.expiresAt) {
        const expiresTime = new Date(sessionResult.expiresAt).getTime();
        if (Date.now() > expiresTime) {
          throw new UnauthorizedError('Unauthorized: Session expired. Please log in again.');
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

/**
 * Middleware enforcing administrative role requirement.
 */
export function requireAdminRole(allowedRoles = ['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN']) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Unauthorized: Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access forbidden: Elevated clearance required.'));
    }
    next();
  };
}
