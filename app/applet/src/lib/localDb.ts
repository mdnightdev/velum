import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VelumLocalDB extends DBSchema {
  sessionData: {
    key: string;
    value: any;
  };
  messages: {
    key: string;
    value: any;
    indexes: { 'by-room': string };
  };
  rooms: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<VelumLocalDB>>;

export function initLocalDB() {
  if (!dbPromise) {
    dbPromise = openDB<VelumLocalDB>('velum-local-store', 1, {
      upgrade(db) {
        db.createObjectStore('sessionData');
        
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-room', 'room_id');
        
        db.createObjectStore('rooms', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function setLocalSessionData(key: string, data: any) {
  const db = await initLocalDB();
  return db.put('sessionData', data, key);
}

export async function getLocalSessionData(key: string) {
  const db = await initLocalDB();
  return db.get('sessionData', key);
}

export async function saveLocalMessage(message: any) {
  if (!message || !message.id) return;
  const db = await initLocalDB();
  return db.put('messages', message);
}

export async function getLocalMessagesForRoom(roomId: string) {
  const db = await initLocalDB();
  return db.getAllFromIndex('messages', 'by-room', roomId);
}

export async function clearLocalMessages(roomId: string) {
  const db = await initLocalDB();
  const tx = db.transaction('messages', 'readwrite');
  const index = tx.store.index('by-room');
  let cursor = await index.openCursor(roomId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function saveLocalRoom(room: any) {
  if (!room || !room.id) return;
  const db = await initLocalDB();
  return db.put('rooms', room);
}

export async function getLocalRooms() {
  const db = await initLocalDB();
  return db.getAll('rooms');
}
