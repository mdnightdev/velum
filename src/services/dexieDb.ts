import Dexie, { type Table, type Transaction } from 'dexie';

/** Source of truth for IndexedDB schema verno — keep in sync with highest this.version(n). */
export const DEXIE_DB_VERSION = 2;

const STORES_V1 = {
  identity_keys: 'id',
  signed_prekeys: 'id',
  vault_metadata: 'id',
  messages: 'id, loungeId, timestamp, client_msg_id, [loungeId+timestamp]',
  media_blobs: 'id',
  outbox_messages: 'client_msg_id, timestamp',
  user_kv: 'key',
} as const;

export class VelumDatabase extends Dexie {
  identity_keys!: Table<any, string>;
  signed_prekeys!: Table<any, string>;
  vault_metadata!: Table<any, string>;
  messages!: Table<any, string>;
  media_blobs!: Table<any, string>;
  outbox_messages!: Table<any, string>;
  user_kv!: Table<any, string>;

  constructor(dbName: string) {
    super(dbName);

    this.version(1).stores({ ...STORES_V1 });

    // v2: no store shape change — establishes the upgrade pipeline for future migrations.
    // When changing schema: bump DEXIE_DB_VERSION, add this.version(N).stores({...}).upgrade(...).
    this.version(DEXIE_DB_VERSION)
      .stores({ ...STORES_V1 })
      .upgrade(async (_tx: Transaction) => {
        // No-op stub. Put data transforms for schema changes here on the next version bump.
      });
  }
}

const dbInstances = new Map<number, VelumDatabase>();

/** Accepts explicit 0; only NaN/non-finite fall back to 0. */
export function resolveDexieUserId(userId: number = 0): number {
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    return 0;
  }
  const uid = Math.trunc(userId);
  return uid >= 0 ? uid : 0;
}

/** Canonical IndexedDB name — must stay in sync with getDexieDb / purge. */
export function getDexieDatabaseName(userId: number = 0): string {
  return `velum_v3_${resolveDexieUserId(userId)}`;
}

export function getDexieDb(userId: number = 0): VelumDatabase {
  const targetId = resolveDexieUserId(userId);
  let instance = dbInstances.get(targetId);
  if (!instance) {
    instance = new VelumDatabase(getDexieDatabaseName(targetId));
    dbInstances.set(targetId, instance);
  }
  return instance;
}

export async function deleteDexieDb(userId: number = 0): Promise<void> {
  const targetId = resolveDexieUserId(userId);
  const existing = dbInstances.get(targetId);
  if (existing) {
    existing.close();
    dbInstances.delete(targetId);
  }
  await Dexie.delete(getDexieDatabaseName(targetId));
}
