import { parseAttachment } from '../utils/messageParser';

export type ChatMediaKind = 'image' | 'video' | 'doc';

export interface ChatMediaItem {
  id: string;
  kind: ChatMediaKind;
  url: string;
  name: string;
  messageId?: string;
}

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

/** Collect image/video/doc attachments from local chat messages (newest first). */
export function extractChatMediaFromMessages(
  messages: Array<{ content?: string; plaintext?: string; message_id?: string; id?: string | number; client_msg_id?: string }>,
  limit = 40
): ChatMediaItem[] {
  const items: ChatMediaItem[] = [];
  const seen = new Set<string>();

  for (let i = messages.length - 1; i >= 0 && items.length < limit; i--) {
    const msg = messages[i];
    const content = String(msg.plaintext || msg.content || '');
    if (!content.includes('[Attachment:')) continue;
    const attachments = parseAttachment(content);
    const msgId = String(msg.message_id || msg.id || msg.client_msg_id || i);

    for (let j = 0; j < attachments.length; j++) {
      const att = attachments[j];
      if (!att.data || seen.has(att.data)) continue;
      seen.add(att.data);

      let kind: ChatMediaKind = 'doc';
      if (isVideoAtt(att)) kind = 'video';
      else if (isImageAtt(att)) kind = 'image';

      items.push({
        id: `${msgId}_${j}`,
        kind,
        url: att.data,
        name: att.name || 'file',
        messageId: msgId,
      });
      if (items.length >= limit) break;
    }
  }

  return items;
}
