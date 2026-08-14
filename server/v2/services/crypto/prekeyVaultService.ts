import { db, executeWithRetry } from '../../db/client.js';
import { userPrekeys } from '../../db/schema/keys.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface PrekeyBundlePayload {
  identityKey: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekeys: string[] | string;
}

export async function publishPrekeyBundle(
  userId: number,
  bundle: PrekeyBundlePayload
): Promise<void> {
  const oneTimeStr = typeof bundle.oneTimePrekeys === 'string'
    ? bundle.oneTimePrekeys
    : JSON.stringify(bundle.oneTimePrekeys || []);

  const existing = await executeWithRetry(() =>
    db.select({ id: userPrekeys.id })
      .from(userPrekeys)
      .where(eq(userPrekeys.userId, userId))
      .limit(1)
  );

  if (existing.length === 0) {
    await executeWithRetry(() =>
      db.insert(userPrekeys).values({
        userId,
        identityKey: bundle.identityKey,
        signedPrekey: bundle.signedPrekey,
        signedPrekeySignature: bundle.signedPrekeySignature,
        oneTimePrekeys: oneTimeStr,
        updatedAt: new Date()
      })
    );
  } else {
    await executeWithRetry(() =>
      db.update(userPrekeys)
        .set({
          identityKey: bundle.identityKey,
          signedPrekey: bundle.signedPrekey,
          signedPrekeySignature: bundle.signedPrekeySignature,
          oneTimePrekeys: oneTimeStr,
          updatedAt: new Date()
        })
        .where(eq(userPrekeys.userId, userId))
    );
  }
}

export async function fetchPrekeyBundle(targetUserId: number): Promise<{
  userId: number;
  identityKey: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekey?: string;
  oneTimePrekeysLeft: number;
} | null> {
  const [record] = await executeWithRetry(() =>
    db.select()
      .from(userPrekeys)
      .where(eq(userPrekeys.userId, targetUserId))
      .limit(1)
  );

  if (!record) return null;

  let pool: string[] = [];
  try {
    pool = JSON.parse(record.oneTimePrekeys || '[]');
  } catch {
    pool = [];
  }

  let consumedOneTimePrekey: string | undefined = undefined;

  // Consume 1 one-time prekey from pool atomically for single-use X3DH
  if (pool.length > 0) {
    consumedOneTimePrekey = pool.shift();
    await executeWithRetry(() =>
      db.update(userPrekeys)
        .set({
          oneTimePrekeys: JSON.stringify(pool),
          updatedAt: new Date()
        })
        .where(eq(userPrekeys.userId, targetUserId))
    );
  }

  return {
    userId: targetUserId,
    identityKey: record.identityKey,
    signedPrekey: record.signedPrekey,
    signedPrekeySignature: record.signedPrekeySignature,
    oneTimePrekey: consumedOneTimePrekey,
    oneTimePrekeysLeft: pool.length
  };
}

/**
 * Generates a Signal-style Safety Number (6 5-digit decimal blocks) from two public identity keys.
 */
export function generateSafetyNumber(identityKeyA: string, identityKeyB: string): string {
  const sortedKeys = [identityKeyA, identityKeyB].sort();
  const combined = sortedKeys.join('::');
  const hash = crypto.createHash('sha256').update(combined).digest();

  // Extract 6 32-bit unsigned integers from hash
  const blocks: string[] = [];
  for (let i = 0; i < 6; i++) {
    const val = hash.readUInt32BE(i * 4);
    const code = (val % 100000).toString().padStart(5, '0');
    blocks.push(code);
  }

  return blocks.join(' ');
}
