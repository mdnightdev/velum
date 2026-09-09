import { describe, it, expect } from 'vitest';
import { shouldOpenChatImageCropper } from '../../src/components/Chat/hooks/useAttachmentActions';

function fakeFile(type: string, name = 'x'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('shouldOpenChatImageCropper', () => {
  it('opens for jpeg/png/webp stills', () => {
    expect(shouldOpenChatImageCropper(fakeFile('image/jpeg', 'a.jpg'))).toBe(true);
    expect(shouldOpenChatImageCropper(fakeFile('image/png', 'a.png'))).toBe(true);
    expect(shouldOpenChatImageCropper(fakeFile('image/webp', 'a.webp'))).toBe(true);
  });

  it('skips gif, svg, video, and docs', () => {
    expect(shouldOpenChatImageCropper(fakeFile('image/gif', 'a.gif'))).toBe(false);
    expect(shouldOpenChatImageCropper(fakeFile('image/svg+xml', 'a.svg'))).toBe(false);
    expect(shouldOpenChatImageCropper(fakeFile('video/mp4', 'a.mp4'))).toBe(false);
    expect(shouldOpenChatImageCropper(fakeFile('application/pdf', 'a.pdf'))).toBe(false);
  });
});
