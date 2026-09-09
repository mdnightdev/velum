import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { sanitizeUrl } from '@braintree/sanitize-url';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;
const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 5000;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

const purify = createDOMPurify(
  new JSDOM('').window as unknown as Parameters<typeof createDOMPurify>[0]
);

export type SafeLinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
};

/** DOMPurify (text-only) + length cap. */
export function sanitizePreviewText(raw: string, maxLen: number): string {
  if (!raw) return '';
  const purified = purify.sanitize(String(raw), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  return String(purified)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v === '::1' || v === '0:0:0:0:0:0:0:1') return true;
  if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.includes('.')) {
    const parts = v.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  return false;
}

/**
 * @braintree/sanitize-url first, then http(s) + SSRF host/IP gates.
 */
export function assertPublicHttpUrl(raw: string): URL {
  const cleaned = sanitizeUrl(String(raw || '').trim());
  if (!cleaned || cleaned === 'about:blank') {
    throw new Error('INVALID_URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`);
  } catch {
    throw new Error('INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw new Error('INVALID_URL_AUTH');
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('BLOCKED_HOST');
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new Error('BLOCKED_IP');
  }
  return parsed;
}

export async function assertResolvesPublic(url: URL): Promise<void> {
  const host = url.hostname;
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error('BLOCKED_IP');
    return;
  }
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length) throw new Error('DNS_FAIL');
    for (const rec of records) {
      if (isBlockedIp(rec.address)) throw new Error('BLOCKED_IP');
    }
  } catch (err) {
    if ((err as Error).message === 'BLOCKED_IP') throw err;
    throw new Error('DNS_FAIL');
  }
}

/** Resolve og:image via sanitize-url + public http(s) only. */
export function sanitizePreviewImage(rawImage: string, pageUrl: URL): string {
  const raw = String(rawImage || '').trim();
  if (!raw) return '';
  let absolute: string;
  try {
    absolute = new URL(raw, pageUrl).toString();
  } catch {
    return '';
  }
  const cleaned = sanitizeUrl(absolute);
  if (!cleaned || cleaned === 'about:blank') return '';
  try {
    const imageUrl = assertPublicHttpUrl(cleaned);
    return imageUrl.toString().slice(0, 2048);
  } catch {
    return '';
  }
}

function getMetaTag(htmlText: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const match = htmlText.match(regex);
  if (match) return match[1];

  const altRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const altMatch = htmlText.match(altRegex);
  if (altMatch) return altMatch[1];

  return '';
}

function getTitle(htmlText: string): string {
  const match = htmlText.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1] : '';
}

export async function buildSafeLinkPreview(rawUrl: string): Promise<SafeLinkPreview> {
  const pageUrl = assertPublicHttpUrl(rawUrl);
  await assertResolvesPublic(pageUrl);
  const canonical = pageUrl.toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(canonical, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VelumPreview/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.url) {
    const finalUrl = assertPublicHttpUrl(response.url);
    await assertResolvesPublic(finalUrl);
  }

  if (!response.ok) {
    throw new Error(`FETCH_${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    return {
      url: canonical,
      title: pageUrl.hostname,
      description: '',
      image: '',
    };
  }

  const buf = Buffer.from(await response.arrayBuffer());
  const html = buf.subarray(0, MAX_HTML_BYTES).toString('utf8');

  const title = sanitizePreviewText(
    getMetaTag(html, 'og:title') || getTitle(html) || pageUrl.hostname,
    MAX_TITLE
  );
  const description = sanitizePreviewText(
    getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '',
    MAX_DESCRIPTION
  );
  const image = sanitizePreviewImage(getMetaTag(html, 'og:image') || '', pageUrl);

  return {
    url: canonical,
    title: title || pageUrl.hostname,
    description,
    image,
  };
}
