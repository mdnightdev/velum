import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  clearMemoryPlaintextCache,
  getMemoryPlaintext,
  hashCiphertext,
  setMemoryPlaintext,
} from '../../src/utils/plaintextCache';
import {
  getPlaintextByCiphertext,
  putPlaintextByCiphertext,
  resolvePlaintextsForContents,
} from '../../src/utils/indexedDb';
import { deleteDexieDb, DEXIE_DB_VERSION, getDexieDb } from '../../src/services/dexieDb';

describe('plaintext cache (memory + indexed Dexie)', () => {
  beforeEach(async () => {
    clearMemoryPlaintextCache();
    await deleteDexieDb(0);
  });

  afterEach(async () => {
    clearMemoryPlaintextCache();
    await deleteDexieDb(0);
  });

  it('hashes ciphertext stably', () => {
    expect(hashCiphertext('e2ee:v3:1:a:b:c')).toBe(hashCiphertext('e2ee:v3:1:a:b:c'));
    expect(hashCiphertext('a')).not.toBe(hashCiphertext('b'));
  });

  it('serves memory before Dexie', async () => {
    setMemoryPlaintext('e2ee:cipher-a', 'hello');
    expect(getMemoryPlaintext('e2ee:cipher-a')).toBe('hello');
    expect(await getPlaintextByCiphertext('e2ee:cipher-a', 0)).toBe('hello');
  });

  it('persists and batch-resolves via plaintext_cache store', async () => {
    const db = getDexieDb(0);
    await db.open();
    expect(db.verno).toBe(DEXIE_DB_VERSION);
    expect(db.tables.map((t) => t.name)).toContain('plaintext_cache');

    await putPlaintextByCiphertext('e2ee:cipher-1', 'one', 0);
    await putPlaintextByCiphertext('e2ee:cipher-2', 'two', 0);
    clearMemoryPlaintextCache();

    expect(await getPlaintextByCiphertext('e2ee:cipher-1', 0)).toBe('one');

    clearMemoryPlaintextCache();
    const map = await resolvePlaintextsForContents(
      ['e2ee:cipher-1', 'e2ee:cipher-2', 'e2ee:missing'],
      0
    );
    expect(map.get('e2ee:cipher-1')).toBe('one');
    expect(map.get('e2ee:cipher-2')).toBe('two');
    expect(map.has('e2ee:missing')).toBe(false);
    db.close();
  });

  it('rejects poison plaintext writes', async () => {
    await putPlaintextByCiphertext('e2ee:x', '[Encrypted Message]', 0);
    expect(await getPlaintextByCiphertext('e2ee:x', 0)).toBeNull();
  });
});
