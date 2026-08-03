import crypto from 'node:crypto';
import { userRepository } from '../repositories/userRepository.js';
import { hashArgon2id, safeCompare, generateRandomToken } from '../utils/crypto.js';
import { hashSessionToken } from '../middleware/auth.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';
import type { RegisterInput, LoginInput } from '../schemas/auth.js';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByUsername(input.username);
    if (existing) {
      throw new ConflictError('Username is already taken');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashArgon2id(input.password, Buffer.from(salt, 'hex'));

    const user = await userRepository.create({
      username: input.username,
      passwordHash,
      salt
    });

    return {
      userId: user.id,
      username: user.username,
      role: user.role
    };
  }

  async login(input: LoginInput, ipAddress?: string) {
    const user = await userRepository.findByUsername(input.username);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const saltBuffer = user.salt ? Buffer.from(user.salt, 'hex') : crypto.randomBytes(16);
    const computedHash = await hashArgon2id(input.password, saltBuffer);

    if (!safeCompare(user.passwordHash, computedHash)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const sessionToken = generateRandomToken(32);
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.createSession({
      userId: user.id,
      tokenHash,
      ipAddress,
      expiresAt
    });

    return {
      sessionToken,
      user: {
        userId: user.id,
        username: user.username,
        role: user.role
      }
    };
  }

  async logout(tokenHash: string) {
    await userRepository.deleteSessionByTokenHash(tokenHash);
  }
}

export const authService = new AuthService();
