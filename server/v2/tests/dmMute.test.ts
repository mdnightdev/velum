import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db/redis.js', () => ({
  getRedisClient: vi.fn(),
}));

import { getRedisClient } from '../db/redis.js';
import { isDmPeerMuted } from '../utils/dmMute.js';

describe('isDmPeerMuted', () => {
  beforeEach(() => {
    vi.mocked(getRedisClient).mockReset();
  });

  it('returns false when redis missing', async () => {
    vi.mocked(getRedisClient).mockResolvedValue(null);
    expect(await isDmPeerMuted(1, 2)).toBe(false);
  });

  it('returns true when mute key exists', async () => {
    vi.mocked(getRedisClient).mockResolvedValue({
      get: vi.fn().mockResolvedValue('24h'),
    } as any);
    expect(await isDmPeerMuted(10, 20)).toBe(true);
  });

  it('returns false when mute key absent', async () => {
    vi.mocked(getRedisClient).mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
    } as any);
    expect(await isDmPeerMuted(10, 20)).toBe(false);
  });
});
