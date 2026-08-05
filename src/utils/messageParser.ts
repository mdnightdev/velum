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

export function parseAttachment(content: string): AttachmentPayload | null {
  if (!content || !content.includes('[Attachment:')) return null;
  
  const match = content.match(/\[Attachment:\s*(.*?)\s+size:(.*?)\s+type:(.*?)\s+(data|url):(.*?)\](?:\s*(.*))?/s);
  if (match) {
    let rawVal = match[5].trim();
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

    return {
      name: parsedName,
      size: match[2].trim(),
      type: parsedType,
      data: rawVal,
      caption: match[6] || ''
    };
  }

  const oldMatch = content.match(/\[Attachment:\s*(.*?)\s+size:(.*?)\](?:\s*(.*))?/s);
  if (oldMatch) {
    const parsedName = oldMatch[1].trim();
    const ext = parsedName.toLowerCase().split('.').pop() || '';
    let parsedType = 'application/octet-stream';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      parsedType = 'image/' + ext;
    }
    return {
      name: parsedName,
      size: oldMatch[2].trim(),
      type: parsedType,
      data: '',
      caption: oldMatch[3] || ''
    };
  }

  return null;
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
    url = `data:${dataMatch[1]}`;
  }

  return { duration, url };
}

export function getCleanPreview(content: string): string {
  if (!content) return '';
  if (content.startsWith('[Voice Note')) {
    return '[Voice Note]';
  }
  if (content.includes('[Attachment:')) {
    const attachment = parseAttachment(content);
    if (attachment) {
      if (attachment.type.startsWith('image/')) {
        return `[Photo] ${attachment.caption}`.trim();
      }
      return `[File: ${attachment.name}] ${attachment.caption}`.trim();
    }
    return '[Attachment]';
  }
  return content;
}
