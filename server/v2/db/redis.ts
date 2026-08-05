import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';

let redisClient: RedisClientType | null = null;
let connectionPool: RedisClientType[] = [];
const MAX_POOL_SIZE = 10;
let currentPoolIndex = 0;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!config.REDIS_URL) {
    return null;
  }

  // Return pooled connection if available
  if (connectionPool.length > 0) {
    const client = connectionPool[currentPoolIndex];
    currentPoolIndex = (currentPoolIndex + 1) % connectionPool.length;
    return client;
  }

  // Create initial connection
  if (redisClient) return redisClient;

  try {
    const client = createClient({ url: config.REDIS_URL });
    client.on('error', (err) => {
      console.error('[REDIS v2] Redis client error:', err.message);
    });
    await client.connect();
    redisClient = client as RedisClientType;
    console.log('[REDIS v2] Connected to Redis stream bus successfully.');
    
    // Initialize connection pool
    for (let i = 1; i < MAX_POOL_SIZE; i++) {
      try {
        const pooledClient = createClient({ url: config.REDIS_URL });
        pooledClient.on('error', (err) => {
          console.error('[REDIS v2] Pooled Redis client error:', err.message);
        });
        await pooledClient.connect();
        connectionPool.push(pooledClient as RedisClientType);
      } catch (err) {
        console.warn('[REDIS v2] Failed to create pooled Redis connection:', err);
      }
    }
    
    console.log(`[REDIS v2] Redis connection pool initialized with ${connectionPool.length + 1} connections.`);
    return redisClient;
  } catch (err) {
    console.warn('[REDIS v2] Unable to connect to Redis. Falling back to in-memory event stream dispatch.', err);
    return null;
  }
}

export async function closeRedisConnections(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      console.error('[REDIS v2] Error closing main Redis connection:', err);
    }
    redisClient = null;
  }
  
  for (const client of connectionPool) {
    try {
      await client.quit();
    } catch (err) {
      console.error('[REDIS v2] Error closing pooled Redis connection:', err);
    }
  }
  connectionPool = [];
  currentPoolIndex = 0;
}
