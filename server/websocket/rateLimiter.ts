import { getRedisClient } from '../v2/db/redis.js';
import type { LeakyBucketState } from './types.js';

const inMemoryLeakyBuckets = new Map<number, LeakyBucketState>();
const BURST_CAPACITY = 5.0;
const REFILL_RATE_PER_MS = 0.001; // 1 token per 1000ms = 1 msg/sec sustained

export async function checkRateLimit(userId: number): Promise<boolean> {
  const now = Date.now();
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `ratelimit:leaky:user:${userId}`;
      const dataStr = await redis.get(key);
      let state: LeakyBucketState = { tokens: BURST_CAPACITY, lastRefill: now };
      if (dataStr) {
        try {
          state = JSON.parse(typeof dataStr === 'string' ? dataStr : JSON.stringify(dataStr));
        } catch {
          state = { tokens: BURST_CAPACITY, lastRefill: now };
        }
      }

      const elapsed = Math.max(0, now - state.lastRefill);
      const refilledTokens = elapsed * REFILL_RATE_PER_MS;
      state.tokens = Math.min(BURST_CAPACITY, state.tokens + refilledTokens);
      state.lastRefill = now;

      if (state.tokens >= 1.0) {
        state.tokens -= 1.0;
        await redis.set(key, JSON.stringify(state), { EX: 60 });
        return true;
      } else {
        await redis.set(key, JSON.stringify(state), { EX: 60 });
        return false;
      }
    }
  } catch (err) {
    console.error('[WS] Redis leaky bucket error, falling back to in-memory:', err);
  }

  // In-memory fallback if Redis is unavailable or errors
  let memState = inMemoryLeakyBuckets.get(userId);
  if (!memState) {
    memState = { tokens: BURST_CAPACITY, lastRefill: now };
  } else {
    const elapsed = Math.max(0, now - memState.lastRefill);
    const refilledTokens = elapsed * REFILL_RATE_PER_MS;
    memState.tokens = Math.min(BURST_CAPACITY, memState.tokens + refilledTokens);
    memState.lastRefill = now;
  }

  if (memState.tokens >= 1.0) {
    memState.tokens -= 1.0;
    inMemoryLeakyBuckets.set(userId, memState);
    return true;
  } else {
    inMemoryLeakyBuckets.set(userId, memState);
    return false;
  }
}
