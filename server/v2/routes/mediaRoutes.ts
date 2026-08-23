import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createAuthMiddleware, hashSessionToken } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  validateUploadParameters,
  generatePresignedUpload,
  validatePresignedToken,
  verifyFileSha256
} from '../services/media/presignedUploadService.js';
import { logger } from '../utils/logger.js';

const auth = createAuthMiddleware(async (hashedToken) => {
  if (process.env.NODE_ENV === 'test' && hashedToken === hashSessionToken('mock-token')) {
    return {
      user: {
        userId: 1,
        username: 'testuser',
        role: 'USER',
        duress_active: false
      },
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };
  }
  const result = await userRepository.findSessionByTokenHash(hashedToken);
  if (!result) return null;
  const { session, user } = result;
  return {
    user: {
      userId: user.id,
      username: user.username,
      role: user.role,
      duress_active: user.duressActive
    },
    expiresAt: session.expiresAt
  };
});
export const mediaRouter = Router();

// ---------------------------------------------------------------------------
// Upload validation helpers
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4']);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type MagicSignature = { bytes: number[]; offset?: number };

const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  jpg: [{ bytes: [0xff, 0xd8, 0xff] }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // 'RIFF' — WEBP marker sits at offset 8, checked below
  mp4: [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }], // 'ftyp' at offset 4
  webm: [{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }]
};

/**
 * Returns the extension (no dot, lowercased) if it's on the whitelist, else null.
 * Using path.extname on the basename means a double-extension trick like
 * "invoice.pdf.php" naturally resolves to "php" and gets rejected — no
 * special-casing needed for that bypass.
 */
function getSafeExtension(rawFilename: string): string | null {
  const base = path.basename((rawFilename || '').replace(/\0/g, ''));
  const ext = path.extname(base).replace('.', '').toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return null;
  return ext;
}

function matchesMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return false;

  const basicMatch = signatures.some(({ bytes, offset = 0 }) => {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((b, i) => buffer[offset + i] === b);
  });
  if (!basicMatch) return false;

  // WEBP needs a second check: RIFF is a shared container header, the actual
  // WEBP marker lives at offset 8.
  if (ext === 'webp') {
    if (buffer.length < 12) return false;
    const marker = buffer.subarray(8, 12).toString('ascii');
    return marker === 'WEBP';
  }

  return true;
}

/**
 * Cheap guard against HTML/JS/PHP polyglots that happen to start with a
 * valid magic-byte prefix (a crafted GIF/PNG can still carry a script tag
 * further into the file). Scans only the first slice of the buffer.
 */
function containsScriptContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').toLowerCase();
  return /<script[\s>]/.test(sample) || /<\?php/.test(sample) || /<html[\s>]/.test(sample);
}

function safeUploadFolder(rawFolder: string | undefined): string {
  const cleaned = (rawFolder || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || 'media';
}

// ---------------------------------------------------------------------------
// POST /v2/media/presigned-upload & /api/v2/media/presigned-upload
// ---------------------------------------------------------------------------

const handlePresignedUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const rawExt = (req.body.extension || 'bin').replace(/^\./, '');
    const filename = req.body.filename || `upload_${Date.now()}.${rawExt}`;
    const rawMime = req.body.mime_type || req.body.mimeType || (
      rawExt === 'webp' ? 'image/webp' :
      rawExt === 'png' ? 'image/png' :
      rawExt === 'jpg' || rawExt === 'jpeg' ? 'image/jpeg' :
      rawExt === 'webm' ? 'audio/webm' :
      rawExt === 'mp4' ? 'video/mp4' : 'image/webp'
    );
    const fileSizeBytes = Number(req.body.file_size_bytes || req.body.fileSizeBytes || 1024 * 1024);
    const folder = safeUploadFolder(req.body.folder || req.body.type || 'media') as any;

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
    logger.debug('Upload request received', {
      correlationId,
      contentLength,
      contentType: req.headers['content-type'],
      userId: req.user?.userId,
      filename: req.query.filename,
      folder: req.query.folder
    });
    
    if (contentLength > MAX_UPLOAD_BYTES) {
      logger.warn('Payload exceeds maximum size', {
        correlationId,
        contentLength,
        maxSize: MAX_UPLOAD_BYTES
      });
      return res.status(413).json({ error: 'Payload exceeds maximum allowed size.' });
    }

    const rawFilename = (req.query.filename as string) || `upload_${Date.now()}.bin`;
    const folder = safeUploadFolder(req.query.folder as string);
    const expectedSha = (req.headers['x-amz-checksum-sha256'] as string) || (req.query.sha256 as string);

    const bodyBuffer = req.body as Buffer;
    if (!bodyBuffer || !Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
      logger.warn('No binary payload received', {
        correlationId,
        bodyBufferExists: !!bodyBuffer,
        isBuffer: bodyBuffer ? Buffer.isBuffer(bodyBuffer) : false,
        bodyLength: bodyBuffer?.length || 0
      });
      return res.status(400).json({ error: 'No binary payload received.' });
    }

    if (bodyBuffer.length > MAX_UPLOAD_BYTES) {
      logger.warn('Body buffer exceeds maximum size', {
        correlationId,
        bodyLength: bodyBuffer.length,
        maxSize: MAX_UPLOAD_BYTES
      });
      return res.status(413).json({ error: 'Payload exceeds maximum allowed size.' });
    }

    const ext = getSafeExtension(rawFilename);
    if (!ext) {
      logger.warn('File type not allowed', {
        correlationId,
        rawFilename,
        extractedExtension: path.extname(rawFilename)
      });
      return res.status(400).json({ error: 'File type not allowed.' });
    }

    if (!matchesMagicBytes(bodyBuffer, ext)) {
      logger.warn('Magic bytes mismatch', {
        correlationId,
        ext,
        bufferLength: bodyBuffer.length,
        bufferPrefix: bodyBuffer.subarray(0, 8).toString('hex')
      });
      return res.status(400).json({ error: 'File content does not match a valid file of this type.' });
    }

    if (containsScriptContent(bodyBuffer)) {
      logger.warn('Script content detected', {
        correlationId,
        ext
      });
      return res.status(400).json({ error: 'File content rejected: embedded script content detected.' });
    }

    if (expectedSha && !verifyFileSha256(bodyBuffer, expectedSha)) {
      logger.warn('SHA-256 checksum mismatch', {
        correlationId,
        expectedSha,
        computedSha: crypto.createHash('sha256').update(bodyBuffer).digest('hex').substring(0, 16) + '...'
      });
      return res.status(422).json({ error: 'SHA-256 checksum mismatch. Payload corrupted during transit.' });
    }

    const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    if (!fs.existsSync(publicUploadDir)) {
      fs.mkdirSync(publicUploadDir, { recursive: true });
    }

    // Use presigned filename if available, otherwise generate server filename
    const presignedFilename = (req as any).presignedFilename;
    const generatedFilename = presignedFilename || `upload_${req.user!.userId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const targetPath = path.join(publicUploadDir, generatedFilename);
    await fs.promises.writeFile(targetPath, bodyBuffer);

    const relativeUrl = `/uploads/${folder}/${generatedFilename}`;

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
    logger.debug('Attempting presigned token validation', {
      correlationId,
      tokenPresent: true,
      mediaId: req.query.media_id,
      folder: req.query.folder
    });
    
    const tokenResult = await validatePresignedToken(queryToken);
    if (tokenResult.valid) {
      logger.debug('Presigned token validation succeeded', {
        correlationId,
        userId: tokenResult.userId,
        folder: tokenResult.folder,
        filename: tokenResult.filename
      });
      
      req.user = {
        userId: tokenResult.userId || 1,
        username: 'uploader',
        role: 'USER',
        duress_active: false
      };
      (req as any).presignedFilename = tokenResult.filename;
      return next();
    } else {
      logger.warn('Presigned token validation failed, falling back to session auth', {
        correlationId,
        reason: 'Token not found or expired',
        mediaId: req.query.media_id
      });
    }
  } else {
    logger.debug('No presigned token provided, using session auth', {
      correlationId
    });
  }
  
  return auth(req, res, next);
};

mediaRouter.put('/media/upload', express.raw({ type: '*/*', limit: '50mb' }), uploadAuth, handleDirectUpload);
mediaRouter.post('/media/upload', express.raw({ type: '*/*', limit: '50mb' }), uploadAuth, handleDirectUpload);
