import { describe, expect, it } from 'vitest';
import {
  isPoisonPlaintext,
  isUsablePlaintext,
  mergeMessagePlaintext,
  getMessagePreviewPlaintext,
  getSidebarPreviewLabel,
  getNotificationBodyText,
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

  it('getMessagePreviewPlaintext skips ciphertext', () => {
    expect(getMessagePreviewPlaintext({ plaintext: 'ok', content: 'e2ee:x', is_encrypted: true })).toBe('ok');
    expect(getMessagePreviewPlaintext({ content: 'VEL_E2EE[x]', is_encrypted: true })).toBe('');
  });

  it('getSidebarPreviewLabel returns plaintext only — never a fake Message label', () => {
    expect(getSidebarPreviewLabel({ plaintext: 'hi there' })).toBe('hi there');
    expect(getSidebarPreviewLabel({ content: 'e2ee:abc', is_encrypted: true })).toBe('');
    expect(getSidebarPreviewLabel(null)).toBe('');
  });

  it('getNotificationBodyText never surfaces ciphertext or fake New message', () => {
    expect(getNotificationBodyText({ plaintext: 'hello' })).toBe('hello');
    expect(getNotificationBodyText({ content: 'e2ee:abc', isEncrypted: true })).toBe('');
    expect(getNotificationBodyText('VEL_E2EE[payload]')).toBe('');
    expect(getNotificationBodyText('Alice: e2ee:abc')).toBe('');
    expect(getNotificationBodyText('[Encrypted Message]')).toBe('');
    expect(getNotificationBodyText('clear text')).toBe('clear text');
    expect(getNotificationBodyText(undefined)).toBe('');
  });
});
