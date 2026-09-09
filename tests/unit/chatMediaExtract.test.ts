import { describe, it, expect } from 'vitest';
import {
  extractChatMediaFromMessages,
  filterChatMediaByTab,
  countChatMediaTabs,
} from '../../src/utils/chatMedia';

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

  it('extracts links from plaintext and skips attachment tokens', () => {
    const messages = [
      {
        id: 1,
        content: 'check https://example.com/path and see',
      },
      {
        id: 2,
        content: '[Attachment: img_x.webp size:1 KB type:image/webp url:https://cdn.example/uploads/x.webp] also https://velum.app',
      },
    ];
    const items = extractChatMediaFromMessages(messages);
    const links = filterChatMediaByTab(items, 'links');
    expect(links.map((l) => l.url).sort()).toEqual(
      ['https://example.com/path', 'https://velum.app'].sort()
    );
    expect(links.every((l) => l.kind === 'link')).toBe(true);
    expect(filterChatMediaByTab(items, 'media').length).toBe(1);
  });

  it('returns empty for plain text without urls', () => {
    expect(extractChatMediaFromMessages([{ id: 1, content: 'hello' }])).toEqual([]);
  });

  it('counts tabs correctly', () => {
    const items = extractChatMediaFromMessages([
      { id: 1, content: '[Attachment: img_a.webp size:1 KB type:image/webp url:/u/a]' },
      { id: 2, content: '[Attachment: notes.pdf size:2 KB type:application/pdf url:/u/doc]' },
      { id: 3, content: 'https://a.example' },
    ]);
    expect(countChatMediaTabs(items)).toEqual({ media: 1, links: 1, docs: 1 });
  });
});
