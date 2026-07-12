import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { 
  getPreSignupSalt, 
  getLoginNonce, 
  getSession, 
  registerUser, 
  loginUser
} from '../controllers/auth';

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
});
