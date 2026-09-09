import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import type { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Config } from '../services/media/s3Client.js';
import { logger } from '../utils/logger.js';

export const uploadsRouter = Router();

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json'
};

function contentTypeFor(key: string): string {
  const ext = path.extname(key).replace('.', '').toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/** Rejects traversal and absolute segments before the key touches disk or the bucket. */
function safeStorageKey(rawPath: string): string | null {
  const decoded = decodeURIComponent(rawPath).replace(/^\/+/, '');
  if (!decoded || decoded.includes('\0')) return null;
  const normalized = path.posix.normalize(decoded);
  if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) return null;
  if (normalized.split('/').some((segment) => segment === '..')) return null;
  return normalized;
}

/**
 * Serves uploaded media. Local disk is checked first so pre-R2 files keep working,
 * then object storage. A miss must 404 here — falling through would hand the SPA
 * shell to <img>/<video> tags and surface as an undecodable file.
 */
uploadsRouter.get('/*', async (req: Request, res: Response) => {
  const key = safeStorageKey(req.params[0] || '');
  if (!key) {
    return res.status(400).json({ error: 'Invalid media path.' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');

  const localPath = path.join(LOCAL_UPLOAD_ROOT, key);
  if (localPath.startsWith(LOCAL_UPLOAD_ROOT) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    return res.sendFile(localPath);
  }

  const s3 = getS3Config();
  if (!s3.isConfigured || !s3.client || !s3.bucket) {
    return res.status(404).json({ error: 'Media not found.' });
  }

  const range = req.headers.range;

  try {
    const object = await s3.client.send(new GetObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      ...(range ? { Range: range } : {})
    }));

    if (!object.Body) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    res.setHeader('Content-Type', object.ContentType || contentTypeFor(key));
    res.setHeader('Accept-Ranges', 'bytes');
    if (object.ETag) res.setHeader('ETag', object.ETag);
    if (object.ContentLength != null) res.setHeader('Content-Length', String(object.ContentLength));

    if (range && object.ContentRange) {
      res.status(206).setHeader('Content-Range', object.ContentRange);
    }

    const body = object.Body as Readable;
    body.on('error', (err: Error) => {
      logger.warn('[MEDIA] Object stream failed', { key, error: err.message });
      if (!res.headersSent) res.status(502).json({ error: 'Media stream failed.' });
      else res.destroy();
    });
    body.pipe(res);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return res.status(404).json({ error: 'Media not found.' });
    }
    logger.error('[MEDIA] Object fetch failed', { key, error: (err as Error).message });
    return res.status(502).json({ error: 'Media unavailable.' });
  }
});
