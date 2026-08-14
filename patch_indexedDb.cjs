const fs = require('fs');
const file = 'src/utils/indexedDb.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = `import { LocalVaultEncryption } from '../services/localVaultEncryption';\n`;

// Replace saveLocalMessages
const saveLocalMessagesOld = `export async function saveLocalMessages(loungeId: string, messages: any[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);
    const request = store.put(messages, loungeId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(\`Failed to save cached messages for lounge: \${loungeId}\`));
  });
}`;

const saveLocalMessagesNew = `export async function saveLocalMessages(loungeId: string, messages: any[]): Promise<void> {
  const payloadStr = JSON.stringify(messages);
  const encryptedPayload = await LocalVaultEncryption.encryptPayload(payloadStr);

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);
    const request = store.put({ _encrypted: true, ...encryptedPayload }, loungeId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(\`Failed to save cached messages for lounge: \${loungeId}\`));
  });
}`;

// Replace getLocalMessages
const getLocalMessagesOld = `export async function getLocalMessages(loungeId: string): Promise<any[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.get(loungeId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(\`Failed to get cached messages for lounge: \${loungeId}\`));
    });
  } catch (err) {
    console.warn('[IndexedDB] Local database is unavailable:', err);
    return null;
  }
}`;

const getLocalMessagesNew = `export async function getLocalMessages(loungeId: string): Promise<any[] | null> {
  try {
    const db = await openDatabase();
    const result: any = await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.get(loungeId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(\`Failed to get cached messages for lounge: \${loungeId}\`));
    });

    if (!result) return null;

    if (result._encrypted) {
      const decryptedStr = await LocalVaultEncryption.decryptPayload(result);
      if (!decryptedStr) return null; // Key rotation shredded it
      return JSON.parse(decryptedStr);
    }

    // Legacy unencrypted array, migrate it automatically on next save
    return result;

  } catch (err) {
    console.warn('[IndexedDB] Local database is unavailable:', err);
    return null;
  }
}`;

// Re-encryption feature to enforce forward secrecy for existing messages
const reEncryptOld = `
export async function rotateAndReEncryptLocalMessages(): Promise<void> {
  try {
    const db = await openDatabase();
    const allRecords = await new Promise<{ key: IDBValidKey, value: any }[]>((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const req = store.getAll();
      const keysReq = store.getAllKeys();
      
      req.onsuccess = () => {
        keysReq.onsuccess = () => {
          const records = keysReq.result.map((key, i) => ({ key, value: req.result[i] }));
          resolve(records);
        };
      };
      req.onerror = () => reject(new Error('Failed to fetch messages for re-encryption'));
    });

    const decryptedData = [];
    // Decrypt all possible records with the current key
    for (const record of allRecords) {
      if (record.value._encrypted) {
        const str = await LocalVaultEncryption.decryptPayload(record.value);
        if (str) {
          decryptedData.push({ key: record.key, plaintext: str });
        }
      } else if (Array.isArray(record.value)) {
        decryptedData.push({ key: record.key, plaintext: JSON.stringify(record.value) });
      }
    }

    // Now rotate the key
    await LocalVaultEncryption.rotateVaultKey();

    // Re-encrypt and overwrite
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);

    for (const data of decryptedData) {
      const encrypted = await LocalVaultEncryption.encryptPayload(data.plaintext);
      store.put({ _encrypted: true, ...encrypted }, data.key);
    }
    
    // We can also return a promise for the transaction completion if needed.
  } catch (err) {
    console.error('[IndexedDB] Failed to rotate and re-encrypt local messages', err);
  }
}
`;

code = importStatement + code.replace(saveLocalMessagesOld, saveLocalMessagesNew).replace(getLocalMessagesOld, getLocalMessagesNew) + reEncryptOld;
fs.writeFileSync(file, code);
