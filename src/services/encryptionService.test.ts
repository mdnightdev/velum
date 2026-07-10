import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, computeClientHash } from './encryptionService';

describe('encryptionService tests', () => {
  it('should encrypt and decrypt a message correctly', () => {
    const plain = 'Hello world, secure E2EE!';
    const roomId = 'lounge-123';
    const encrypted = encryptMessage(plain, roomId);
    expect(encrypted).not.toBe(plain);

    const decrypted = decryptMessage(encrypted, roomId, true);
    expect(decrypted).toBe(plain);
  });

  it('should pass through unencrypted content', () => {
    const plain = 'Standard message';
    const roomId = 'lounge-123';
    const result = decryptMessage(plain, roomId, false);
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
