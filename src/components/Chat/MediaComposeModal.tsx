import React, { useEffect, useRef, useState } from 'react';
import { X, Crop } from 'lucide-react';
import { Attachment } from './hooks/useMessageInput';

export interface ComposeMediaItem extends Attachment {
  id: string;
  /** Original File when available — preferred for upload over blob:/data: URLs. */
  file?: File;
}

export interface MediaComposeModalProps {
  items: ComposeMediaItem[];
  onClose: () => void;
  onSend: (items: ComposeMediaItem[], caption: string) => void | Promise<void>;
  onCropItem: (itemId: string) => void;
  onUpdateItems: (items: ComposeMediaItem[]) => void;
  isSending?: boolean;
  uploadProgress?: number | null;
}

function isEditableStill(item: ComposeMediaItem): boolean {
  return (
    item.type.startsWith('image/') &&
    item.type !== 'image/gif' &&
    item.type !== 'image/svg+xml'
  );
}

function isVideoItem(item: ComposeMediaItem): boolean {
  return (
    item.type.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(item.name)
  );
}

const SWIPE_THRESHOLD_PX = 56;

export function MediaComposeModal({
  items,
  onClose,
  onSend,
  onCropItem,
  onUpdateItems,
  isSending = false,
  uploadProgress = null,
}: MediaComposeModalProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const [caption, setCaption] = useState('');
  const [stageFailed, setStageFailed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!items.some((i) => i.id === activeId)) {
      setActiveId(items[0]?.id ?? '');
    }
  }, [items, activeId]);

  useEffect(() => {
    setStageFailed(false);
  }, [activeId]);

  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));
  const active = items[activeIndex] ?? items[0];
  if (!active || items.length === 0) return null;

  const canCrop = isEditableStill(active);
  const count = items.length;
  const previewSrc = active.data || '';

  const goToIndex = (next: number) => {
    if (next < 0 || next >= items.length || isSending) return;
    setActiveId(items[next].id);
  };

  const goPrev = () => goToIndex(activeIndex - 1);
  const goNext = () => goToIndex(activeIndex + 1);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    if (count < 2 || isSending) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const removeActive = () => {
    const next = items.filter((i) => i.id !== active.id);
    if (next.length === 0) {
      onClose();
      return;
    }
    onUpdateItems(next);
    setActiveId(next[Math.min(activeIndex, next.length - 1)].id);
  };

  return (
    <div className="fixed inset-0 z-[980] flex flex-col bg-black select-none">
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/80 to-transparent">
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-40"
          aria-label="Close"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-1">
          {canCrop && (
            <button
              type="button"
              onClick={() => onCropItem(active.id)}
              disabled={isSending}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-40"
              aria-label="Crop"
              title="Crop"
            >
              <Crop className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-2 pt-14 pb-44 bg-black touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!previewSrc || stageFailed ? (
          <span className="text-sm text-white/50">Preview unavailable</span>
        ) : isVideoItem(active) ? (
          <video
            key={active.id}
            src={previewSrc}
            playsInline
            muted
            autoPlay
            loop
            controls={false}
            className="block w-full h-full max-h-full object-contain pointer-events-none"
            onError={() => setStageFailed(true)}
          />
        ) : (
          <img
            key={active.id}
            src={previewSrc}
            alt=""
            draggable={false}
            className="block w-full h-full max-h-full object-contain pointer-events-none"
            onError={() => setStageFailed(true)}
          />
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-black via-black/90 to-transparent space-y-3">
        {count > 1 && (
          <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none">
            {items.map((item, index) => {
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  disabled={isSending}
                  className={`relative shrink-0 w-[4.5rem] h-[5.5rem] rounded-[12px] overflow-hidden border-0 p-0 cursor-pointer transition ${
                    selected ? 'ring-2 ring-accent opacity-100' : 'opacity-70'
                  }`}
                  aria-label={`Media ${index + 1}`}
                >
                  {isVideoItem(item) ? (
                    <video
                      src={item.data}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <img src={item.data} alt="" className="w-full h-full object-cover" />
                  )}
                  <span className="absolute top-1 left-1 min-w-[16px] h-4 px-0.5 rounded-md bg-black/70 text-white text-[9px] font-bold leading-4 text-center">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={removeActive}
            disabled={isSending}
            className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 hover:bg-white/15 transition cursor-pointer disabled:opacity-40"
            title="Remove"
            aria-label="Remove"
          >
            <X className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isSending}
            placeholder="Add a caption..."
            className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 text-[15px] text-white outline-none placeholder:text-white/40 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={isSending}
            onClick={() => void onSend(items, caption.trim())}
            className="relative w-11 h-11 rounded-full bg-accent hover:bg-accent-hover text-velum-900 flex items-center justify-center shrink-0 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
            title={count > 1 ? `Send ${count}` : 'Send'}
            aria-label={count > 1 ? `Send ${count} media` : 'Send'}
          >
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
            {count > 1 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-velum-900 text-[10px] font-bold leading-[18px] text-center tabular-nums shadow-sm">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        </div>

        {isSending && (
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${Math.max(4, Math.min(100, uploadProgress ?? 8))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
