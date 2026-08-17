const fs = require('fs');
const file = 'src/services/cryptoDbStore.ts';
let code = fs.readFileSync(file, 'utf8');

const vaultKeyFns = `
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
`;

code += "\n" + vaultKeyFns;
fs.writeFileSync(file, code);
