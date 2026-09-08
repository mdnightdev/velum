import React from 'react';
import { Paperclip, Image as ImageIcon, Loader2, ChevronRight, ArrowLeft, X } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { ChatMediaItem } from '../../utils/chatMedia';

function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MediaStripVideoThumb({ url }: { url: string }) {
  const [duration, setDuration] = React.useState(0);
  return (
    <div className="relative w-full h-full bg-black">
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover pointer-events-none"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-7 h-7 rounded-full bg-black/55 border border-white/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/60 text-[9px] text-white font-mono tabular-nums pointer-events-none">
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span>{formatMediaClock(duration)}</span>
      </div>
    </div>
  );
}

type ChatMediaSectionProps = {
  chatMedia: ChatMediaItem[];
  mediaLoading: boolean;
  viewerItem: ChatMediaItem | null;
  setViewerItem: (item: ChatMediaItem | null) => void;
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
};

export default function ChatMediaSection({
  chatMedia,
  mediaLoading,
  viewerItem,
  setViewerItem,
  galleryOpen,
  setGalleryOpen,
}: ChatMediaSectionProps) {
  return (
    <>
      <div className="rounded-2xl bg-velum-850 border border-velum-600/50 p-4 space-y-3 shadow-lg">
        <button
          type="button"
          onClick={() => {
            if (chatMedia.length > 0) setGalleryOpen(true);
          }}
          className="w-full flex items-center justify-between cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          <span className="text-xs font-semibold text-text-primary">Media, links, and docs</span>
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <span>{mediaLoading ? '…' : chatMedia.length}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
        {chatMedia.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {chatMedia.slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewerItem(item)}
                className="relative w-16 h-16 rounded-xl overflow-hidden bg-velum-750 border border-velum-600/50 shrink-0 cursor-pointer active:scale-95 transition"
                title={item.name}
              >
                {item.kind === 'video' ? (
                  <MediaStripVideoThumb url={resolveMediaUrl(item.url)} />
                ) : item.kind === 'image' ? (
                  <img
                    src={resolveMediaUrl(item.url)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary px-1">
                    <Paperclip className="w-5 h-5 mb-0.5" />
                    <span className="text-[8px] truncate w-full text-center">{item.name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <div className="w-16 h-16 rounded-xl bg-velum-750 border border-velum-600/50 flex flex-col items-center justify-center shrink-0 text-text-secondary">
              {mediaLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span className="text-[9px]">None yet</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {viewerItem && (
        <div
          className="fixed inset-0 z-[1000001] flex flex-col bg-black select-none"
          onClick={() => setViewerItem(null)}
        >
          <div className="absolute top-0 inset-x-0 z-10 flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 to-transparent">
            <button
              type="button"
              onClick={() => setViewerItem(null)}
              className="p-2.5 bg-white/10 border border-white/15 rounded-full text-white hover:bg-white/15 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="flex-1 min-h-0 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {viewerItem.kind === 'video' ? (
              <video
                src={resolveMediaUrl(viewerItem.url)}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full object-contain"
              />
            ) : viewerItem.kind === 'image' ? (
              <img
                src={resolveMediaUrl(viewerItem.url)}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <a
                href={resolveMediaUrl(viewerItem.url)}
                download={viewerItem.name}
                className="text-accent text-sm underline"
              >
                Download {viewerItem.name}
              </a>
            )}
          </div>
        </div>
      )}

      {galleryOpen && (
        <div
          className="fixed inset-0 z-[1000000] flex flex-col bg-velum-900 text-white animate-fadeIn"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="flex items-center justify-between p-4 border-b border-velum-600 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              className="p-2.5 rounded-full border border-white-10 text-text-primary hover:bg-white-5 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold">Media, links, and docs</span>
            <span className="text-xs text-text-secondary w-10 text-right">{chatMedia.length}</span>
          </div>
          <div
            className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-1.5 content-start"
            onClick={(e) => e.stopPropagation()}
          >
            {chatMedia.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewerItem(item)}
                className="relative aspect-square rounded-lg overflow-hidden bg-velum-800 border border-velum-600/40 cursor-pointer"
              >
                {item.kind === 'video' ? (
                  <MediaStripVideoThumb url={resolveMediaUrl(item.url)} />
                ) : item.kind === 'image' ? (
                  <img src={resolveMediaUrl(item.url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary px-2">
                    <Paperclip className="w-6 h-6 mb-1" />
                    <span className="text-[9px] truncate w-full text-center">{item.name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
