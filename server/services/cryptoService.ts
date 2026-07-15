import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { hashArgon2id as cryptoHashArgon2id, safeCompare } from '../crypto.js';

// Use environment variable if set, otherwise use secure persisted random key & salt
const keyPath = path.join(process.cwd(), 'data', '.key');
let loadedKey = '';
let loadedSalt = '';

try {
  if (fs.existsSync(keyPath)) {
    const rawContent = fs.readFileSync(keyPath, 'utf8').trim();
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed && parsed.key) {
        loadedKey = parsed.key;
        loadedSalt = parsed.salt || '';
      }
    } catch (_) {
      loadedKey = rawContent;
    }
  }
} catch (err) {
  console.warn('[SYS-SECURE] Failed reading persisted .key file:', err);
}

let encryptionKeySource = process.env.DB_ENCRYPTION_KEY;
let dbCryptoSalt = process.env.DB_ENCRYPTION_SALT || '';

if (!encryptionKeySource || !dbCryptoSalt) {
  if (!encryptionKeySource) {
    if (loadedKey) {
      encryptionKeySource = loadedKey;
    } else {
      encryptionKeySource = crypto.randomBytes(32).toString('hex');
    }
  }
  
  if (!dbCryptoSalt) {
    if (loadedSalt) {
      dbCryptoSalt = loadedSalt;
    } else {
      dbCryptoSalt = crypto.randomBytes(16).toString('hex');
    }
  }

  try {
    const keyDir = path.dirname(keyPath);
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
    fs.writeFileSync(keyPath, JSON.stringify({ key: encryptionKeySource, salt: dbCryptoSalt }), 'utf8');
  } catch (err) {
    console.error('[SYS-SECURE] Failed to save/update persistent encryption parameters:', err);
  }
}

export const DB_CRYPTO_KEY = crypto.scryptSync(encryptionKeySource, dbCryptoSalt, 32);
export const DB_CRYPTO_KEY_LEGACY = crypto.scryptSync(encryptionKeySource, 'salt_velum', 32);

// Fallback keys derived from the persisted .key file (even if env overrides are active)
let fileCryptoKey: Buffer | null = null;
let fileCryptoKeyLegacy: Buffer | null = null;

if (loadedKey) {
  try {
    fileCryptoKey = crypto.scryptSync(loadedKey, loadedSalt || 'salt_velum', 32);
    fileCryptoKeyLegacy = crypto.scryptSync(loadedKey, 'salt_velum', 32);
  } catch (err) {
    console.error('[SYS-SECURE] Failed to derive fallback keys from file:', err);
  }
}

export let legacyDecryptionSucceeded = false;

export function setLegacyDecryptionSucceeded(val: boolean) {
  legacyDecryptionSucceeded = val;
}

const encryptionCache = new Map<string, string>();
const decryptionCache = new Map<string, string>();

export function encryptData(text: string): string {
  if (encryptionCache.has(text)) {
    return encryptionCache.get(text)!;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DB_CRYPTO_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  const result = `${iv.toString('hex')}:${encrypted}:${tag}`;
  
  if (encryptionCache.size > 5000) {
    encryptionCache.clear();
  }
  encryptionCache.set(text, result);
  return result;
}

export function decryptData(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Database decryption error: Empty payload.');
  }
  if (decryptionCache.has(encryptedText)) {
    return decryptionCache.get(encryptedText)!;
  }
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Database decryption error: Invalid encrypted GCM envelope format.');
  }
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  // Try primary key first
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', DB_CRYPTO_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    if (decryptionCache.size > 5000) {
      decryptionCache.clear();
    }
    decryptionCache.set(encryptedText, decrypted);
    return decrypted;
  } catch (primaryErr) {
    // Try legacy fallback key (primary source + standard salt)
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', DB_CRYPTO_KEY_LEGACY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      legacyDecryptionSucceeded = true;
      
      if (decryptionCache.size > 5000) {
        decryptionCache.clear();
      }
      decryptionCache.set(encryptedText, decrypted);
      return decrypted;
    } catch (_) {
      // Try fallback to key file (original encryption parameters)
      if (fileCryptoKey && !fileCryptoKey.equals(DB_CRYPTO_KEY)) {
        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', fileCryptoKey, iv);
          decipher.setAuthTag(tag);
          let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          legacyDecryptionSucceeded = true;
          
          if (decryptionCache.size > 5000) {
            decryptionCache.clear();
          }
          decryptionCache.set(encryptedText, decrypted);
          return decrypted;
        } catch (_) {}
      }
      
      // Try fallback to key file legacy parameters
      if (fileCryptoKeyLegacy && !fileCryptoKeyLegacy.equals(DB_CRYPTO_KEY_LEGACY)) {
        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', fileCryptoKeyLegacy, iv);
          decipher.setAuthTag(tag);
          let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          legacyDecryptionSucceeded = true;
          
          if (decryptionCache.size > 5000) {
            decryptionCache.clear();
          }
          decryptionCache.set(encryptedText, decrypted);
          return decrypted;
        } catch (_) {}
      }
      
      throw primaryErr; // Rethrow primary decryption failure if legacy also fails
    }
  }
}

export async function hashArgon2id(plainText: string, saltBuffer: Buffer): Promise<string> {
  return cryptoHashArgon2id(plainText, saltBuffer);
}

export async function verifyArgon2id(plainText: string, userSalt: string | undefined, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith('argon2id:')) {
    const parts = storedHash.split(':');
    if (parts.length === 2) {
      if (!userSalt) return false;
      const computed = await hashArgon2id(plainText, Buffer.from(userSalt, 'hex'));
      return safeCompare(computed, parts[1]);
    } else if (parts.length === 3) {
      // Hash the plaintext on the server side using the stored salt (parts[1])
      const computed = await hashArgon2id(plainText, Buffer.from(parts[1], 'hex'));
      return safeCompare(computed, parts[2]);
    }
  }

  return false;
}

export async function checkCredential(plainText: string, user: any, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  
  if (storedHash.startsWith('argon2id:')) {
    return verifyArgon2id(plainText, user.salt, storedHash);
  }
  return false;
}

