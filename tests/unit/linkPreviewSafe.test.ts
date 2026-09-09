import { describe, it, expect } from 'vitest';
import {
  sanitizePreviewText,
  sanitizePreviewImage,
  assertPublicHttpUrl,
  isBlockedIp,
} from '../../server/v2/utils/linkPreviewSafe';

describe('linkPreviewSafe (braintree + dompurify)', () => {
  it('strips markup via DOMPurify and caps length', () => {
    const t = sanitizePreviewText('<script>alert(1)</script>Hello&nbsp;world', 200);
    expect(t.toLowerCase()).not.toContain('script');
    expect(t).toMatch(/Hello/i);
    expect(sanitizePreviewText('x'.repeat(500), 200).length).toBe(200);
  });

  it('blocks private and local hosts after sanitize-url', () => {
    expect(() => assertPublicHttpUrl('javascript:alert(1)')).toThrow();
    expect(() => assertPublicHttpUrl('http://localhost/x')).toThrow();
    expect(() => assertPublicHttpUrl('http://127.0.0.1/x')).toThrow();
    expect(() => assertPublicHttpUrl('http://192.168.1.1/x')).toThrow();
    expect(assertPublicHttpUrl('https://example.com/a').hostname).toBe('example.com');
  });

  it('detects blocked IPs', () => {
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });

  it('only allows http(s) images resolved against page', () => {
    const page = new URL('https://news.example/article');
    expect(sanitizePreviewImage('/img/a.png', page)).toBe('https://news.example/img/a.png');
    expect(sanitizePreviewImage('javascript:alert(1)', page)).toBe('');
    expect(sanitizePreviewImage('http://127.0.0.1/x.png', page)).toBe('');
  });
});
