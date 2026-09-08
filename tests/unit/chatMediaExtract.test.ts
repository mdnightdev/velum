import { describe, it, expect } from 'vitest';
import { extractChatMediaFromMessages } from '../../src/utils/chatMedia';

describe('extractChatMediaFromMessages', () => {
  it('collects images and videos newest-first and dedupes urls', () => {
    const messages = [
      {
        id: 1,
        content: '[Attachment: img_a.webp size:1 KB type:image/webp url:/u/a]',
      },
      {
        id: 2,
        content:
          '[Attachment: vid_b.mp4 size:1 MB type:video/mp4 url:/u/b] [Attachment: img_a.webp size:1 KB type:image/webp url:/u/a]',
      },
    ];
    const items = extractChatMediaFromMessages(messages);
    expect(items.map((i) => i.url)).toEqual(['/u/b', '/u/a']);
    expect(items[0].kind).toBe('video');
    expect(items[1].kind).toBe('image');
  });

  it('returns empty for messages without attachments', () => {
    expect(extractChatMediaFromMessages([{ id: 1, content: 'hello' }])).toEqual([]);
  });
});
