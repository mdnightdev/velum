import React, { useState } from 'react';
import { Maximize2, Download, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface TelegramImageCardProps {
  src: string;
  name?: string;
  size?: string;
  caption?: string;
  isMe: boolean;
  timestamp?: string;
  children?: React.ReactNode;
}

export const TelegramImageCard: React.FC<TelegramImageCardProps> = ({
  src,
  name = 'Photo',
  size = '',
  caption = '',
  isMe,
  timestamp,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    link.download = name || 'photo.webp';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className={`group relative overflow-hidden rounded-2xl cursor-pointer max-w-xs sm:max-w-sm transition-transform active:scale-[0.99] border ${
          isMe ? 'bg-accent/10 border-accent/30' : 'bg-velum-800/90 border-white-10'
        }`}
      >
        {/* Image Container with aspect ratio control */}
        <div className="relative overflow-hidden bg-velum-900/60 max-h-80 flex items-center justify-center">
          <img
            src={src}
            alt={name}
            className="w-full h-auto object-cover rounded-2xl max-h-80 transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />

          {/* Hover overlay with zoom icon */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
            <div className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md">
              <Maximize2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Caption text if attached */}
        {caption && (
          <div className="p-2.5 text-xs text-text-primary leading-relaxed break-words">
            {caption}
          </div>
        )}

        {/* Footer timestamp and status overlay */}
        {children && (
          <div className="px-2.5 pb-1.5 flex items-center justify-end text-[10px] text-text-secondary font-mono">
            {children}
          </div>
        )}
      </div>

      {/* Full-screen Lightbox Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          {/* Top Bar Controls */}
          <div 
            className="w-full max-w-4xl flex items-center justify-between z-10 p-2 rounded-xl bg-velum-900/80 border border-white-10 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary truncate max-w-xs sm:max-w-md">{name}</span>
              {size && <span className="text-[10px] text-text-secondary font-mono">{size}</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                className="p-2 rounded-lg bg-white-5 hover:bg-white-10 text-text-secondary hover:text-white transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-2 rounded-lg bg-white-5 hover:bg-white-10 text-text-secondary hover:text-white transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-2 rounded-lg bg-white-5 hover:bg-white-10 text-text-secondary hover:text-white transition cursor-pointer"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleDownload}
                className="p-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent transition cursor-pointer"
                title="Download Photo"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg bg-white-5 hover:bg-white-10 text-text-secondary hover:text-white transition cursor-pointer ml-2"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Photo Viewer */}
          <div 
            className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={name}
              className="max-w-full max-h-[80vh] object-contain transition-transform duration-200 shadow-2xl rounded-lg"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`
              }}
            />
          </div>

          {/* Caption footer */}
          {caption && (
            <div 
              className="w-full max-w-2xl p-3 rounded-xl bg-velum-900/80 border border-white-10 backdrop-blur-md text-center text-sm text-text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {caption}
            </div>
          )}
        </div>
      )}
    </>
  );
};
