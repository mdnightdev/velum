import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userRepository } from '../db/userRepository';

vi.mock('../db.js', () => {
  const mockDb = {
    users: [
      { user_id: 1, username: 'testuser', role: 'USER' },
      { user_id: 2, username: '@admin', role: 'ADMIN' },
    ] as any[],
  };
  return {
    db: mockDb,
    saveDb: vi.fn(),
  };
});

describe('userRepository tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find all users', () => {
    const list = userRepository.findAll();
    expect(list).toHaveLength(2);
    expect(list[0].username).toBe('testuser');
  });

  it('should find user by ID', () => {
    const u = userRepository.findById(2);
    expect(u).toBeDefined();
    expect(u?.username).toBe('@admin');
  });

  it('should find user by username case-insensitively', () => {
    const u1 = userRepository.findByUsername('TESTUSER');
    expect(u1).toBeDefined();
    expect(u1?.user_id).toBe(1);

    const u2 = userRepository.findByUsername('admin');
    expect(u2).toBeDefined();
    expect(u2?.user_id).toBe(2);
  });

  it('should calculate next incremental ID', () => {
    const next = userRepository.nextId();
    expect(next).toBe(3);
  });
});
