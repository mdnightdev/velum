import { saveLocalVaultKeyToDb, loadLocalVaultKeyFromDb } from './cryptoDbStore';

export class LocalVaultEncryption {
  private static activeKey: CryptoKey | null = null;
  private static activeSaltHex: string = '';

  private static async getOrCreateVaultKey(): Promise<{ key: CryptoKey, saltHex: string }> {
    if (this.activeKey) {
      return { key: this.activeKey, saltHex: this.activeSaltHex };
    }

    const existing = await loadLocalVaultKeyFromDb();
    if (existing) {
      this.activeKey = existing.key;
      this.activeSaltHex = existing.saltHex;
      return existing;
    }

    // Generate new key
    const subtle = window.crypto.subtle;
    const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    await saveLocalVaultKeyToDb(key, saltHex);
    this.activeKey = key;
    this.activeSaltHex = saltHex;
    return { key, saltHex };
  }

  public static async encryptPayload(plaintext: string): Promise<{ ciphertextHex: string, ivHex: string, saltHex: string }> {
    const { key, saltHex } = await this.getOrCreateVaultKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const subtle = window.crypto.subtle;
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const ciphertextArray = new Uint8Array(ciphertext);
    const ciphertextHex = Array.from(ciphertextArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

    return { ciphertextHex, ivHex, saltHex };
  }

  public static async decryptPayload(payload: { ciphertextHex: string, ivHex: string, saltHex: string }): Promise<string | null> {
    const { key, saltHex } = await this.getOrCreateVaultKey();
    
    // Only decrypt if the salt matches the current key (basic rotation safety check)
    // If the salt mismatches, the key was rotated and this payload is now cryptographically shredded.
    if (saltHex !== payload.saltHex) {
      console.warn('[LocalVault] Salt mismatch during decryption. Message history is inaccessible due to forward secrecy rotation.');
      return null;
    }

    const ivMatches = payload.ivHex.match(/.{1,2}/g) || [];
    const bodyMatches = payload.ciphertextHex.match(/.{1,2}/g) || [];

    const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(bodyMatches.map(byte => parseInt(byte, 16)));

    try {
      const subtle = window.crypto.subtle;
      const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('[LocalVault] Decryption failed', e);
      return null;
    }
  }

  public static async checkAndRotatePeriodically(): Promise<boolean> {
    const LAST_ROTATION_KEY = 'velum-last-vault-rotation';
    const ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    const lastRotation = localStorage.getItem(LAST_ROTATION_KEY);
    const now = Date.now();

    if (!lastRotation || (now - parseInt(lastRotation, 10)) > ROTATION_INTERVAL) {
      localStorage.setItem(LAST_ROTATION_KEY, now.toString());
      return true;
    }
    return false;
  }

  public static async rotateVaultKey(): Promise<void> {
    const subtle = window.crypto.subtle;
    const newKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    await saveLocalVaultKeyToDb(newKey, saltHex);
    this.activeKey = newKey;
    this.activeSaltHex = saltHex;
    console.log('[LocalVault] Vault key rotated. Forward secrecy enforced. Old history requires re-encryption.');
  }

  // Gets the current key directly to re-encrypt old messages if needed
  public static async getCurrentKey(): Promise<{ key: CryptoKey, saltHex: string }> {
    return this.getOrCreateVaultKey();
  }
}
