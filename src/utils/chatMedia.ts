import { parseAttachment } from '../utils/messageParser';

export type ChatMediaKind = 'image' | 'video' | 'doc' | 'link';

export type ChatMediaTab = 'media' | 'links' | 'docs';

export interface ChatMediaItem {
  id: string;
  kind: ChatMediaKind;
  url: string;
  name: string;
  messageId?: string;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

function isVideoAtt(att: { type?: string; name?: string; data?: string }): boolean {
  return (
    !!att.type?.startsWith('video/') ||
    !!att.name?.startsWith('vid_') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name || '') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data || '')
  );
}

function isImageAtt(att: { type?: string; name?: string; data?: string }): boolean {
  if (isVideoAtt(att)) return false;
  return (
    !!att.type?.startsWith('image/') ||
    !!att.name?.startsWith('img_') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name || '') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data || '') ||
    (!!att.data?.includes('/uploads/') &&
      !/\.(webm|ogg|mp3|m4a|wav|mp4|mov|pdf|doc|docx|zip)($|\?)/i.test(att.data || ''))
  );
}

/** Strip attachment tokens so URL extraction does not pick upload paths inside them. */
function stripAttachmentTokens(content: string): string {
  return content.replace(/\[Attachment:[^\]]*\]/gi, ' ');
}

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 48);
  }
}

function normalizeUrl(raw: string): string {
  return raw.replace(/[.,;:!?)]+$/g, '');
}

/**
 * Collect media / links / docs from local chat messages (newest first).
 * `limit` caps total items across all kinds (0 = no cap).
 */
/** Collect media / links / docs from local chat messages (newest first). */
export function extractChatMediaFromMessages(
  messages: Array<{
    content?: string;
    plaintext?: string;
    body?: string;
    client_plaintext?: string;
    message_id?: string;
    id?: string | number;
    client_msg_id?: string;
  }>,
  limit = 0
): ChatMediaItem[] {
  const items: ChatMediaItem[] = [];
  const seen = new Set<string>();
  const capped = limit > 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (capped && items.length >= limit) break;
    const msg = messages[i];
    const content = String(
      msg.plaintext || msg.client_plaintext || msg.content || msg.body || ''
    );
    // Skip pure ciphertext envelopes — no usable attachment tokens
    if (
      content.startsWith('e2ee:') ||
      content.startsWith('ratchet:') ||
      content.startsWith('VEL_E2EE[')
    ) {
      continue;
    }
    const msgId = String(msg.message_id || msg.id || msg.client_msg_id || i);

    if (content.includes('[Attachment:')) {
      const attachments = parseAttachment(content);
      for (let j = 0; j < attachments.length; j++) {
        if (capped && items.length >= limit) break;
        const att = attachments[j];
        if (!att.data || seen.has(att.data)) continue;
        seen.add(att.data);

        let kind: ChatMediaKind = 'doc';
        if (isVideoAtt(att)) kind = 'video';
        else if (isImageAtt(att)) kind = 'image';

        items.push({
          id: `${msgId}_att_${j}`,
          kind,
          url: att.data,
          name: att.name || 'file',
          messageId: msgId,
        });
      }
    }

    // Fallback: bare upload media URLs (when Attachment token failed to parse)
    const uploadMatches = content.match(/(?:https?:\/\/[^\s\]"']+)?\/uploads\/[^\s\]"']+/gi) || [];
    for (let j = 0; j < uploadMatches.length; j++) {
      if (capped && items.length >= limit) break;
      const url = normalizeUrl(uploadMatches[j]);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      let kind: ChatMediaKind = 'doc';
      if (/\.(mp4|webm|mov|mkv|m4v)($|\?)/i.test(url)) kind = 'video';
      else if (/\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url) || /\/uploads\/media\//i.test(url))
        kind = 'image';
      items.push({
        id: `${msgId}_up_${j}`,
        kind,
        url,
        name: url.split('/').pop()?.split('?')[0] || 'file',
        messageId: msgId,
      });
    }

    const plain = stripAttachmentTokens(content);
    const matches = plain.match(URL_RE) || [];
    for (let j = 0; j < matches.length; j++) {
      if (capped && items.length >= limit) break;
      const url = normalizeUrl(matches[j]);
      if (!url || seen.has(url)) continue;
      if (url.includes('/uploads/')) continue;
      seen.add(url);
      items.push({
        id: `${msgId}_link_${j}`,
        kind: 'link',
        url,
        name: hostnameLabel(url),
        messageId: msgId,
      });
    }
  }

  return items;
}

export function filterChatMediaByTab(items: ChatMediaItem[], tab: ChatMediaTab): ChatMediaItem[] {
  if (tab === 'media') return items.filter((i) => i.kind === 'image' || i.kind === 'video');
  if (tab === 'links') return items.filter((i) => i.kind === 'link');
  return items.filter((i) => i.kind === 'doc');
}

export function countChatMediaTabs(items: ChatMediaItem[]): Record<ChatMediaTab, number> {
  return {
    media: items.filter((i) => i.kind === 'image' || i.kind === 'video').length,
    links: items.filter((i) => i.kind === 'link').length,
    docs: items.filter((i) => i.kind === 'doc').length,
  };
}
