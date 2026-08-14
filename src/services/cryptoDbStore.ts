const DB_NAME = 'velum_crypto_vault';
const DB_VERSION = 25;
const STORE_LOCAL_KEYS = 'local_keys';
const STORE_CONVERSATIONS = 'conversation_states';

export async function openCryptoDatabaseV2(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is unavailable.'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error('Failed to open crypto vault IndexedDB database.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_LOCAL_KEYS)) {
        db.createObjectStore(STORE_LOCAL_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'peerUserId' });
      }
      // Make sure old stores exist so we don't break skippedKeysStore
      if (!db.objectStoreNames.contains('skipped_message_keys')) {
        db.createObjectStore('skipped_message_keys', { keyPath: 'id' });
      }
    };
  });
}

// Storing Raw/JWK representations is best to avoid Structured Clone issues across browsers
export async function saveLocalKeysToDb(identityKeyPair: any, signedPrekeyPair: any, oneTimePrekeys: any[]) {
  try {
    const subtle = window.crypto.subtle;
    const exportKeyPair = async (kp: any) => ({
      publicKey: await subtle.exportKey('jwk', kp.publicKey),
      privateKey: await subtle.exportKey('jwk', kp.privateKey)
    });
    
    const record = {
      id: 'local_keys',
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

export async function loadLocalKeysFromDb(): Promise<any> {
  try {
    const db = await openCryptoDatabaseV2();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction([STORE_LOCAL_KEYS], 'readonly');
      const req = tx.objectStore(STORE_LOCAL_KEYS).get('local_keys');
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

export async function saveConversationStateToDb(peerUserId: number, state: any) {
  try {
    const subtle = window.crypto.subtle;
    const record: any = {
      peerUserId,
      rootKey: state.rootKey,
      sendChainKey: state.sendChainKey,
      receiveChainKey: state.receiveChainKey,
      sendChainLength: state.sendChainLength,
      receiveChainLength: state.receiveChainLength,
      receiveChainGeneration: state.receiveChainGeneration,
      previousChainLength: state.previousChainLength
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
    
    const db = await openCryptoDatabaseV2();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readwrite');
      const req = tx.objectStore(STORE_CONVERSATIONS).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to save conversation state'));
    });
  } catch (err) {
    console.error('Failed to save conversation state to DB', err);
  }
}

export async function loadConversationStateFromDb(peerUserId: number): Promise<any> {
  try {
    const db = await openCryptoDatabaseV2();
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readonly');
      const req = tx.objectStore(STORE_CONVERSATIONS).get(peerUserId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('Failed to load conversation state'));
    });
    
    if (!record) return null;
    
    const subtle = window.crypto.subtle;
    const state: any = {
      rootKey: record.rootKey,
      sendChainKey: record.sendChainKey,
      receiveChainKey: record.receiveChainKey,
      sendChainLength: record.sendChainLength,
      receiveChainLength: record.receiveChainLength,
      receiveChainGeneration: record.receiveChainGeneration,
      previousChainLength: record.previousChainLength,
      skippedMessageKeys: new Map() // Will be loaded separately or ignored here
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
    
    return state;
  } catch (err) {
    console.error('Failed to load conversation state from DB', err);
    return null;
  }
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
