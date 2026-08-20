// Simple Distributed Lock Implementation using Redis
// Based on Redlock algorithm for distributed mutual exclusion

import { getRedisClient } from '../db/redis.js';

interface LockOptions {
  ttl: number; // Time to live in milliseconds
  retryDelay: number; // Delay between retry attempts in milliseconds
  retryCount: number; // Maximum number of retry attempts
}

interface LockResult {
  success: boolean;
  lockId?: string;
  error?: string;
}

export class DistributedLock {
  private lockKey: string;
  private lockId: string;
  private ttl: number;
  private acquired: boolean = false;

  constructor(key: string, options: Partial<LockOptions> = {}) {
    this.lockKey = `lock:${key}`;
    this.lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.ttl = options.ttl || 5000; // Default 5 seconds
  }

  async acquire(options: Partial<LockOptions> = {}): Promise<LockResult> {
    const retryDelay = options.retryDelay || 200;
    const retryCount = options.retryCount || 10;
    const ttl = options.ttl || this.ttl;

    const redis = await getRedisClient();
    if (!redis) {
      return { success: false, error: 'Redis not available' };
    }

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        // Try to acquire lock using SET with NX (not exists) and EX (expiration)
        const result = await redis.set(
          this.lockKey,
          this.lockId,
          {
            NX: true, // Only set if key doesn't exist
            PX: ttl   // Set expiration in milliseconds
          }
        );

        if (result === 'OK') {
          this.acquired = true;
          return { success: true, lockId: this.lockId };
        }

        // Lock not acquired, wait before retry
        if (attempt < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error('Error acquiring distributed lock:', error);
        return { success: false, error: String(error) };
      }
    }

    return { success: false, error: 'Lock acquisition failed after retries' };
  }

  async release(): Promise<boolean> {
    if (!this.acquired) {
      return true; // Already released or never acquired
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      // Use Lua script to ensure atomic check-and-delete
      // Only delete if the lock still belongs to us
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redis.eval(script, {
        keys: [this.lockKey],
        arguments: [this.lockId]
      });

      this.acquired = false;
      return result === 1;
    } catch (error) {
      console.error('Error releasing distributed lock:', error);
      return false;
    }
  }

  async extend(additionalTtl: number): Promise<boolean> {
    if (!this.acquired) {
      return false;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      // Use Lua script to safely extend lock only if we still own it
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await redis.eval(script, {
        keys: [this.lockKey],
        arguments: [this.lockId, String(additionalTtl)]
      });

      return result === 1;
    } catch (error) {
      console.error('Error extending distributed lock:', error);
      return false;
    }
  }

  isAcquired(): boolean {
    return this.acquired;
  }
}

// Helper function to execute code with distributed lock
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options?: Partial<LockOptions>
): Promise<T> {
  const lock = new DistributedLock(key, options);
  
  const { success, error } = await lock.acquire(options);
  
  if (!success) {
    throw new Error(`Failed to acquire lock: ${error}`);
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

// Helper function for retrying with exponential backoff
export async function withRetryLock<T>(
  key: string,
  fn: () => Promise<T>,
  options?: Partial<LockOptions & { maxRetries: number }>
): Promise<T> {
  const maxRetries = (options as any)?.maxRetries || 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withLock(key, fn, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 100; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Lock acquisition failed after retries');
}