import { describe, expect, it } from 'vitest';
import {
  isPoisonPlaintext,
  isUsablePlaintext,
  mergeMessagePlaintext,
} from '../../src/utils/messagePlaintext';

describe('messagePlaintext', () => {
  it('treats placeholder sentinels as poison', () => {
    expect(isPoisonPlaintext('[Encrypted Message]')).toBe(true);
    expect(isPoisonPlaintext('[Decryption Error]')).toBe(true);
    expect(isUsablePlaintext('[Encrypted Message]')).toBe(false);
    expect(isUsablePlaintext('hello')).toBe(true);
  });

  it('never lets poison overwrite real plaintext', () => {
    expect(mergeMessagePlaintext('real text', '[Encrypted Message]')).toBe('real text');
    expect(mergeMessagePlaintext('[Encrypted Message]', 'real text')).toBe('real text');
    expect(mergeMessagePlaintext(undefined, '[Encrypted Message]')).toBeUndefined();
    expect(mergeMessagePlaintext(undefined, 'ok')).toBe('ok');
  });
});
