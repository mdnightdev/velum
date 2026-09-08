import Dexie, { type Table } from 'dexie';

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
    this.version(1).stores({
      identity_keys: 'id',
      signed_prekeys: 'id',
      vault_metadata: 'id',
      messages: 'id, loungeId, timestamp, client_msg_id, [loungeId+timestamp]',
      media_blobs: 'id',
      outbox_messages: 'client_msg_id, timestamp',
      user_kv: 'key',
    });
  }
}

const dbInstances = new Map<number, VelumDatabase>();

export function getDexieDb(userId: number = 0): VelumDatabase {
  const targetId = userId && !isNaN(userId) ? userId : 0;
  let instance = dbInstances.get(targetId);
  if (!instance) {
    instance = new VelumDatabase(`velum_v3_${targetId}`);
    dbInstances.set(targetId, instance);
  }
  return instance;
}
