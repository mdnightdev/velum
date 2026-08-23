import React from 'react';
import { Download, Maximize2, X } from 'lucide-react';

interface SecureImageCardProps {
  src: string;
  name?: string;
  size?: string;
  caption?: string;
  isMe?: boolean;
  timestamp?: string;
  children?: React.ReactNode;
}

export const SecureImageCard: React.FC<SecureImageCardProps> = ({
  src,
  name,
  size,
  caption,
  isMe,
  timestamp,
  children
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = name || 'image';
    link.click();
  };

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden shadow-md w-full max-w-[280px] min-h-[180px] aspect-[4/3] bg-velum-800/80 group">
        {/* Image */}
        <img
          src={src}
          alt={name || 'Image'}
          className="w-full h-full object-cover cursor-pointer block hover:opacity-95 transition-opacity"
          onClick={() => setIsExpanded(true)}
          loading="lazy"
        />

        {/* Overlay Actions */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10">
          <button
            onClick={handleDownload}
            className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1.5 bg-black/60 hover:bg-black/85 rounded-lg text-white transition backdrop-blur-[var(--blur-backdrop-sm)] cursor-pointer border-0"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Floating Time & Status overlay in bottom-right corneri*/}
        {children && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/45 backdrop-blur-[var(--blur-backdrop-sm)] px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-mono text-white select-none z-10 border border-white/5">
            {children}
          </div>
        )}
      </div>

      {/* Caption text underneath the image inside the parent bubble (no card borders) */}
      {caption && (
        <div className="p-3 text-xs text-text-primary whitespace-pre-wrap break-words">
          {caption}
        </div>
      )}

      {/* Expanded Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center modal-backdrop p-4"
          onClick={() => setIsExpanded(false)}
        >
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-4 right-4 p-2 bg-velum-900/80 border border-white-10 rounded-full text-white hover:bg-velum-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={src}
            alt={name || 'Expanded'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
