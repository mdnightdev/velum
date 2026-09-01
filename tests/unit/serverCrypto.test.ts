import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSessionToken,
  hashKeyedHMAC,
  safeCompare,
  generateRandomToken,
  generateRecoveryKey,
  generatePanicPhrase,
  generateSecureInviteCode
} from '../../server/v2/utils/crypto.js';

describe('Server Cryptographic Utilities & Keyed HMAC-SHA256 Suite', () => {
  it('generates deterministic keyed HMAC-SHA256 hashes for session tokens', () => {
    const token = 'velum_session_test_token_12345';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // 256-bit hex hash
    assert.notEqual(hash1, token);
  });

  it('generates different hashes for different secret keys in hashKeyedHMAC', () => {
    const value = 'sensitive_card_reference_or_kyc';
    const secretA = 'secret_key_alpha_32_bytes_long_123';
    const secretB = 'secret_key_beta_32_bytes_long_4567';

    const hashA = hashKeyedHMAC(value, secretA);
    const hashB = hashKeyedHMAC(value, secretB);

    assert.equal(hashA.length, 64);
    assert.equal(hashB.length, 64);
    assert.notEqual(hashA, hashB);
  });

  it('performs constant-time string comparison without leaking length differences', () => {
    const stringA = 'secret_master_token_value_abc';
    const stringB = 'secret_master_token_value_abc';
    const stringDiff = 'secret_master_token_value_xyz';
    const stringDiffLen = 'short';

    assert.equal(safeCompare(stringA, stringB), true);
    assert.equal(safeCompare(stringA, stringDiff), false);
    assert.equal(safeCompare(stringA, stringDiffLen), false);
    assert.equal(safeCompare('', stringA), false);
    assert.equal(safeCompare(stringA, ''), false);
  });

  it('generates high-entropy CSPRNG tokens, recovery keys, and invite codes', () => {
    const token1 = generateRandomToken(32);
    const token2 = generateRandomToken(32);
    assert.equal(token1.length, 64);
    assert.notEqual(token1, token2);

    const recKey1 = generateRecoveryKey('VEL-REC');
    const recKey2 = generateRecoveryKey('VEL-REC');
    assert.match(recKey1, /^VEL-REC-\d{5}$/);
    assert.notEqual(recKey1, recKey2);

    const panic1 = generatePanicPhrase('P');
    const panic2 = generatePanicPhrase('P');
    assert.match(panic1, /^P-\d{6}$/);
    assert.notEqual(panic1, panic2);

    const invite1 = generateSecureInviteCode('VL/M');
    const invite2 = generateSecureInviteCode('VL/M');
    assert.match(invite1, /^VL\/M-[0-9A-F]{6}$/);
    assert.notEqual(invite1, invite2);
  });
});
