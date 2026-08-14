import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { RotateCcw, Check } from 'lucide-react';

export interface ImageCropperModalProps {
  imageSrc: string;
  fileName?: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | 'free';
  onCancel: () => void;
  onCropComplete: (croppedDataUrl: string, croppedFile: File) => void;
}

type Aspect = '1:1' | '4:3' | '16:9' | 'free';
interface Rect { x: number; y: number; w: number; h: number; }
type DragMode = { mode: 'pan' | 'resize'; handle?: string; startX: number; startY: number; startCrop: Rect; startPan: { x: number; y: number }; };

const ASPECT_RATIOS: Record<Aspect, number | null> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, free: null };
const OUTPUT_DIMS: Record<Aspect, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 }, '4:3': { w: 1200, h: 900 }, '16:9': { w: 1280, h: 720 }, free: { w: 1080, h: 1080 },
};
const MIN_CROP = 60;

export function ImageCropperModal({
  imageSrc, fileName = 'cropped-image.png', aspectRatio = '1:1', onCancel, onCropComplete,
}: ImageCropperModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragMode | null>(null);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
  const [rotatedSrc, setRotatedSrc] = useState(imageSrc);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [aspect, setAspect] = useState<Aspect>(aspectRatio);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (rotation === 0) { setRotatedSrc(imageSrc); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.naturalHeight : img.naturalWidth;
      canvas.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setRotatedSrc(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  }, [imageSrc, rotation]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!containerSize.w || !containerSize.h || !naturalSize.w) return;
    const ratio = ASPECT_RATIOS[aspect];
    let w = containerSize.w * 0.86;
    let h = containerSize.h * 0.86;
    if (ratio) {
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
    }
    setCrop({ x: (containerSize.w - w) / 2, y: (containerSize.h - h) / 2, w, h });
  }, [containerSize.w, containerSize.h, aspect, naturalSize.w]);

  const baseScale = naturalSize.w && containerSize.w
    ? Math.min(containerSize.w / naturalSize.w, containerSize.h / naturalSize.h)
    : 1;
  const scale = baseScale * zoom;
  const dispW = naturalSize.w * scale;
  const dispH = naturalSize.h * scale;
  const imgLeft = containerSize.w / 2 + pan.x - dispW / 2;
  const imgTop = containerSize.h / 2 + pan.y - dispH / 2;

  const clientToContainer = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startPan = (e: React.PointerEvent) => {
    const { x, y } = clientToContainer(e.clientX, e.clientY);
    dragRef.current = { mode: 'pan', startX: x, startY: y, startCrop: crop, startPan: pan };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startResize = (handle: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const { x, y } = clientToContainer(e.clientX, e.clientY);
    dragRef.current = { mode: 'resize', handle, startX: x, startY: y, startCrop: crop, startPan: pan };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const animFrameRef = useRef<number | null>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x: cx, y: cy } = clientToContainer(e.clientX, e.clientY);

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    animFrameRef.current = requestAnimationFrame(() => {
      if (!dragRef.current) return;
      if (drag.mode === 'pan') {
        setPan({ x: drag.startPan.x + (cx - drag.startX), y: drag.startPan.y + (cy - drag.startY) });
        return;
      }

      const ratio = ASPECT_RATIOS[aspect];
      const sc = drag.startCrop;
      const right = sc.x + sc.w;
      const bottom = sc.y + sc.h;
      let { x, y, w, h } = sc;

      switch (drag.handle) {
        case 'tl': {
          let nx = Math.max(0, Math.min(cx, right - MIN_CROP));
          let ny = Math.max(0, Math.min(cy, bottom - MIN_CROP));
          let nw = right - nx, nh = bottom - ny;
          if (ratio) { if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; nx = right - nw; ny = bottom - nh; }
          x = nx; y = ny; w = nw; h = nh; break;
        }
        case 'tr': {
          let nx2 = Math.min(containerSize.w, Math.max(cx, sc.x + MIN_CROP));
          let ny = Math.max(0, Math.min(cy, bottom - MIN_CROP));
          let nw = nx2 - sc.x, nh = bottom - ny;
          if (ratio) { if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; ny = bottom - nh; }
          x = sc.x; y = ny; w = nw; h = nh; break;
        }
        case 'bl': {
          let nx = Math.max(0, Math.min(cx, right - MIN_CROP));
          let ny2 = Math.min(containerSize.h, Math.max(cy, sc.y + MIN_CROP));
          let nw = right - nx, nh = ny2 - sc.y;
          if (ratio) { if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; nx = right - nw; }
          x = nx; y = sc.y; w = nw; h = nh; break;
        }
        case 'br': {
          let nx2 = Math.min(containerSize.w, Math.max(cx, sc.x + MIN_CROP));
          let ny2 = Math.min(containerSize.h, Math.max(cy, sc.y + MIN_CROP));
          let nw = nx2 - sc.x, nh = ny2 - sc.y;
          if (ratio) { if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; }
          x = sc.x; y = sc.y; w = nw; h = nh; break;
        }
        case 't': { let ny = Math.max(0, Math.min(cy, bottom - MIN_CROP)); y = ny; h = bottom - ny; x = sc.x; w = sc.w; break; }
        case 'b': { let ny2 = Math.min(containerSize.h, Math.max(cy, sc.y + MIN_CROP)); h = ny2 - sc.y; y = sc.y; x = sc.x; w = sc.w; break; }
        case 'l': { let nx = Math.max(0, Math.min(cx, right - MIN_CROP)); x = nx; w = right - nx; y = sc.y; h = sc.h; break; }
        case 'r': { let nx2 = Math.min(containerSize.w, Math.max(cx, sc.x + MIN_CROP)); w = nx2 - sc.x; x = sc.x; y = sc.y; h = sc.h; break; }
      }
      setCrop({ x, y, w, h });
    });
  };

  const handlePointerUp = () => { 
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    dragRef.current = null; 
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0012)));
  };

  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img || !naturalSize.w) return;

    let sx = (crop.x - imgLeft) / scale;
    let sy = (crop.y - imgTop) / scale;
    let sw = crop.w / scale;
    let sh = crop.h / scale;

    sx = Math.max(0, Math.min(sx, naturalSize.w));
    sy = Math.max(0, Math.min(sy, naturalSize.h));
    sw = Math.min(sw, naturalSize.w - sx);
    sh = Math.min(sh, naturalSize.h - sy);

    let targetWidth: number, targetHeight: number;
    if (aspect === 'free') {
      const maxDim = 1400;
      if (sw >= sh) { targetWidth = maxDim; targetHeight = Math.round(maxDim * (sh / sw)); }
      else { targetHeight = maxDim; targetWidth = Math.round(maxDim * (sw / sh)); }
    } else {
      ({ w: targetWidth, h: targetHeight } = OUTPUT_DIMS[aspect]);
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

    const croppedDataUrl = outputCanvas.toDataURL('image/png');
    const arr = croppedDataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    onCropComplete(croppedDataUrl, new File([u8arr], fileName, { type: mime }));
  };

  const corners = [
    { id: 'tl', x: crop.x, y: crop.y, cls: 'border-t-[3px] border-l-[3px]' },
    { id: 'tr', x: crop.x + crop.w, y: crop.y, cls: 'border-t-[3px] border-r-[3px]' },
    { id: 'bl', x: crop.x, y: crop.y + crop.h, cls: 'border-b-[3px] border-l-[3px]' },
    { id: 'br', x: crop.x + crop.w, y: crop.y + crop.h, cls: 'border-b-[3px] border-r-[3px]' },
  ];
  const edges = aspect === 'free' ? [
    { id: 't', x: crop.x + crop.w / 2, y: crop.y, w: 28, h: 3 },
    { id: 'b', x: crop.x + crop.w / 2, y: crop.y + crop.h, w: 28, h: 3 },
    { id: 'l', x: crop.x, y: crop.y + crop.h / 2, w: 3, h: 28 },
    { id: 'r', x: crop.x + crop.w, y: crop.y + crop.h / 2, w: 3, h: 28 },
  ] : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black select-none">
      <div className="w-full h-full max-w-lg max-h-[100dvh] flex flex-col">
        {/* Crop stage — fills nearly the whole screen, no header bar at all */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-black overflow-hidden touch-none"
          onWheel={handleWheel}
        >
          {naturalSize.w > 0 && (
            <img
              ref={imgRef}
              src={rotatedSrc}
              alt=""
              draggable={false}
              onPointerDown={startPan}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onLoad={handleImgLoad}
              className="absolute cursor-grab active:cursor-grabbing will-change-transform"
              style={{ width: dispW, height: dispH, left: imgLeft, top: imgTop, transform: 'translate3d(0,0,0)' }}
            />
          )}
          {!naturalSize.w && (
            <img src={rotatedSrc} alt="" onLoad={handleImgLoad} className="hidden" ref={imgRef} />
          )}

          {/* Darkened mask outside crop box */}
          <div
            className="absolute pointer-events-none border border-white/40 will-change-transform"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)' }}
          >
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`border-white/70 ${i % 3 !== 2 ? 'border-r' : ''} ${i < 6 ? 'border-b' : ''}`} />
              ))}
            </div>
          </div>

          {/* Corner brackets */}
          {corners.map((c) => (
            <div
              key={c.id}
              onPointerDown={startResize(c.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
              style={{ left: c.x, top: c.y }}
            >
              <div className={`w-6 h-6 ${c.cls} border-white`} />
            </div>
          ))}

          {/* Edge tick handles (free aspect only) */}
          {edges.map((h) => (
            <div
              key={h.id}
              onPointerDown={startResize(h.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
              style={{ left: h.x, top: h.y, width: 32, height: 32 }}
            >
              <div className="bg-white rounded-sm" style={{ width: h.w, height: h.h }} />
            </div>
          ))}

          {/* Cancel — floats top-left directly on the image */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 left-3 text-white text-[15px] font-normal px-2 py-1 cursor-pointer"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            Cancel
          </button>

          {/* Done — floats top-right directly on the image */}
          <button
            type="button"
            onClick={handleApplyCrop}
            className="absolute top-3 right-3 text-[15px] font-semibold px-2 py-1 cursor-pointer"
            style={{ color: '#34d399', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            Done
          </button>
        </div>

        {/* Bottom strip — clean rotate action */}
        <div className="flex items-center justify-center px-5 py-4">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="text-white/80 hover:text-white transition cursor-pointer p-2 rounded-full hover:bg-white/10 flex items-center gap-2 text-xs font-mono"
            title="Rotate 90°"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rotate</span>
          </button>
        </div>
      </div>
    </div>
  );
}