import React, { useState, useEffect } from 'react';
import { getSessionId } from '../../utils/auth';

interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

interface LinkPreviewCardProps {
  url: string;
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const sId = getSessionId();
        const res = await fetch(`/v2/lounges/link-preview?url=${encodeURIComponent(url)}`, {
          headers: { 'Authorization': `Bearer ${sId}` }
        });
        if (!res.ok) throw new Error('Preview fetch failed');
        const json = await res.json();
        if (active) {
          setData(json);
          if (!json.title && !json.image) {
            setFailed(true);
          }
        }
      } catch (e) {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPreview();
    return () => {
      active = false;
    };
  }, [url]);

  if (failed) return null;

  if (loading) {
    return (
      <div className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-white-5/20 p-3 animate-pulse flex flex-col gap-2">
        <div className="w-full h-32 bg-white-5 rounded-lg" />
        <div className="h-4 bg-white-10 rounded w-3/4" />
        <div className="h-3 bg-white-5 rounded w-5/6" />
      </div>
    );
  }

  if (!data) return null;

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = 'link';
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2.5 max-w-sm rounded-xl border border-white-5 bg-velum-900/40 hover:bg-velum-900/60 hover:border-accent/30 transition duration-200 block overflow-hidden text-left select-none group shadow-lg cursor-pointer"
    >
      {data.image && (
        <div className="w-full h-36 overflow-hidden bg-black/20 border-b border-white-5 relative">
          <img 
            src={data.image} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[9px] font-mono text-accent uppercase tracking-wider font-bold">
          {hostname}
        </span>
        <h4 className="text-[12px] font-bold text-white leading-snug line-clamp-2">
          {data.title}
        </h4>
        {data.description && (
          <p className="text-[10.5px] text-text-secondary leading-normal line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
