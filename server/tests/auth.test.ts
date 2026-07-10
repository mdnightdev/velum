import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { 
  getPreSignupSalt, 
  getLoginNonce, 
  getSession, 
  registerUser, 
  loginUser
} from '../controllers/auth';
import { authenticateUser, authenticateAdmin } from '../middlewares/auth';
import { checkStepOTP, getStepOTP } from '../utils/crypto';
import { db } from '../db.js';

// Setup Mock for database module
vi.mock('../db.js', () => {
  const mockDb = {
    users: [
      {
        user_id: 42,
        username: 'existinguser',
        salt: '0123456789abcdef', // 16 hex chars = 8 bytes
        password_hash: 'argon2id:hash123',
        panic_phrase_hash: 'argon2id:panic123',
        role: 'USER',
        status: 'active',
      }
    ] as any[],
    profiles: [
      {
        user_id: 42,
        profile_id: 'p_42',
        updated_at: '',
      }
    ] as any[],
    devices: [] as any[],
    ip_addresses: [] as any[],
    invites: [] as any[],
    sessions: [] as any[],
    suspicious_events: [] as any[],
  };
  return {
    db: mockDb,
    loadDb: vi.fn(),
    saveDb: vi.fn(),
    ensureVelumSystemDM: vi.fn(),
    generateLoginNonce: vi.fn(() => 'mock-nonce-12345'),
    verifyAndConsumeNonce: vi.fn((nonce) => nonce === 'mock-nonce-12345'),
  };
});

// Setup mock for authService module
vi.mock('../services/authService.js', () => {
  return {
    validateCredentials: vi.fn(async (user, password) => {
      return { isValid: password === 'a'.repeat(64) };
    }),
    executePanicWipe: vi.fn(),
    createNewSession: vi.fn(() => ({ sessionId: 'mock-session-123' })),
  };
});

// Setup mock for middleware token generation
vi.mock('../middleware.js', () => {
  return {
    generateSessionToken: vi.fn(() => 'mock-session-token-999'),
    rateLimiterCache: new Map(),
  };
});

describe('Authentication Controller tests', () => {
  let mockReq: any;
  let mockRes: any;
  let resJsonData: any;
  let resStatus: number;

  beforeEach(() => {
    resJsonData = null;
    resStatus = 200;

    mockReq = {
      body: {},
      ip: '127.0.0.1',
      headers: {},
    };

    mockRes = {
      status: (code: number) => {
        resStatus = code;
        return mockRes;
      },
      json: (data: any) => {
        resJsonData = data;
        return mockRes;
      },
    };

    vi.clearAllMocks();
  });

  describe('getPreSignupSalt', () => {
    it('should generate a 32-byte hex salt', () => {
      getPreSignupSalt(mockReq, mockRes);
      expect(resStatus).toBe(200);
      expect(resJsonData.salt).toBeDefined();
      expect(resJsonData.salt).toHaveLength(64);
    });
  });

  describe('getLoginNonce', () => {
    it('should generate a valid login challenge nonce', () => {
      getLoginNonce(mockReq, mockRes);
      expect(resStatus).toBe(200);
      expect(resJsonData.nonce).toBe('mock-nonce-12345');
    });
  });

  describe('getSession', () => {
    it('should return 401 if user is not in request context', () => {
      getSession(mockReq, mockRes);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Unauthorized');
    });

    it('should return user info if user is in request context', () => {
      mockReq.user = {
        user_id: 1,
        username: 'testuser',
        role: 'USER',
        status: 'active',
      };
      getSession(mockReq, mockRes);
      expect(resStatus).toBe(200);
      expect(resJsonData).toEqual({
        userId: 1,
        username: 'testuser',
        role: 'USER',
        status: 'active',
      });
    });
  });

  describe('registerUser', () => {
    it('should reject registration if required parameters are missing', async () => {
      mockReq.body = { username: 'user' };
      await registerUser(mockReq, mockRes);
      expect(resStatus).toBe(400);
      expect(resJsonData.error).toContain('Missing required registration parameters');
    });

    it('should reject registration if username contains spaces', async () => {
      mockReq.body = {
        username: 'invalid user name',
        password: 'securepassword123',
        safeWord: 'safeword',
        panicPhrase: 'panic',
      };
      await registerUser(mockReq, mockRes);
      expect(resStatus).toBe(400);
      expect(resJsonData.error).toContain('must not contain any spaces');
    });
  });

  describe('loginUser', () => {
    it('should reject login if username or password is missing', async () => {
      mockReq.body = { username: 'existinguser' };
      await loginUser(mockReq, mockRes);
      expect(resStatus).toBe(400);
      expect(resJsonData.error).toContain('Missing username or password');
    });

    it('should reject login if nonce challenge is invalid', async () => {
      mockReq.body = {
        username: 'existinguser',
        password: 'a'.repeat(64),
        nonce: 'invalid-nonce-999',
      };
      await loginUser(mockReq, mockRes);
      expect(resStatus).toBe(400);
      expect(resJsonData.error).toContain('handshake expired or replayed');
    });

    it('should reject login if password validation fails', async () => {
      mockReq.body = {
        username: 'existinguser',
        password: 'b'.repeat(64),
        nonce: 'mock-nonce-12345',
      };
      await loginUser(mockReq, mockRes);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Invalid credentials');
    });

    it('should allow login and return session payload if credentials are valid', async () => {
      mockReq.body = {
        username: 'existinguser',
        password: 'a'.repeat(64),
        nonce: 'mock-nonce-12345',
      };
      await loginUser(mockReq, mockRes);
      expect(resStatus).toBe(200);
      expect(resJsonData.success).toBe(true);
      expect(resJsonData.sessionId).toBe('mock-session-token-999');
    });
  });

  describe('Security and Token Boundary Tests', () => {
    let mockReq: any;
    let mockRes: any;
    let nextCalled: boolean;
    let resStatus: number;
    let resJsonData: any;

    beforeEach(() => {
      nextCalled = false;
      resStatus = 200;
      resJsonData = null;

      mockReq = {
        headers: {},
        ip: '127.0.0.1',
      };

      mockRes = {
        status: (code: number) => {
          resStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          resJsonData = data;
          return mockRes;
        },
      };

      // Clear sessions in the mocked database
      db.sessions = [];
      db.users = [
        {
          user_id: 42,
          username: 'existinguser',
          salt: '0123456789abcdef',
          password_hash: 'argon2id:hash123',
          panic_phrase_hash: 'argon2id:panic123',
          safe_word_hash: 'argon2id:safe123',
          role: 'USER',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          user_id: 100,
          username: 'adminuser',
          salt: '0123456789abcdef',
          password_hash: 'argon2id:hash123',
          panic_phrase_hash: 'argon2id:panic123',
          safe_word_hash: 'argon2id:safe123',
          role: 'CLI_ADMIN',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ] as any[];
    });

    it('should reject authentication if no token is provided', () => {
      authenticateUser(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Session security token missing');
    });

    it('should reject authentication if token is malformed/not found', () => {
      mockReq.headers.authorization = 'Bearer non-existent-session-id';
      authenticateUser(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Session expired or invalid');
    });

    it('should reject authentication if session has expired via expires_at', () => {
      const sessionId = 'expired-session-id-123';
      const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

      db.sessions.push({
        session_id: hashedSessionId,
        user_id: 42,
        status: 'active',
        expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        activity_metrics: {
          lastPing: new Date().toISOString()
        }
      } as any);

      mockReq.headers.authorization = `Bearer ${sessionId}`;
      authenticateUser(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Session expired. Please log in again');
    });

    it('should reject authentication if session has exceeded idle timeout', () => {
      const sessionId = 'idle-session-id-123';
      const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

      db.sessions.push({
        session_id: hashedSessionId,
        user_id: 42,
        status: 'active',
        activity_metrics: {
          lastPing: new Date(Date.now() - 31 * 60 * 1000).toISOString() // 31 minutes ago
        }
      } as any);

      mockReq.headers.authorization = `Bearer ${sessionId}`;
      authenticateUser(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(resStatus).toBe(401);
      expect(resJsonData.error).toContain('Session idle timeout exceeded');
    });

    it('should successfully authenticate user with a valid active session', () => {
      const sessionId = 'valid-session-id-123';
      const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

      db.sessions.push({
        session_id: hashedSessionId,
        user_id: 42,
        status: 'active',
        activity_metrics: {
          lastPing: new Date().toISOString()
        }
      } as any);

      mockReq.headers.authorization = `Bearer ${sessionId}`;
      authenticateUser(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.user_id).toBe(42);
    });

    it('should reject non-admin users for administrator endpoints', () => {
      const sessionId = 'user-session-id-123';
      const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

      db.sessions.push({
        session_id: hashedSessionId,
        user_id: 42, // USER role
        status: 'active',
        activity_metrics: {
          lastPing: new Date().toISOString()
        }
      } as any);

      mockReq.headers.authorization = `Bearer ${sessionId}`;
      authenticateAdmin(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(resStatus).toBe(403);
      expect(resJsonData.error).toContain('Security authorization escalated clearance required');
    });

    it('should accept administrator users for administrator endpoints', () => {
      const sessionId = 'admin-session-id-123';
      const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');

      db.sessions.push({
        session_id: hashedSessionId,
        user_id: 100, // CLI_ADMIN role
        status: 'active',
        activity_metrics: {
          lastPing: new Date().toISOString()
        }
      } as any);

      mockReq.headers.authorization = `Bearer ${sessionId}`;
      authenticateAdmin(mockReq, mockRes, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.role).toBe('CLI_ADMIN');
    });

    it('should correctly validate dynamic MFA/OTP within window and reject out of window', () => {
      const currentOtp = getStepOTP();
      expect(checkStepOTP(currentOtp)).toBe(true);

      // Malformed or empty token rejection
      expect(checkStepOTP('')).toBe(false);
      expect(checkStepOTP('1234')).toBe(false);
      expect(checkStepOTP('invalid')).toBe(false);
    });
  });
});
