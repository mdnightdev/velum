import { getDexieDb } from '../services/dexieDb';

/** Message history retention (aligned with IndexedDB write filter). */
export const MESSAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MESSAGE_MAX_ROWS = 2000;

/** Cached media blobs retention / size budget. */
export const MEDIA_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export type TimedRecord = { id: string; createdAt?: number; timestamp?: number | string };

/** Pure: pick ids to delete by age then by excess count (oldest first). */
export function pickIdsToTrimByAgeAndCount(
  records: TimedRecord[],
  nowMs: number,
  maxAgeMs: number,
  maxCount: number
): string[] {
  const withTime = records.map((r) => {
    const raw = r.createdAt ?? r.timestamp ?? 0;
    const t = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return { id: String(r.id), t: Number.isFinite(t) ? t : 0 };
  });

  const deleteIds = new Set<string>();
  for (const r of withTime) {
    if (r.t > 0 && nowMs - r.t > maxAgeMs) deleteIds.add(r.id);
  }

  const survivors = withTime
    .filter((r) => !deleteIds.has(r.id))
    .sort((a, b) => a.t - b.t);

  const overflow = survivors.length - maxCount;
  if (overflow > 0) {
    for (let i = 0; i < overflow; i++) deleteIds.add(survivors[i].id);
  }

  return [...deleteIds];
}

export type SizedTimedRecord = TimedRecord & { sizeBytes: number };

/** Pure: drop aged media, then oldest until under byte budget. */
export function pickMediaIdsToTrim(
  records: SizedTimedRecord[],
  nowMs: number,
  maxAgeMs: number,
  maxBytes: number
): string[] {
  const withTime = records.map((r) => {
    const raw = r.createdAt ?? r.timestamp ?? 0;
    const t = typeof raw === 'number' ? raw : Date.parse(String(raw));
    return {
      id: String(r.id),
      t: Number.isFinite(t) ? t : 0,
      sizeBytes: Math.max(0, r.sizeBytes || 0),
    };
  });

  const deleteIds = new Set<string>();
  let total = 0;
  for (const r of withTime) {
    if (r.t > 0 && nowMs - r.t > maxAgeMs) {
      deleteIds.add(r.id);
    } else {
      total += r.sizeBytes;
    }
  }

  if (total <= maxBytes) return [...deleteIds];

  const keepers = withTime
    .filter((r) => !deleteIds.has(r.id))
    .sort((a, b) => a.t - b.t);

  for (const r of keepers) {
    if (total <= maxBytes) break;
    deleteIds.add(r.id);
    total -= r.sizeBytes;
  }

  return [...deleteIds];
}

function blobByteSize(data: Blob | ArrayBuffer | ArrayBufferView | null | undefined): number {
  if (!data) return 0;
  if (data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return 0;
}

export async function trimLocalMessageCache(userId?: number, nowMs = Date.now()): Promise<number> {
  try {
    const db = getDexieDb(userId || 0);
    const all = await db.messages.toArray();
    const ids = pickIdsToTrimByAgeAndCount(
      all.map((m) => ({
        id: String(m.id),
        createdAt: typeof m.timestamp === 'number' ? m.timestamp : undefined,
        timestamp: m.timestamp || m.createdAt,
      })),
      nowMs,
      MESSAGE_MAX_AGE_MS,
      MESSAGE_MAX_ROWS
    );
    if (ids.length === 0) return 0;
    await db.messages.bulkDelete(ids);
    return ids.length;
  } catch (err) {
    console.warn('[cache] trimLocalMessageCache failed:', err);
    return 0;
  }
}

export async function trimLocalMediaCache(userId?: number, nowMs = Date.now()): Promise<number> {
  try {
    const db = getDexieDb(userId || 0);
    const all = await db.media_blobs.toArray();
    const ids = pickMediaIdsToTrim(
      all.map((m) => ({
        id: String(m.id),
        createdAt: m.createdAt,
        sizeBytes: blobByteSize(m.data),
      })),
      nowMs,
      MEDIA_MAX_AGE_MS,
      MEDIA_MAX_BYTES
    );
    if (ids.length === 0) return 0;
    await db.media_blobs.bulkDelete(ids);
    return ids.length;
  } catch (err) {
    console.warn('[cache] trimLocalMediaCache failed:', err);
    return 0;
  }
}

export async function clearCacheApi(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const keys = await window.caches.keys();
  await Promise.all(keys.map((k) => window.caches.delete(k)));
}

/** Clear reusable cache only — never crypto identity / vault keys. */
export async function clearReusableLocalCache(userId?: number): Promise<{
  messagesTrimmed: number;
  mediaCleared: number;
}> {
  const db = getDexieDb(userId || 0);
  let mediaCleared = 0;
  try {
    mediaCleared = await db.media_blobs.count();
    await db.media_blobs.clear();
  } catch (err) {
    console.warn('[cache] clear media_blobs failed:', err);
  }

  await clearCacheApi().catch(() => {});
  const messagesTrimmed = await trimLocalMessageCache(userId);

  return { messagesTrimmed, mediaCleared };
}

export async function estimateLocalCacheBytes(userId?: number): Promise<{
  messagesBytes: number;
  mediaBytes: number;
  messageCount: number;
  mediaCount: number;
  usageBytes: number | null;
  quotaBytes: number | null;
}> {
  let messagesBytes = 0;
  let mediaBytes = 0;
  let messageCount = 0;
  let mediaCount = 0;

  try {
    const db = getDexieDb(userId || 0);
    const messages = await db.messages.toArray();
    messageCount = messages.length;
    for (const m of messages) {
      const body = String(m.content || '') + String(m.plaintext || '');
      messagesBytes += body.length * 2;
    }
    const media = await db.media_blobs.toArray();
    mediaCount = media.length;
    for (const m of media) {
      mediaBytes += blobByteSize(m.data);
    }
  } catch (err) {
    console.warn('[cache] estimateLocalCacheBytes failed:', err);
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    }
  } catch {}

  return { messagesBytes, mediaBytes, messageCount, mediaCount, usageBytes, quotaBytes };
}

let trimStarted = false;

/** Run once per page session after login. */
export function scheduleLocalCacheMaintenance(userId?: number): void {
  if (trimStarted || typeof window === 'undefined') return;
  trimStarted = true;
  const run = () => {
    void trimLocalMessageCache(userId);
    void trimLocalMediaCache(userId);
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => run(), { timeout: 8000 });
  } else {
    setTimeout(run, 2500);
  }
}
