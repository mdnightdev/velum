import { describe, it, expect } from 'vitest';
import {
  getCleanPreview,
  formatAttachmentAlbumPreview,
  parseAttachment,
} from '../../src/utils/messageParser';

describe('album chat-list preview', () => {
  it('labels all-video albums as N videos', () => {
    const content =
      '[Attachment: vid_a.mp4 size:1 MB type:video/mp4 url:/u/a] [Attachment: vid_b.mp4 size:1 MB type:video/mp4 url:/u/b] [Attachment: vid_c.mp4 size:1 MB type:video/mp4 url:/u/c]';
    expect(getCleanPreview(content)).toBe('3 videos');
  });

  it('labels all-photo albums as N photos', () => {
    const content =
      '[Attachment: img_a.webp size:10 KB type:image/webp url:/u/a] [Attachment: img_b.webp size:11 KB type:image/webp url:/u/b]';
    expect(getCleanPreview(content)).toBe('2 photos');
  });

  it('labels mixed albums as N media', () => {
    const content =
      '[Attachment: img_a.webp size:10 KB type:image/webp url:/u/a] [Attachment: vid_b.mp4 size:1 MB type:video/mp4 url:/u/b]';
    expect(getCleanPreview(content)).toBe('2 media');
  });

  it('appends shared caption after album label', () => {
    const content =
      '[Attachment: vid_a.mp4 size:1 MB type:video/mp4 url:/u/a] [Attachment: vid_b.mp4 size:1 MB type:video/mp4 url:/u/b] trip clips';
    expect(getCleanPreview(content)).toBe('2 videos: trip clips');
  });

  it('keeps singular Photo / Video labels', () => {
    expect(
      getCleanPreview('[Attachment: img_a.webp size:10 KB type:image/webp url:/u/a]')
    ).toBe('Photo');
    expect(
      getCleanPreview('[Attachment: vid_a.mp4 size:1 MB type:video/mp4 url:/u/a]')
    ).toBe('Video');
  });

  it('formatAttachmentAlbumPreview classifies from parsed payloads', () => {
    const atts = parseAttachment(
      '[Attachment: vid_a.mp4 size:1 MB type:video/mp4 url:/u/a] [Attachment: vid_b.mp4 size:1 MB type:video/mp4 url:/u/b]'
    );
    expect(formatAttachmentAlbumPreview(atts)).toBe('2 videos');
  });
});
