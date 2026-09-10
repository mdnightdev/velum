import React from 'react';
import {
  Paperclip,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ArrowLeft,
  X,
  Link2,
  FileText,
} from 'lucide-react';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import {
  ChatMediaItem,
  ChatMediaTab,
  countChatMediaTabs,
  filterChatMediaByTab,
} from '../../utils/chatMedia';

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
      <div className="absolute bottom-1 left-1 text-white pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4z" />
        </svg>
      </div>
      <div className="absolute bottom-1 right-1 text-[10px] text-white font-sans tabular-nums pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {formatMediaClock(duration)}
      </div>
    </div>
  );
}

const TABS: { id: ChatMediaTab; label: string }[] = [
  { id: 'media', label: 'Media' },
  { id: 'links', label: 'Links' },
  { id: 'docs', label: 'Docs' },
];

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
  const [activeTab, setActiveTab] = React.useState<ChatMediaTab>('media');
  const counts = React.useMemo(() => countChatMediaTabs(chatMedia), [chatMedia]);
  const tabItems = React.useMemo(
    () => filterChatMediaByTab(chatMedia, activeTab),
    [chatMedia, activeTab]
  );
  const stripItems = tabItems.slice(0, 12);
  const totalCount = chatMedia.length;

  const openItem = (item: ChatMediaItem) => {
    if (item.kind === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setViewerItem(item);
  };

  return (
    <>
      <div className="rounded-2xl bg-velum-850 border border-velum-600/50 p-4 space-y-3 shadow-lg">
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="w-full flex items-center justify-between cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          <span className="text-xs font-semibold text-text-primary">Shared</span>
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <span>{mediaLoading ? '…' : totalCount}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-velum-800/80">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-velum-700 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-text-disabled tabular-nums">{counts[tab.id]}</span>
            </button>
          ))}
        </div>

        {stripItems.length > 0 ? (
          <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none">
            {stripItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className="relative w-[4.5rem] h-[5.5rem] rounded-[12px] overflow-hidden bg-velum-750 border-0 shrink-0 cursor-pointer p-0"
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
                ) : item.kind === 'link' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary px-1">
                    <Link2 className="w-5 h-5 mb-0.5" />
                    <span className="text-[8px] truncate w-full text-center">{item.name}</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary px-1">
                    <FileText className="w-5 h-5 mb-0.5" />
                    <span className="text-[8px] truncate w-full text-center">{item.name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto py-1">
            <div className="w-[4.5rem] h-[5.5rem] rounded-[12px] bg-velum-750 border-0 flex flex-col items-center justify-center shrink-0 text-text-secondary">
              {mediaLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {activeTab === 'links' ? (
                    <Link2 className="w-5 h-5 mb-1" />
                  ) : activeTab === 'docs' ? (
                    <Paperclip className="w-5 h-5 mb-1" />
                  ) : (
                    <ImageIcon className="w-5 h-5 mb-1" />
                  )}
                  <span className="text-[9px]">None yet</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {viewerItem && viewerItem.kind !== 'link' && (
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
            <span className="text-sm font-semibold">Shared</span>
            <span className="text-xs text-text-secondary w-10 text-right">{totalCount}</span>
          </div>

          <div
            className="flex items-center gap-1 px-3 py-2 border-b border-velum-600 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-velum-750 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label} · {counts[tab.id]}
              </button>
            ))}
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 content-start"
            onClick={(e) => e.stopPropagation()}
          >
            {tabItems.length === 0 ? (
              <div className="py-16 text-center text-sm text-text-secondary">None yet</div>
            ) : activeTab === 'links' ? (
              <div className="space-y-1.5">
                {tabItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-velum-800 border border-velum-600/40 text-left cursor-pointer hover:bg-velum-750"
                  >
                    <Link2 className="w-4 h-4 text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-primary truncate">{item.name}</div>
                      <div className="text-[11px] text-text-secondary truncate">{item.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : activeTab === 'docs' ? (
              <div className="space-y-1.5">
                {tabItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-velum-800 border border-velum-600/40 text-left cursor-pointer hover:bg-velum-750"
                  >
                    <FileText className="w-4 h-4 text-text-secondary shrink-0" />
                    <span className="text-sm text-text-primary truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {tabItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="relative aspect-square rounded-lg overflow-hidden bg-velum-800 border border-velum-600/40 cursor-pointer"
                  >
                    {item.kind === 'video' ? (
                      <MediaStripVideoThumb url={resolveMediaUrl(item.url)} />
                    ) : (
                      <img
                        src={resolveMediaUrl(item.url)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
