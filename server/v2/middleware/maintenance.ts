import type { Request, Response, NextFunction } from 'express';
import { SystemConfigService } from '../services/systemConfigService.js';
import { userRepository } from '../repositories/userRepository.js';
import { hashSessionToken } from '../utils/crypto.js';

const ADMIN_ROLES = new Set(['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN']);

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const fullPath = (req.baseUrl || '') + (req.path || '');

  // Endpoints always accessible during maintenance (auth handshakes, health, public status, passkeys)
  if (
    fullPath.startsWith('/health') ||
    fullPath.startsWith('/metrics') ||
    fullPath.startsWith('/uploads') ||
    fullPath.includes('/auth') ||
    fullPath.includes('/webauthn') ||
    fullPath.includes('/public') ||
    fullPath.includes('/system-status') ||
    fullPath === '/'
  ) {
    return next();
  }

  try {
    const config = await SystemConfigService.getAll();
    if (!config.maintenanceMode) {
      return next();
    }

    // Inspect session credentials to allow administrator operations
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-session-id']) {
      token = String(req.headers['x-session-id']).trim();
    }

    if (token) {
      const tokenHash = hashSessionToken(token);
      const sessionData = await userRepository.findSessionByTokenHash(tokenHash);
      if (sessionData && ADMIN_ROLES.has(sessionData.user.role)) {
        return next();
      }
    }

    res.status(503).json({
      error: 'Platform is currently undergoing maintenance. Non-administrative operations are temporarily suspended.',
      maintenance: true
    });
  } catch {
    next();
  }
}
