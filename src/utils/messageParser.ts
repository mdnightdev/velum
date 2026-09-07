export interface AttachmentPayload {
  name: string;
  size: string;
  type: string;
  data: string;
  caption: string;
}

export interface VoiceNotePayload {
  duration: number;
  url: string;
}

export function parseAttachment(content: string): AttachmentPayload[] {
  if (!content || !content.includes('[Attachment:')) return [];

  const results: AttachmentPayload[] = [];
  const regex = /\[Attachment:\s*(.*?)\s+size:(.*?)\s+type:(.*?)\s+(data|url):(.*?)(?:\](?:\s*(.*?))?(?=\[Attachment:|$)|\])/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    let rawVal = match[5] ? match[5].trim() : '';
    if (rawVal.endsWith(']')) rawVal = rawVal.slice(0, -1).trim();

    if (match[4] === 'data' || rawVal.startsWith('data:')) {
      continue;
    }

    let parsedType = match[3].trim();
    const parsedName = match[1].trim();
    const ext = parsedName.toLowerCase().split('.').pop() || '';
    if (!parsedType || !parsedType.startsWith('image/')) {
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || /\.(jpg|jpeg|png|webp|gif)$/i.test(rawVal)) {
        parsedType = 'image/' + (ext || 'jpeg');
      }
    }

    results.push({
      name: parsedName,
      size: match[2].trim(),
      type: parsedType,
      data: rawVal,
      caption: match[6] ? match[6].trim() : ''
    });
  }

  return results;
}

export function parseVoiceNote(content: string): VoiceNotePayload | null {
  if (!content || !content.startsWith('[Voice Note')) return null;

  let url = '';
  let duration = 0;

  const durationMatch = content.match(/duration:([\d.]+)/);
  if (durationMatch) {
    duration = parseFloat(durationMatch[1]) || 0;
  }

  const urlMatch = content.match(/url:([^\s\]]+)/);
  if (urlMatch) {
    url = urlMatch[1];
  } else {
    // Enforce URL storage only, reject inline base64 data payloads
    return null;
  }

  return { duration, url };
}

export function formatVoiceNotePreview(content: string): string {
  const durationMatch = content.match(/duration:([\d.]+)/);
  if (durationMatch) {
    const totalSecs = Math.round(parseFloat(durationMatch[1]));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    return `Voice message (${timeStr})`;
  }
  return 'Voice message';
}

export function stripAttachmentTokens(content: string): string {
  if (!content) return '';
  return content
    .replace(/\[Attachment:\s*.*?\]/g, '')
    .replace(/\[Voice Note\s*.*?\]/g, '')
    .trim();
}

export function getCleanPreview(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('e2ee:') || trimmed.startsWith('ratchet:v2:') || trimmed.startsWith('ratchet:v1:') || trimmed.startsWith('VEL_E2EE[')) {
    return 'Encrypted Message';
  }
  if (trimmed.startsWith('[Voice Note')) {
    return formatVoiceNotePreview(trimmed);
  }
  if (trimmed.includes('[Attachment:')) {
    const attachments = parseAttachment(trimmed);
    const textOutside = stripAttachmentTokens(trimmed);
    if (attachments.length > 0) {
      if (attachments.length > 1) {
        return textOutside ? `${attachments.length} items: ${textOutside}` : `${attachments.length} items`;
      }
      const att = attachments[0];
      const caption = att.caption || textOutside;
      const isVid = att.type.startsWith('video/') ||
        /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name) ||
        /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data);

      if (isVid) {
        return caption ? `Video: ${caption}` : 'Video';
      }
      if (att.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name) || /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data)) {
        return caption ? `Photo: ${caption}` : 'Photo';
      }
      if (att.type.startsWith('audio/') || /\.(webm|ogg|mp3|m4a|wav)($|\?)/i.test(att.name) || /\.(webm|ogg|mp3|m4a|wav)($|\?)/i.test(att.data)) {
        return caption ? `Voice message: ${caption}` : 'Voice message';
      }

      // Document / other file
      const hasCleanName = att.name && !att.name.startsWith('doc_') && !att.name.startsWith('img_') && !att.name.startsWith('aud_') && !att.name.startsWith('vid_') && !att.name.includes('-') && !att.name.startsWith('upload_');
      const docLabel = hasCleanName ? att.name : 'Document';
      return caption ? `${docLabel}: ${caption}` : docLabel;
    }
    return textOutside || 'Attachment';
  }
  return trimmed;
}
