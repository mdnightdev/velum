import React, { useEffect, useState, memo } from 'react';
import { getSessionId } from '../../utils/auth';
import { sanitizeHttpUrl, sanitizePreviewFields } from '../../utils/sanitizeLinkPreview';

export interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

interface LinkPreviewCardProps {
  url: string;
}

/** Module cache — survives remounts so status ticks do not re-fetch / flash. */
const previewCache = new Map<string, LinkPreviewData | 'failed'>();
const inflight = new Map<string, Promise<LinkPreviewData | null>>();

async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  const cached = previewCache.get(url);
  if (cached === 'failed') return null;
  if (cached) return cached;

  const existing = inflight.get(url);
  if (existing) return existing;

  const req = (async () => {
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/link-preview?url=${encodeURIComponent(url)}`, {
        headers: sId ? { Authorization: `Bearer ${sId}` } : {},
      });
      if (!res.ok) {
        previewCache.set(url, 'failed');
        return null;
      }
      const json = (await res.json()) as LinkPreviewData;
      const data = sanitizePreviewFields({
        url: json.url || url,
        title: json.title,
        description: json.description,
        image: json.image,
      });
      if (!data.url || (!data.title && !data.image)) {
        previewCache.set(url, 'failed');
        return null;
      }
      previewCache.set(url, data);
      return data;
    } catch {
      previewCache.set(url, 'failed');
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, req);
  return req;
}

function LinkPreviewCardInner({ url }: LinkPreviewCardProps) {
  const normalized = sanitizeHttpUrl(url);
  const cached = normalized ? previewCache.get(normalized) : undefined;
  const [data, setData] = useState<LinkPreviewData | null>(
    cached && cached !== 'failed' ? cached : null
  );
  const [loading, setLoading] = useState(!cached && !!normalized);
  const [failed, setFailed] = useState(cached === 'failed' || !normalized);

  useEffect(() => {
    if (!normalized) {
      setFailed(true);
      setLoading(false);
      return;
    }

    const hit = previewCache.get(normalized);
    if (hit === 'failed') {
      setFailed(true);
      setLoading(false);
      setData(null);
      return;
    }
    if (hit) {
      setData(hit);
      setFailed(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setFailed(false);
    fetchLinkPreview(normalized).then((result) => {
      if (!active) return;
      if (result) {
        setData(result);
        setFailed(false);
      } else {
        setData(null);
        setFailed(true);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [normalized]);

  if (failed || !normalized) return null;

  if (loading && !data) {
    return (
      <div className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-white-5/20 p-3 animate-pulse flex flex-col gap-2">
        <div className="w-full h-32 bg-white-5 rounded-lg" />
        <div className="h-4 bg-white-10 rounded w-3/4" />
        <div className="h-3 bg-white-5 rounded w-5/6" />
      </div>
    );
  }

  if (!data) return null;

  const href = sanitizeHttpUrl(data.url) || normalized;
  const imageSrc = sanitizeHttpUrl(data.image);
  let hostname = '';
  try {
    hostname = new URL(href).hostname;
  } catch {
    hostname = 'link';
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-velum-900/40 hover:bg-velum-900/60 hover:border-accent/30 transition duration-200 block overflow-hidden text-left select-none group shadow-lg cursor-pointer"
    >
      {imageSrc ? (
        <div className="w-full h-36 overflow-hidden bg-black/20 border-b border-white-5 relative">
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : null}
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[9px] font-mono text-accent uppercase tracking-wider font-bold">
          {hostname}
        </span>
        <h4 className="text-[12px] font-bold text-white leading-snug line-clamp-2">{data.title}</h4>
        {data.description ? (
          <p className="text-[10.5px] text-text-secondary leading-normal line-clamp-2">
            {data.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}

export const LinkPreviewCard = memo(LinkPreviewCardInner, (a, b) => a.url === b.url);

export function extractMessageUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const found = text.match(urlRegex) || [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const n = sanitizeHttpUrl(raw);
    if (!n || seen.has(n) || n.includes('/uploads/')) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
