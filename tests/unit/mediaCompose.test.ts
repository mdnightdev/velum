import { describe, it, expect, vi } from 'vitest';
import {
  mapWithConcurrency,
  isComposeMediaFile,
  shouldOpenChatImageCropper,
} from '../../src/components/Chat/hooks/useAttachmentActions';
import { stripAttachmentTokens } from '../../src/utils/messageParser';

function fakeFile(type: string, name = 'x'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('media compose helpers', () => {
  it('classifies compose media vs docs', () => {
    expect(isComposeMediaFile(fakeFile('image/jpeg', 'a.jpg'))).toBe(true);
    expect(isComposeMediaFile(fakeFile('video/mp4', 'a.mp4'))).toBe(true);
    expect(isComposeMediaFile(fakeFile('application/pdf', 'a.pdf'))).toBe(false);
  });

  it('keeps crop eligibility for stills only', () => {
    expect(shouldOpenChatImageCropper(fakeFile('image/png'))).toBe(true);
    expect(shouldOpenChatImageCropper(fakeFile('image/gif'))).toBe(false);
    expect(shouldOpenChatImageCropper(fakeFile('video/mp4'))).toBe(false);
  });

  it('runs workers with bounded concurrency and preserves order', async () => {
    const active = { n: 0, max: 0 };
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      active.n += 1;
      active.max = Math.max(active.max, active.n);
      await new Promise((r) => setTimeout(r, 10));
      active.n -= 1;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(active.max).toBeLessThanOrEqual(2);
  });

  it('reports progress during concurrent map', async () => {
    const progress: Array<[number, number]> = [];
    await mapWithConcurrency([1, 2, 3], 2, async (n) => n, (done, total) => {
      progress.push([done, total]);
    });
    expect(progress.at(-1)).toEqual([3, 3]);
  });

  it('strips album attachment tokens leaving shared caption', () => {
    const content =
      '[Attachment: a.webp size:10 KB type:image/webp url:/u/a] [Attachment: b.webp size:11 KB type:image/webp url:/u/b] hello album';
    expect(stripAttachmentTokens(content)).toBe('hello album');
  });

  it('stages multi media into compose instead of auto-sending', async () => {
    const { useAttachmentActions } = await import('../../src/components/Chat/hooks/useAttachmentActions');
    const onOpenMediaCompose = vi.fn();
    const onSendMessage = vi.fn();
    const setSelectedAttachment = vi.fn();

    const originalFileReader = globalThis.FileReader;
    class MockFileReader {
      result: string | null = null;
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_file: Blob) {
        this.result = 'data:image/jpeg;base64,aaa';
        this.onload?.({ target: { result: this.result } });
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const actions = useAttachmentActions({
      setSelectedAttachment,
      onSendMessage,
      onOpenMediaCompose,
    });

    const f1 = fakeFile('image/jpeg', 'a.jpg');
    const f2 = fakeFile('image/jpeg', 'b.jpg');
    const input = {
      target: {
        files: [f1, f2],
        value: 'x',
      },
    } as unknown as Parameters<typeof actions.handleFileSelect>[0];

    await actions.handleFileSelect(input);

    expect(onOpenMediaCompose).toHaveBeenCalledTimes(1);
    expect(onOpenMediaCompose.mock.calls[0][0]).toHaveLength(2);
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(setSelectedAttachment).not.toHaveBeenCalled();

    vi.stubGlobal('FileReader', originalFileReader);
  });
});
