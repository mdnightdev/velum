const fs = require('fs');
const file = 'src/services/localVaultEncryption.ts';
let code = fs.readFileSync(file, 'utf8');

const rotateFn = `
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
`;

const modifiedRotateFn = `
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
`;

code = code.replace(rotateFn, modifiedRotateFn);
fs.writeFileSync(file, code);
