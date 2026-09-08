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
  // size values may include spaces (e.g. "12 KB"); keep original tolerant capture.
  const regex =
    /\[Attachment:\s*(.*?)\s+size:(.*?)\s+type:(.*?)\s+(data|url):(.*?)(?:\](?:\s*(.*?))?(?=\[Attachment:|$)|\])/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    let rawVal = match[5] ? match[5].trim() : '';
    if (rawVal.endsWith(']')) rawVal = rawVal.slice(0, -1).trim();

    // Skip inline base64 for rendering — storage URLs only.
    if (match[4] === 'data' || rawVal.startsWith('data:')) {
      continue;
    }

    let parsedType = match[3].trim();
    const parsedName = match[1].trim();
    const ext = parsedName.toLowerCase().split('.').pop() || '';
    if (!parsedType || !parsedType.startsWith('image/')) {
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(rawVal)) {
        parsedType = 'image/' + (ext === 'jpg' ? 'jpeg' : ext || 'jpeg');
      } else if (
        ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(ext) ||
        /\.(mp4|webm|mov|mkv|m4v)($|\?)/i.test(rawVal)
      ) {
        parsedType = 'video/' + (ext || 'mp4');
      }
    }

    results.push({
      name: parsedName,
      size: match[2].trim(),
      type: parsedType,
      data: rawVal,
      caption: match[6] ? match[6].trim() : '',
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
    .replace(/\[Attachment:\s*[^\]]*\]/g, '')
    .replace(/\[Voice Note[^\]]*\]/g, '')
    .trim();
}

function isVideoAttachment(att: AttachmentPayload): boolean {
  return (
    att.type?.startsWith('video/') ||
    att.name?.startsWith('vid_') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name || '') ||
    /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data || '')
  );
}

function isImageAttachment(att: AttachmentPayload): boolean {
  if (isVideoAttachment(att)) return false;
  return (
    att.type?.startsWith('image/') ||
    att.name?.startsWith('img_') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.name || '') ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(att.data || '')
  );
}

/** Chat-list / reply preview label for one or more attachments (WA/TG-style). */
export function formatAttachmentAlbumPreview(
  attachments: AttachmentPayload[],
  caption = ''
): string {
  if (!attachments.length) return caption || 'Attachment';
  const n = attachments.length;
  const videoCount = attachments.filter(isVideoAttachment).length;
  const imageCount = attachments.filter(isImageAttachment).length;

  let label: string;
  if (videoCount === n) {
    label = n === 1 ? 'Video' : `${n} videos`;
  } else if (imageCount === n) {
    label = n === 1 ? 'Photo' : `${n} photos`;
  } else if (n > 1) {
    label = `${n} media`;
  } else {
    const att = attachments[0];
    if (att.type?.startsWith('audio/') || /\.(webm|ogg|mp3|m4a|wav)($|\?)/i.test(att.name || '')) {
      label = 'Voice message';
    } else {
      const hasCleanName =
        att.name &&
        !att.name.startsWith('doc_') &&
        !att.name.startsWith('img_') &&
        !att.name.startsWith('aud_') &&
        !att.name.startsWith('vid_') &&
        !att.name.includes('-') &&
        !att.name.startsWith('upload_') &&
        !/^https?:\/\//i.test(att.name) &&
        !att.name.includes('/');
      label = hasCleanName ? att.name : 'Document';
    }
  }

  const cap = scrubPreviewNoise(caption);
  return cap ? `${label}: ${cap}` : label;
}

function looksLikeRawMediaPayload(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return (
    /\[Attachment:/i.test(t) ||
    /\[Voice Note/i.test(t) ||
    /https?:\/\/\S+/i.test(t) ||
    /\/uploads\/media\//i.test(t) ||
    /data:(image|video|audio)\//i.test(t)
  );
}

function scrubPreviewNoise(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[Attachment:\s*[^\]]*\]/gi, ' ')
    .replace(/\[Voice Note[^\]]*\]/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\/uploads\/media\/\S+/gi, ' ')
    .replace(/data:(image|video|audio)\/[^\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferMediaLabelFromContent(content: string): string {
  const t = content || '';
  if (/\[Voice Note/i.test(t) || (/type:audio\//i.test(t) && /\[Attachment:/i.test(t))) {
    return formatVoiceNotePreview(t);
  }
  if (/type:video\//i.test(t) || /\bvid_/i.test(t) || /\.(mp4|webm|mov|mkv|m4v)($|\?|\s|\])/i.test(t)) {
    return 'Video';
  }
  if (
    /type:image\//i.test(t) ||
    /\bimg_/i.test(t) ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?|\s|\])/i.test(t) ||
    /\/uploads\/media\//i.test(t) ||
    /data:image\//i.test(t)
  ) {
    return 'Photo';
  }
  if (/\[Attachment:/i.test(t) || /https?:\/\//i.test(t) || /data:(video|audio)\//i.test(t)) {
    return 'Attachment';
  }
  return 'Media';
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
    const textOutside = scrubPreviewNoise(stripAttachmentTokens(trimmed));
    if (attachments.length > 0) {
      const caption = attachments.length === 1
        ? scrubPreviewNoise(attachments[0].caption || textOutside)
        : textOutside;
      return formatAttachmentAlbumPreview(attachments, caption);
    }
    return textOutside || inferMediaLabelFromContent(trimmed);
  }
  if (looksLikeRawMediaPayload(trimmed)) {
    const cleaned = scrubPreviewNoise(trimmed);
    return cleaned || inferMediaLabelFromContent(trimmed);
  }
  return trimmed;
}
