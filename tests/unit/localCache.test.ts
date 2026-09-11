import { describe, it, expect } from 'vitest';
import {
  pickIdsToTrimByAgeAndCount,
  pickMediaIdsToTrim,
} from '../../src/utils/localCacheMaintenance';
import { getMessagePreviewPlaintext } from '../../src/utils/messagePlaintext';

describe('localCacheMaintenance trim helpers', () => {
  const now = Date.parse('2020-06-01T00:00:00.000Z');

  it('drops aged messages then excess oldest', () => {
    const day = 24 * 60 * 60 * 1000;
    const records = [
      { id: 'old', createdAt: now - 40 * day },
      { id: 'a', createdAt: now - 2 * day },
      { id: 'b', createdAt: now - 1 * day },
      { id: 'c', createdAt: now - 0.5 * day },
    ];
    const ids = pickIdsToTrimByAgeAndCount(records, now, 30 * day, 2);
    expect(ids).toContain('old');
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('c');
  });

  it('evicts oldest media until under byte budget', () => {
    const day = 24 * 60 * 60 * 1000;
    const records = [
      { id: 'm1', createdAt: now - 1 * day, sizeBytes: 40 },
      { id: 'm2', createdAt: now - 2 * day, sizeBytes: 40 },
      { id: 'm3', createdAt: now - 3 * day, sizeBytes: 40 },
    ];
    const ids = pickMediaIdsToTrim(records, now, 14 * day, 50);
    expect(ids).toContain('m3');
    expect(ids).toContain('m2');
    expect(ids).not.toContain('m1');
  });
});

describe('getMessagePreviewPlaintext', () => {
  it('prefers plaintext and hides envelopes', () => {
    expect(getMessagePreviewPlaintext({ plaintext: 'hi', content: 'e2ee:v1:x', is_encrypted: true })).toBe('hi');
    expect(getMessagePreviewPlaintext({ content: 'e2ee:v1:x', is_encrypted: true })).toBe('');
    expect(getMessagePreviewPlaintext({ content: 'hello', is_encrypted: false })).toBe('hello');
  });
});
