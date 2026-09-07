import { db, executeWithRetry } from '../../db/client.js';
import { userPrekeys } from '../../db/schema/keys.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface OneTimePrekeyItem {
  keyId: number;
  publicKey: string;
}

export interface PrekeyBundlePayload {
  registrationId?: number;
  deviceId?: number;
  identityKey: string;
  signedPrekeyId?: number;
  signedPrekey: string | { keyId: number; publicKey: string; signature: string };
  signedPrekeySignature?: string;
  oneTimePrekeys?: any[] | string;
}

export interface SignalPrekeyBundleDTO {
  userId: number;
  registrationId: number;
  deviceId: number;
  identityKey: string;
  signedPrekeyId: number;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekey: {
    keyId: number;
    publicKey: string;
  } | null;
  oneTimePrekeysLeft: number;
}

export async function publishPrekeyBundle(
  userId: number,
  bundle: PrekeyBundlePayload
): Promise<void> {
  const deviceId = bundle.deviceId ? String(bundle.deviceId) : '1';
  const registrationId = Number(bundle.registrationId) || 1;

  let signedPrekeyId = Number(bundle.signedPrekeyId) || 1;
  let signedPrekeyPub = '';
  let signedPrekeySig = '';

  if (typeof bundle.signedPrekey === 'object' && bundle.signedPrekey !== null) {
    signedPrekeyId = Number(bundle.signedPrekey.keyId) || signedPrekeyId;
    signedPrekeyPub = String(bundle.signedPrekey.publicKey);
    signedPrekeySig = String(bundle.signedPrekey.signature);
  } else {
    signedPrekeyPub = String(bundle.signedPrekey);
    signedPrekeySig = String(bundle.signedPrekeySignature || '');
  }

  const oneTimeStr = typeof bundle.oneTimePrekeys === 'string'
    ? bundle.oneTimePrekeys
    : JSON.stringify(bundle.oneTimePrekeys || []);

  await executeWithRetry(async () => {
    const existing = await db.select({ id: userPrekeys.id })
      .from(userPrekeys)
      .where(and(eq(userPrekeys.userId, userId), eq(userPrekeys.deviceId, deviceId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(userPrekeys).values({
        userId,
        deviceId,
        registrationId,
        identityKey: bundle.identityKey,
        signedPrekeyId,
        signedPrekey: signedPrekeyPub,
        signedPrekeySignature: signedPrekeySig,
        oneTimePrekeys: oneTimeStr,
        updatedAt: new Date()
      });
    } else {
      await db.update(userPrekeys)
        .set({
          registrationId,
          identityKey: bundle.identityKey,
          signedPrekeyId,
          signedPrekey: signedPrekeyPub,
          signedPrekeySignature: signedPrekeySig,
          oneTimePrekeys: oneTimeStr,
          updatedAt: new Date()
        })
        .where(eq(userPrekeys.id, existing[0].id));
    }
  });
}

export async function fetchPrekeyBundle(
  targetUserId: number,
  deviceId: string | number = '1'
): Promise<SignalPrekeyBundleDTO | null> {
  const deviceIdStr = String(deviceId);
  return await executeWithRetry(async () => {
    return await db.transaction(async (tx) => {
      let record;
      try {
        const query = tx
          .select()
          .from(userPrekeys)
          .where(and(eq(userPrekeys.userId, targetUserId), eq(userPrekeys.deviceId, deviceIdStr)))
          .limit(1);

        if (typeof (query as any).for === 'function') {
          [record] = await (query as any).for('update');
        } else {
          [record] = await query;
        }
      } catch {
        [record] = await tx
          .select()
          .from(userPrekeys)
          .where(and(eq(userPrekeys.userId, targetUserId), eq(userPrekeys.deviceId, deviceIdStr)))
          .limit(1);
      }

      if (!record) return null;

      let pool: any[] = [];
      try {
        if (Array.isArray(record.oneTimePrekeys)) {
          pool = [...record.oneTimePrekeys];
        } else if (typeof record.oneTimePrekeys === 'string') {
          pool = JSON.parse(record.oneTimePrekeys || '[]');
        }
      } catch {
        pool = [];
      }

      let consumedOneTimePrekey: { keyId: number; publicKey: string } | null = null;

      if (pool.length > 0) {
        const rawOtp = pool.shift();
        if (rawOtp) {
          if (typeof rawOtp === 'object' && rawOtp.keyId !== undefined && rawOtp.publicKey !== undefined) {
            consumedOneTimePrekey = {
              keyId: Number(rawOtp.keyId),
              publicKey: String(rawOtp.publicKey)
            };
          } else if (typeof rawOtp === 'string') {
            consumedOneTimePrekey = {
              keyId: 1,
              publicKey: rawOtp
            };
          }
        }

        await tx
          .update(userPrekeys)
          .set({
            oneTimePrekeys: JSON.stringify(pool),
            updatedAt: new Date()
          })
          .where(eq(userPrekeys.id, record.id));
      }

      return {
        userId: record.userId,
        registrationId: record.registrationId,
        deviceId: record.deviceId,
        identityKey: record.identityKey,
        signedPrekeyId: record.signedPrekeyId,
        signedPrekey: record.signedPrekey,
        signedPrekeySignature: record.signedPrekeySignature,
        oneTimePrekey: consumedOneTimePrekey,
        oneTimePrekeysLeft: pool.length
      };
    });
  });
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
