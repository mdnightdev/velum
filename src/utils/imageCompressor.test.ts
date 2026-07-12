import { describe, it, expect, vi } from 'vitest';
import { compressImage } from './imageCompressor';

describe('imageCompressor tests', () => {
  it('should scale dimensions and return compressed blob', async () => {
    const mockImg = {
      onload: null as any,
      width: 800,
      height: 600,
      set src(val: string) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    };
    const mockCtx = {
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toBlob: vi.fn((cb) => cb(new Blob(['mock-blob-data'], { type: 'image/jpeg' }))),
    };

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'canvas') return mockCanvas;
        return null;
      }),
    });

    const blob = await compressImage('data:image/png;base64,mock', 512, 0.85);
    expect(blob).toBeDefined();
    expect(blob.type).toBe('image/jpeg');
    expect(mockCanvas.width).toBe(512);
    expect(mockCanvas.height).toBe(384); // 600 * 512 / 800 = 384
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImg, 0, 0, 512, 384);
  });
});
