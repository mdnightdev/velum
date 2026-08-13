import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, computeClientHash, EncryptionContext } from './encryptionService';

describe('encryptionService tests', () => {
  it('should encrypt and decrypt a lounge message correctly', async () => {
    const plain = 'Hello world, secure E2EE!';
    const context: EncryptionContext = { type: 'lounge', roomId: 'lounge-123', isEncrypted: true };
    const encrypted = await encryptMessage(plain, context);
    expect(encrypted).not.toBe(plain);

    const decrypted = await decryptMessage(encrypted, context);
    expect(decrypted).toBe(plain);
  });

  it('should pass through unencrypted content', async () => {
    const plain = 'Standard message';
    const context: EncryptionContext = { type: 'lounge', roomId: 'lounge-123', isEncrypted: false };
    const result = await decryptMessage(plain, context);
    expect(result).toBe(plain);
  });

  it('should compute SHA-256 client hash correctly', async () => {
    const secret = 'my-secret-password';
    const salt = 'some-salt-value';
    const hash = await computeClientHash(secret, salt);
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(64); // SHA-256 is 64 hex characters

    // Verifying same inputs produce same hash
    const secondHash = await computeClientHash(secret, salt);
    expect(secondHash).toBe(hash);

    // Verifying different inputs produce different hashes
    const differentHash = await computeClientHash(secret + '1', salt);
    expect(differentHash).not.toBe(hash);
  });
});
