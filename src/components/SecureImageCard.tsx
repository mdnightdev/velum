import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Download, Maximize2, X } from 'lucide-react';
import { getFormattedDownloadFilename } from '../utils/mediaPipeline';

interface SecureImageCardProps {
  src: string;
  name?: string;
  size?: string;
  caption?: string;
  isMe?: boolean;
  timestamp?: string;
  containerClass?: string;
  children?: React.ReactNode;
  /** When true, do not set img src until the user taps Load. */
  manualLoad?: boolean;
  /** When false, hide the download control. */
  allowSave?: boolean;
}

const SecureImageCardInner: React.FC<SecureImageCardProps> = ({
  src,
  name,
  caption,
  containerClass,
  children,
  manualLoad = false,
  allowSave = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [loaded, setLoaded] = React.useState(!manualLoad);

  React.useEffect(() => {
    setLoaded(!manualLoad);
  }, [src, manualLoad]);

  const closeExpanded = React.useCallback((e?: React.SyntheticEvent | Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsExpanded(false);
  }, []);

  React.useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExpanded(e);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isExpanded, closeExpanded]);

  const handleDownload = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    link.download = getFormattedDownloadFilename(src, 'webp');
    link.click();
  };

  const lightbox =
    isExpanded && loaded && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-image-lightbox="true"
            className="fixed inset-0 z-[100000] flex flex-col bg-black select-none"
            onClick={closeExpanded}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div
              className="absolute top-0 inset-x-0 z-30 flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 to-transparent"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close"
                title="Close"
                className="p-2.5 bg-white/10 border border-white/15 rounded-full text-white hover:bg-white/15 transition cursor-pointer touch-manipulation"
                onPointerDown={closeExpanded}
                onClick={closeExpanded}
              >
                <X className="w-5 h-5 pointer-events-none" />
              </button>
            </div>
            <div
              className="relative flex-1 min-h-0 flex items-center justify-center p-4 z-10"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <img
                src={src}
                alt={name || 'Expanded'}
                className="max-w-full max-h-full object-contain"
                draggable={false}
                onClick={closeExpanded}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className={`relative overflow-hidden bg-black/80 group ${
          containerClass ||
          'w-full max-w-[280px] min-h-[180px] aspect-[4/3] rounded-2xl border border-accent/25'
        }`}
      >
        {loaded ? (
          <img
            src={src}
            alt={name || 'Image'}
            className="w-full h-full object-cover cursor-pointer block hover:opacity-95 transition-opacity"
            onClick={() => setIsExpanded(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <button
            type="button"
            className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2 bg-velum-800 text-text-secondary cursor-pointer border-0"
            onClick={() => setLoaded(true)}
          >
            <span className="text-sm text-white">Tap to load</span>
          </button>
        )}

        {loaded && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
            {allowSave && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
                title="Download"
              >
                <Download className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
              title="Expand"
            >
              <Maximize2 className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        )}

        {children && (
          <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-[var(--blur-backdrop-sm)] px-2 py-0.5 rounded-full flex items-center gap-1 text-[9.5px] font-sans text-white select-none z-10 border border-white/5">
            {children}
          </div>
        )}
      </div>

      {caption && (
        <div className="px-2.5 py-2 text-[13px] text-white whitespace-pre-wrap break-words">{caption}</div>
      )}

      {lightbox}
    </>
  );
};

export const SecureImageCard = memo(SecureImageCardInner, (prev, next) => {
  return (
    prev.src === next.src &&
    prev.caption === next.caption &&
    prev.name === next.name &&
    prev.containerClass === next.containerClass &&
    prev.isMe === next.isMe &&
    prev.manualLoad === next.manualLoad &&
    prev.allowSave === next.allowSave
  );
});
