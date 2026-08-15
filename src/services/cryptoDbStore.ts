const DB_NAME = 'velum_crypto_vault';
const DB_VERSION = 26; // bumped: STORE_CONVERSATIONS keyPath changed from peerUserId -> id (namespaced by local user)
const STORE_LOCAL_KEYS = 'local_keys';
const STORE_CONVERSATIONS = 'conversation_states';

// Connection pooling cache
let dbConnection: IDBDatabase | null = null;
let dbConnectionPromise: Promise<IDBDatabase> | null = null;

export async function openCryptoDatabaseV2(): Promise<IDBDatabase> {
  // Return cached connection if available
  if (dbConnection) {
    return dbConnection;
  }
  
  // Return existing promise if connection is in progress
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }
  
  // Create new connection promise
  dbConnectionPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      dbConnectionPromise = null;
      return reject(new Error('IndexedDB is unavailable.'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbConnectionPromise = null;
      reject(new Error('Failed to open crypto vault IndexedDB database.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbConnection = null;
        dbConnectionPromise = null;
      };
      db.onclose = () => {
        dbConnection = null;
        dbConnectionPromise = null;
      };
      dbConnection = db;
      dbConnectionPromise = null;
      resolve(db);
    };
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_LOCAL_KEYS)) {
        db.createObjectStore(STORE_LOCAL_KEYS, { keyPath: 'id' });
      }
      // STORE_CONVERSATIONS previously used keyPath 'peerUserId', which meant every
      // logged-in account on this browser origin shared the SAME conversation-state
      // record for a given peer. Recreate with keyPath 'id' = `${localUserId}_${peerUserId}`.
      if (db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.deleteObjectStore(STORE_CONVERSATIONS);
      }
      db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });

      // Make sure old stores exist so we don't break skippedKeysStore
      if (!db.objectStoreNames.contains('skipped_message_keys')) {
        db.createObjectStore('skipped_message_keys', { keyPath: 'id' });
      }
    };
  });
  
  return dbConnectionPromise;
}

export async function closeCryptoDatabase(): Promise<void> {
  if (dbConnection) {
    dbConnection.close();
    dbConnection = null;
    dbConnectionPromise = null;
  }
}

function localKeysRecordId(localUserId: number): string {
  return `local_keys_${localUserId}`;
}

function conversationRecordId(localUserId: number, peerUserId: number): string {
  return `${localUserId}_${peerUserId}`;
}

// Storing Raw/JWK representations is best to avoid Structured Clone issues across browsers
export async function saveLocalKeysToDb(localUserId: number, identityKeyPair: any, signedPrekeyPair: any, oneTimePrekeys: any[]) {
  try {
    const subtle = window.crypto.subtle;
    const exportKeyPair = async (kp: any) => ({
      publicKey: await subtle.exportKey('jwk', kp.publicKey),
      privateKey: await subtle.exportKey('jwk', kp.privateKey)
    });
    
    const record = {
      id: localKeysRecordId(localUserId),
      localUserId,
      identityKeyPair: await exportKeyPair(identityKeyPair),
      signedPrekeyPair: await exportKeyPair(signedPrekeyPair),
      oneTimePrekeys: await Promise.all(oneTimePrekeys.map(exportKeyPair))
    };
    
    const db = await openCryptoDatabaseV2();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_LOCAL_KEYS], 'readwrite');
      const req = tx.objectStore(STORE_LOCAL_KEYS).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to save local keys'));
    });
  } catch (err) {
    console.error('Failed to save local keys to DB', err);
  }
}

export async function loadLocalKeysFromDb(localUserId: number): Promise<any> {
  try {
    const db = await openCryptoDatabaseV2();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction([STORE_LOCAL_KEYS], 'readonly');
      const req = tx.objectStore(STORE_LOCAL_KEYS).get(localKeysRecordId(localUserId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('Failed to load local keys'));
    });
    
    if (!record) return null;
    
    const subtle = window.crypto.subtle;
    const importKeyPair = async (kp: any) => ({
      publicKey: await subtle.importKey('jwk', kp.publicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
      privateKey: await subtle.importKey('jwk', kp.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
    });
    
    return {
      identityKeyPair: await importKeyPair(record.identityKeyPair),
      signedPrekeyPair: await importKeyPair(record.signedPrekeyPair),
      oneTimePrekeys: await Promise.all(record.oneTimePrekeys.map(importKeyPair))
    };
  } catch (err) {
    console.error('Failed to load local keys from DB', err);
    return null;
  }
}

export async function saveConversationStateToDb(localUserId: number, peerUserId: number, state: any) {
  try {
    const subtle = window.crypto.subtle;
    const record: any = {
      id: conversationRecordId(localUserId, peerUserId),
      localUserId,
      peerUserId,
      rootKey: state.rootKey,
      sendChainKey: state.sendChainKey,
      receiveChainKey: state.receiveChainKey,
      sendChainLength: state.sendChainLength,
      receiveChainLength: state.receiveChainLength,
      receiveChainGeneration: state.receiveChainGeneration,
      previousChainLength: state.previousChainLength,
      version: state.version || 1
    };
    
    if (state.dhRatchetKeyPair) {
      record.dhRatchetKeyPair = {
        publicKey: await subtle.exportKey('jwk', state.dhRatchetKeyPair.publicKey),
        privateKey: await subtle.exportKey('jwk', state.dhRatchetKeyPair.privateKey)
      };
    }
    
    if (state.dhRatchetPublicKey) {
      record.dhRatchetPublicKey = await subtle.exportKey('jwk', state.dhRatchetPublicKey);
    }
    
    // Serialize skippedMessageKeys Map for persistence
    if (state.skippedMessageKeys && state.skippedMessageKeys.size > 0) {
      const skippedKeysArray: any[] = [];
      for (const [key, cryptoKey] of state.skippedMessageKeys.entries()) {
        const keyJwk = await subtle.exportKey('jwk', cryptoKey);
        skippedKeysArray.push({
          key,
          keyJwk: JSON.stringify(keyJwk)
        });
      }
      record.skippedMessageKeys = skippedKeysArray;
    }
    
    // Calculate and store checksum for integrity validation
    const checksumData = {
      sendChainLength: state.sendChainLength,
      receiveChainLength: state.receiveChainLength,
      receiveChainGeneration: state.receiveChainGeneration,
      previousChainLength: state.previousChainLength,
      version: state.version || 1
    };
    const dataString = JSON.stringify(checksumData);
    const dataBytes = new TextEncoder().encode(dataString);
    const hashBuffer = await subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    record.checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const db = await openCryptoDatabaseV2();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readwrite');
      const req = tx.objectStore(STORE_CONVERSATIONS).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to save conversation state'));
    });
  } catch (err) {
    console.error('Failed to save conversation state to DB', err);
    throw err;
  }
}

export async function loadConversationStateFromDb(localUserId: number, peerUserId: number): Promise<any> {
  try {
    const db = await openCryptoDatabaseV2();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readonly');
      const req = tx.objectStore(STORE_CONVERSATIONS).get(conversationRecordId(localUserId, peerUserId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('Failed to load conversation state'));
    });
    
    if (!record) return null;
    
    const subtle = window.crypto.subtle;

    // Validate checksum if present
    if (record.checksum) {
      const checksumData = {
        sendChainLength: record.sendChainLength,
        receiveChainLength: record.receiveChainLength,
        receiveChainGeneration: record.receiveChainGeneration,
        previousChainLength: record.previousChainLength,
        version: record.version || 1
      };
      const dataString = JSON.stringify(checksumData);
      const dataBytes = new TextEncoder().encode(dataString);
      const hashBuffer = await subtle.digest('SHA-256', dataBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (calculatedChecksum !== record.checksum) {
        console.error('[CryptoDbStore] Checksum validation failed for conversation state - possible corruption');
        return null; // Reject corrupted state
      }
    }
    
    // Validate version compatibility
    const currentStateVersion = 1; // Current supported version
    if (record.version && record.version > currentStateVersion) {
      console.warn('[CryptoDbStore] State version from database is newer than current implementation');
      // Continue anyway, but log warning
    }
    
    const state: any = {
      rootKey: record.rootKey,
      sendChainKey: record.sendChainKey,
      receiveChainKey: record.receiveChainKey,
      sendChainLength: record.sendChainLength,
      receiveChainLength: record.receiveChainLength,
      receiveChainGeneration: record.receiveChainGeneration,
      previousChainLength: record.previousChainLength,
      skippedMessageKeys: new Map(),
      version: record.version || 1
    };
    
    if (record.dhRatchetKeyPair) {
      state.dhRatchetKeyPair = {
        publicKey: await subtle.importKey('jwk', record.dhRatchetKeyPair.publicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
        privateKey: await subtle.importKey('jwk', record.dhRatchetKeyPair.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
      };
    }
    
    if (record.dhRatchetPublicKey) {
      state.dhRatchetPublicKey = await subtle.importKey('jwk', record.dhRatchetPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    }
    
    // Deserialize skippedMessageKeys Map from persisted array
    if (record.skippedMessageKeys && Array.isArray(record.skippedMessageKeys)) {
      for (const skippedKeyRecord of record.skippedMessageKeys) {
        try {
          const keyJwk = JSON.parse(skippedKeyRecord.keyJwk);
          const cryptoKey = await subtle.importKey(
            'jwk',
            keyJwk,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          state.skippedMessageKeys.set(skippedKeyRecord.key, cryptoKey);
        } catch (keyErr) {
          console.warn('[CryptoDbStore] Failed to deserialize skipped key:', skippedKeyRecord.key, keyErr);
        }
      }
    }
    
    return state;
  } catch (err) {
    console.error('Failed to load conversation state from DB', err);
    return null;
  }
}

export async function deleteConversationStateFromDb(localUserId: number, peerUserId: number): Promise<void> {
  const db = await openCryptoDatabaseV2();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readwrite');
      const store = tx.objectStore(STORE_CONVERSATIONS);
      const req = store.delete(conversationRecordId(localUserId, peerUserId));
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`[CryptoDbStore] Failed to delete conversation state for peer ${peerUserId}`, req.error);
        resolve();
      };
      tx.oncomplete = () => {
        try { db.close(); } catch (_) {}
      };
    } catch (e) {
      console.warn(`[CryptoDbStore] Error deleting conversation state for peer ${peerUserId}:`, e);
      try { db.close(); } catch (_) {}
      resolve();
    }
  });
}

export async function purgeCryptoVault(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve();
    }
    const request = window.indexedDB.deleteDatabase('velum_crypto_vault');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete crypto vault'));
    request.onblocked = () => {
      console.warn('Crypto vault deletion is blocked by another tab');
      resolve(); // Best effort
    };
  });
}


export async function saveLocalVaultKeyToDb(key: CryptoKey, saltHex: string) {
  try {
    const subtle = window.crypto.subtle;
    const jwk = await subtle.exportKey('jwk', key);
    const db = await openCryptoDatabaseV2();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_LOCAL_KEYS], 'readwrite');
      const req = tx.objectStore(STORE_LOCAL_KEYS).put({ id: 'local_vault_key', jwk, saltHex });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to save local vault key'));
    });
  } catch (err) {
    console.error('Failed to save local vault key', err);
  }
}

export async function loadLocalVaultKeyFromDb(): Promise<{ key: CryptoKey, saltHex: string } | null> {
  try {
    const db = await openCryptoDatabaseV2();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction([STORE_LOCAL_KEYS], 'readonly');
      const req = tx.objectStore(STORE_LOCAL_KEYS).get('local_vault_key');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('Failed to load local vault key'));
    });
    if (!record || !record.jwk) return null;
    const subtle = window.crypto.subtle;
    const key = await subtle.importKey('jwk', record.jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    return { key, saltHex: record.saltHex };
  } catch (err) {
    return null;
  }
}
