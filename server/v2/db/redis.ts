import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient) return redisClient;
  if (!config.REDIS_URL) {
    return null;
  }

  try {
    const client = createClient({ url: config.REDIS_URL });
    client.on('error', (err) => {
      console.error('[REDIS v2] Redis client error:', err.message);
    });
    await client.connect();
    redisClient = client as RedisClientType;
    console.log('[REDIS v2] Connected to Redis stream bus successfully.');
    return redisClient;
  } catch (err) {
    console.warn('[REDIS v2] Unable to connect to Redis. Falling back to in-memory event stream dispatch.', err);
    return null;
  }
}
