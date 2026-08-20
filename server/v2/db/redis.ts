import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

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
      logger.error('Redis client error', { error: err.message });
    });
    await client.connect();
    redisClient = client as RedisClientType;
    logger.info('Connected to Redis stream bus successfully');
    
    // Initialize connection pool
    for (let i = 1; i < MAX_POOL_SIZE; i++) {
      try {
        const pooledClient = createClient({ url: config.REDIS_URL });
        pooledClient.on('error', (err) => {
          logger.error('Pooled Redis client error', { error: err.message });
        });
        await pooledClient.connect();
        connectionPool.push(pooledClient as RedisClientType);
      } catch (err) {
        logger.warn('Failed to create pooled Redis connection', { error: err });
      }
    }
    
    logger.info('Redis connection pool initialized', { 
      connections: connectionPool.length + 1 
    });
    return redisClient;
  } catch (err) {
    logger.warn('Unable to connect to Redis, falling back to in-memory event stream dispatch', { error: err });
    return null;
  }
}

export async function closeRedisConnections(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      logger.error('Error closing main Redis connection', { error: err });
    }
    redisClient = null;
  }
  
  for (const client of connectionPool) {
    try {
      await client.quit();
    } catch (err) {
      logger.error('Error closing pooled Redis connection', { error: err });
    }
  }
  connectionPool = [];
  currentPoolIndex = 0;
}
