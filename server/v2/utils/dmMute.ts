import { getRedisClient } from '../db/redis.js';

/**
 * True when recipient has muted sender (timed Redis key).
 * Fail-open (false) if Redis unavailable so delivery is never stuck.
 */
export async function isDmPeerMuted(recipientUserId: number, senderUserId: number): Promise<boolean> {
  if (!Number.isFinite(recipientUserId) || !Number.isFinite(senderUserId)) return false;
  if (recipientUserId <= 0 || senderUserId <= 0) return false;
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    const val = await redis.get(`user:${recipientUserId}:muted:${senderUserId}`);
    return !!val;
  } catch {
    return false;
  }
}
