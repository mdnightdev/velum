import { describe, it, expect, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DEXIE_DB_VERSION,
  getDexieDb,
  getDexieDatabaseName,
  resolveDexieUserId,
  deleteDexieDb
} from '../../src/services/dexieDb';
import { DB_VERSION } from '../../src/services/cryptoDbStore';

describe('Dexie DB version, naming, and uid resolution', () => {
  afterEach(async () => {
    await deleteDexieDb(0);
    await deleteDexieDb(42);
  });

  it('aligns DB_VERSION with runtime Dexie verno', async () => {
    expect(DB_VERSION).toBe(DEXIE_DB_VERSION);
    const db = getDexieDb(42);
    await db.open();
    expect(db.verno).toBe(DEXIE_DB_VERSION);
    expect(db.name).toBe('velum_v3_42');
    db.close();
  });

  it('treats explicit uid 0 as a valid user id', () => {
    expect(resolveDexieUserId(0)).toBe(0);
    expect(getDexieDatabaseName(0)).toBe('velum_v3_0');
    expect(resolveDexieUserId(7)).toBe(7);
    expect(resolveDexieUserId(Number.NaN)).toBe(0);
    expect(resolveDexieUserId(Number.POSITIVE_INFINITY)).toBe(0);
    expect(resolveDexieUserId(-3)).toBe(0);
  });

  it('runs the v3 upgrade and exposes plaintext_cache', async () => {
    const db = getDexieDb(0);
    await db.open();
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'identity_keys',
      'media_blobs',
      'messages',
      'outbox_messages',
      'plaintext_cache',
      'signed_prekeys',
      'user_kv',
      'vault_metadata'
    ]);
    db.close();
  });
});
