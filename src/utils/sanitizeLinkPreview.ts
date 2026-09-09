import { sanitizeUrl } from '@braintree/sanitize-url';
import DOMPurify from 'dompurify';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;

/** Braintree + http(s)-only gate for preview / image URLs. */
export function sanitizeHttpUrl(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim().replace(/[.,;:!?)]+$/g, '');
  const cleaned = sanitizeUrl(trimmed);
  if (!cleaned || cleaned === 'about:blank') return '';
  try {
    const u = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.username || u.password) return '';
    const host = u.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0'
    ) {
      return '';
    }
    return u.toString();
  } catch {
    return '';
  }
}

/** DOMPurify text-only sanitize + length cap (browser). */
export function sanitizePreviewPlaintext(raw: string, maxLen: number): string {
  if (!raw) return '';
  const purified = DOMPurify.sanitize(String(raw), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  return purified.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function sanitizePreviewFields(input: {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
}): { url: string; title: string; description?: string; image?: string } {
  const url = sanitizeHttpUrl(input.url);
  const title = sanitizePreviewPlaintext(input.title || '', MAX_TITLE);
  const description = sanitizePreviewPlaintext(input.description || '', MAX_DESCRIPTION);
  const image = sanitizeHttpUrl(input.image);
  return {
    url,
    title,
    description: description || undefined,
    image: image || undefined,
  };
}
