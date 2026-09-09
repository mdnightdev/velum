import type { Request, Response, NextFunction } from 'express';
import { SystemConfigService } from '../services/systemConfigService.js';
import { userRepository } from '../repositories/userRepository.js';
import { hashSessionToken } from '../utils/crypto.js';

const ADMIN_ROLES = new Set(['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN', 'BANK_ADMIN']);

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const fullPath = (req.baseUrl || '') + (req.path || '');

  // Never intercept frontend assets, Vite modules, HTML, scripts, stylesheets, or icons
  if (
    !fullPath.startsWith('/v2') &&
    !fullPath.startsWith('/api') &&
    !fullPath.startsWith('/api/v2')
  ) {
    return next();
  }

  // Endpoints always accessible during maintenance (auth handshakes, health, public status, passkeys, OTA)
  if (
    fullPath.startsWith('/health') ||
    fullPath.startsWith('/metrics') ||
    fullPath.startsWith('/uploads') ||
    fullPath.includes('/auth') ||
    fullPath.includes('/webauthn') ||
    fullPath.includes('/public') ||
    fullPath.includes('/system-status') ||
    fullPath.includes('/ota') ||
    fullPath === '/'
  ) {
    return next();
  }

  try {
    const config = await SystemConfigService.getAll();
    if (!config.maintenanceMode) {
      return next();
    }

    // Check if grace period is active for standard users
    const graceEndsAtStr = await SystemConfigService.get('maintenance_grace_ends_at', '0');
    const graceEndsAt = parseInt(graceEndsAtStr, 10) || 0;
    const isWithinGrace = graceEndsAt > Date.now();

    // Inspect session credentials to allow administrator operations or active grace period
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
      if (sessionData) {
        // Whitelist System IDs and Staff roles
        if ([1, 2, 999].includes(sessionData.user.id) || ADMIN_ROLES.has(sessionData.user.role)) {
          return next();
        }

        // Standard user within active 5-minute grace window
        if (isWithinGrace) {
          return next();
        }
      }
    }

    res.status(503).json({
      error: 'Platform is currently undergoing scheduled maintenance. Standard operations are temporarily suspended.',
      maintenance: true
    });
  } catch {
    next();
  }
}
