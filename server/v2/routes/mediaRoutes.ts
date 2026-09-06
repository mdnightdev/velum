import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { auth } from '../middleware/auth.js';
import {
  validateUploadParameters,
  generatePresignedUpload,
  validatePresignedToken,
  verifyFileSha256
} from '../services/media/presignedUploadService.js';
import { mediaService } from '../services/media/mediaService.js';
import { logger } from '../utils/logger.js';

export const mediaRouter = Router();

// ---------------------------------------------------------------------------
// Upload validation helpers
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4', 'pdf', 'txt', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx']);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type MagicSignature = { bytes: number[]; offset?: number };

const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  jpg: [{ bytes: [0xff, 0xd8, 0xff] }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // 'RIFF' — WEBP marker sits at offset 8, checked below
  mp4: [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // 'ftyp' at offset 4
  webm: [{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46] }] // '%PDF'
};

function getSafeExtension(rawFilename: string): string | null {
  const base = path.basename((rawFilename || '').replace(/\0/g, ''));
  const ext = path.extname(base).replace('.', '').toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return null;
  return ext;
}

function matchesMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return true; // Plaintext or unconstrained doc types pass through

  const basicMatch = signatures.some(({ bytes, offset = 0 }) => {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((b, i) => buffer[offset + i] === b);
  });
  if (!basicMatch) return false;

  // WEBP needs a second check: RIFF is a shared container header, the actual WEBP marker lives at offset 8.
  if (ext === 'webp') {
    if (buffer.length < 12) return false;
    const marker = buffer.subarray(8, 12).toString('ascii');
    return marker === 'WEBP';
  }

  return true;
}

function containsScriptContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').toLowerCase();
  return /<script[\s>]/.test(sample) || /<\?php/.test(sample) || /<html[\s>]/.test(sample);
}

function sanitizeStorageFolder(rawFolder: string | undefined): string {
  const parts = (rawFolder || 'chat')
    .split('/')
    .map(p => p.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean);
  return parts.join('/') || 'chat';
}

// ---------------------------------------------------------------------------
// POST /v2/media/presigned-upload & /api/v2/media/presigned-upload
// ---------------------------------------------------------------------------

const handlePresignedUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const rawExt = (req.body.extension || 'bin').replace(/^\./, '');
    let defaultPrefix = 'doc';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(rawExt)) defaultPrefix = 'img';
    else if (['webm', 'ogg', 'mp3', 'm4a'].includes(rawExt)) defaultPrefix = 'aud';
    else if (['mp4', 'mov'].includes(rawExt)) defaultPrefix = 'vid';
    const filename = req.body.filename || `${defaultPrefix}_${crypto.randomBytes(5).toString('hex')}.${rawExt}`;
    const rawMime = req.body.mime_type || req.body.mimeType || (
      rawExt === 'webp' ? 'image/webp' :
      rawExt === 'png' ? 'image/png' :
      rawExt === 'jpg' || rawExt === 'jpeg' ? 'image/jpeg' :
      rawExt === 'webm' ? 'audio/webm' :
      rawExt === 'mp4' ? 'video/mp4' : 'image/webp'
    );
    const fileSizeBytes = Number(req.body.file_size_bytes || req.body.fileSizeBytes || 1024 * 1024);
    const folder = req.body.folder || req.body.type || 'chat';

    const validation = validateUploadParameters({
      filename,
      mimeType: rawMime,
      fileSizeBytes,
      sha256Checksum: req.body.sha256_checksum || req.body.sha256Checksum,
      folder
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const hostHeader = req.get('host') || 'localhost:3000';
    const presignedData = await generatePresignedUpload(
      {
        filename,
        mimeType: rawMime,
        fileSizeBytes,
        sha256Checksum: req.body.sha256_checksum || req.body.sha256Checksum,
        folder
      },
      userId,
      hostHeader
    );

    res.json({
      status: 'ok',
      presigned: presignedData,
      uploadUrl: presignedData.uploadUrl,
      relativeDbPath: presignedData.relativePath
    });
  } catch (err) {
    next(err);
  }
};

mediaRouter.post('/media/presigned-upload', auth, handlePresignedUpload);
mediaRouter.post('/storage/upload-token', auth, handlePresignedUpload);

// ---------------------------------------------------------------------------
// PUT/POST /v2/media/upload - Direct binary stream upload with SHA-256 check
// ---------------------------------------------------------------------------

const handleDirectUpload = async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req as any).correlationId || 'NO-CORR-ID';
  
  try {
    const contentLength = Number(req.headers['content-length'] || 0);
    const rawFilename = (req.query.filename as string) || `upload_${Date.now()}.bin`;
    const folderParam = (req as any).presignedFolder || (req.query.folder as string);
    const folder = sanitizeStorageFolder(folderParam);
    const expectedSha = (req.headers['x-amz-checksum-sha256'] as string) || (req.query.sha256 as string);

    if (contentLength > MAX_UPLOAD_BYTES) {
      logger.warn('Payload exceeds maximum size', { correlationId, contentLength, maxSize: MAX_UPLOAD_BYTES });
      return res.status(413).json({ error: 'Payload exceeds maximum allowed size.' });
    }

    const bodyBuffer = req.body as Buffer;
    if (!bodyBuffer || !Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
      logger.warn('No binary payload received', { correlationId });
      return res.status(400).json({ error: 'No binary payload received.' });
    }

    if (bodyBuffer.length > MAX_UPLOAD_BYTES) {
      logger.warn('Body buffer exceeds maximum size', { correlationId, bodyLength: bodyBuffer.length, maxSize: MAX_UPLOAD_BYTES });
      return res.status(413).json({ error: 'Payload exceeds maximum allowed size.' });
    }

    const ext = getSafeExtension(rawFilename);
    if (!ext) {
      logger.warn('File type not allowed', { correlationId, rawFilename });
      return res.status(400).json({ error: 'File type not allowed.' });
    }

    if (!matchesMagicBytes(bodyBuffer, ext)) {
      logger.warn('Magic bytes mismatch', { correlationId, ext, bufferLength: bodyBuffer.length });
      return res.status(400).json({ error: 'File content does not match a valid file of this type.' });
    }

    if (containsScriptContent(bodyBuffer)) {
      logger.warn('Script content detected', { correlationId, ext });
      return res.status(400).json({ error: 'File content rejected: embedded script content detected.' });
    }

    if (expectedSha && !verifyFileSha256(bodyBuffer, expectedSha)) {
      logger.warn('SHA-256 checksum mismatch', { correlationId, expectedSha });
      return res.status(422).json({ error: 'SHA-256 checksum mismatch. Payload corrupted during transit.' });
    }

    const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    if (!fs.existsSync(publicUploadDir)) {
      fs.mkdirSync(publicUploadDir, { recursive: true });
    }

    // Use presigned filename if available, otherwise generate anonymous server filename
    const presignedFilename = (req as any).presignedFilename;
    let prefix = 'doc';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      prefix = 'img';
    } else if (['webm', 'ogg', 'mp3', 'm4a', 'wav'].includes(ext)) {
      prefix = 'aud';
    } else if (['mp4', 'mov', 'mkv'].includes(ext)) {
      prefix = 'vid';
    }
    const generatedFilename = presignedFilename || `${prefix}_${crypto.randomBytes(5).toString('hex')}.${ext}`;
    const targetPath = path.join(publicUploadDir, generatedFilename);
    await fs.promises.writeFile(targetPath, bodyBuffer);

    const relativeUrl = `/uploads/${folder}/${generatedFilename}`;
    const category: 'avatar' | 'chat' | 'general' = (req as any).presignedCategory || (folder.startsWith('avatars') ? 'avatar' : 'chat');

    // Register media asset tracking record
    await mediaService.recordAsset({
      uploaderId: req.user!.userId,
      storageKey: `${folder}/${generatedFilename}`,
      relativePath: relativeUrl,
      mimeType: (req.headers['content-type'] as string) || 'application/octet-stream',
      byteSize: bodyBuffer.length,
      category,
      sha256: expectedSha || crypto.createHash('sha256').update(bodyBuffer).digest('hex')
    }).catch(err => {
      logger.error('[MEDIA] Failed to track asset in database', { relativeUrl, error: (err as Error).message });
    });

    logger.info('Upload successful', {
      correlationId,
      userId: req.user!.userId,
      relativeUrl,
      bytesReceived: bodyBuffer.length
    });

    res.json({
      status: 'ok',
      url: relativeUrl,
      relative_path: relativeUrl,
      bytes_received: bodyBuffer.length
    });
  } catch (err) {
    logger.error('Upload handler error', {
      correlationId,
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    next(err);
  }
};

const uploadAuth = async (req: Request, res: Response, next: NextFunction) => {
  const queryToken = req.query.token as string;
  const correlationId = (req as any).correlationId || 'NO-CORR-ID';
  
  if (queryToken) {
    const tokenResult = await validatePresignedToken(queryToken);
    if (tokenResult.valid) {
      req.user = {
        userId: tokenResult.userId || 1,
        username: 'uploader',
        role: 'USER',
        duress_active: false
      };
      (req as any).presignedFilename = tokenResult.filename;
      (req as any).presignedFolder = tokenResult.folder;
      (req as any).presignedCategory = tokenResult.category;
      return next();
    } else {
      logger.warn('Presigned token validation failed, falling back to session auth', {
        correlationId,
        reason: 'Token not found or expired'
      });
    }
  }
  
  return auth(req, res, next);
};

mediaRouter.put('/media/upload', express.raw({ type: '*/*', limit: '50mb' }), uploadAuth, handleDirectUpload);
mediaRouter.post('/media/upload', express.raw({ type: '*/*', limit: '50mb' }), uploadAuth, handleDirectUpload);
