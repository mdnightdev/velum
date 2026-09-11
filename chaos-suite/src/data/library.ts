import fs from 'fs';
import path from 'path';

export const DEFAULT_LIBRARY_ROOT =
  '/data/data/com.termux/files/home/storage/shared/chaos';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MEDIA_EXT = new Set([
  ...IMAGE_EXT,
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.mkv',
]);

export function avatarDir(libraryRoot: string = DEFAULT_LIBRARY_ROOT): string {
  return path.join(libraryRoot, 'Avatars');
}

export function mediaDir(libraryRoot: string = DEFAULT_LIBRARY_ROOT): string {
  return path.join(libraryRoot, 'Media');
}

/** Image files only — for profile avatars. */
export function listAvatarImages(libraryRoot: string = DEFAULT_LIBRARY_ROOT): string[] {
  const dir = avatarDir(libraryRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name))
    .sort();
}

export function pickAvatarPath(
  libraryRoot: string,
  agentIndex: number
): string | null {
  const files = listAvatarImages(libraryRoot);
  if (!files.length) return null;
  return files[agentIndex % files.length];
}

/** Chat media: images + videos. */
export function listMediaFiles(libraryRoot: string = DEFAULT_LIBRARY_ROOT): string[] {
  const dir = mediaDir(libraryRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => MEDIA_EXT.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name))
    .sort();
}

export function pickMediaPath(
  libraryRoot: string,
  agentIndex: number
): string | null {
  const files = listMediaFiles(libraryRoot);
  if (!files.length) return null;
  return files[agentIndex % files.length];
}

export function mimeForImage(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

export function mimeForMedia(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mkv':
      return 'video/x-matroska';
    default:
      return mimeForImage(filePath);
  }
}

export function formatByteSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** Product chat attachment token + optional caption. */
export function attachmentMessage(opts: {
  name: string;
  sizeLabel: string;
  mime: string;
  url: string;
  caption?: string;
}): string {
  const token = `[Attachment: ${opts.name} size:${opts.sizeLabel} type:${opts.mime} url:${opts.url}]`;
  const caption = (opts.caption || '').trim();
  return caption ? `${token} ${caption}` : token;
}
