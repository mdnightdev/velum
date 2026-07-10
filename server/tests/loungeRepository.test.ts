import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loungeRepository } from '../db/loungeRepository';

vi.mock('../db.js', () => {
  const mockDb = {
    lounges: [
      { id: 1, lounge_id: 'l_1', slug: 'lounge-one', parent_lounge_id: null, is_system: 1, invite_code: 'code1' },
      { id: 2, lounge_id: 'l_2', slug: 'sub-lounge', parent_lounge_id: 'l_1', is_system: 0, invite_code: 'code2' },
    ] as any[],
  };
  return {
    db: mockDb,
    saveDb: vi.fn(),
  };
});

describe('loungeRepository tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find all lounges', () => {
    const list = loungeRepository.findAll();
    expect(list).toHaveLength(2);
  });

  it('should find lounge by ID', () => {
    const l = loungeRepository.findById('l_2');
    expect(l).toBeDefined();
    expect(l?.slug).toBe('sub-lounge');
  });

  it('should find lounge by invite code', () => {
    const l = loungeRepository.findByInviteCode('code1');
    expect(l).toBeDefined();
    expect(l?.id).toBe(1);
  });

  it('should find sublounges', () => {
    const sub = loungeRepository.findSublounges('l_1');
    expect(sub).toHaveLength(1);
    expect(sub[0].lounge_id).toBe('l_2');
  });

  it('should find system lounges', () => {
    const sys = loungeRepository.findSystemLounges();
    expect(sys).toHaveLength(1);
    expect(sys[0].lounge_id).toBe('l_1');
  });
});
