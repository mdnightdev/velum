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

    if (match[4] === 'data' && !rawVal.startsWith('data:') && !rawVal.startsWith('http')) {
      rawVal = 'data:' + rawVal;
    }

    let parsedType = match[3].trim();
    const parsedName = match[1].trim();
    const ext = parsedName.toLowerCase().split('.').pop() || '';
    if (!parsedType || !parsedType.startsWith('image/')) {
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || rawVal.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(rawVal)) {
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
  const dataMatch = content.match(/data:([^\s\]]+)/);

  if (urlMatch) {
    url = urlMatch[1];
  } else if (dataMatch) {
    url = dataMatch[1].startsWith('data:') ? dataMatch[1] : `data:${dataMatch[1]}`;
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

export function getCleanPreview(content: string): string {
  if (!content) return '';
  if (content.startsWith('[Voice Note')) {
    return formatVoiceNotePreview(content);
  }
  if (content.includes('[Attachment:')) {
    const attachments = parseAttachment(content);
    if (attachments.length > 0) {
      if (attachments.length > 1) {
        return `${attachments.length} photos`;
      }
      return attachments[0].type.startsWith('image/')
        ? `Photo${attachments[0].caption ? ' ' + attachments[0].caption : ''}`
        : `${attachments[0].name}${attachments[0].caption ? ' ' + attachments[0].caption : ''}`;
    }
    return 'Attachment';
  }
  return content;
}
