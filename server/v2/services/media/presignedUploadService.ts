import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getRedisClient } from '../../db/redis.js';
import { logger } from '../../utils/logger.js';
import { getS3Config } from './s3Client.js';

export interface PresignedUploadRequest {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum?: string;
  folder?: string;
}

export interface PresignedUploadResponse {
  mediaId: string;
  uploadUrl: string;
  fileUrl: string;
  relativePath: string;
  expiresInSeconds: number;
  maxSizeBytes: number;
  sha256Checksum?: string;
  headers: Record<string, string>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB limit
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'application/pdf', 'text/'];

export function getStoragePartition(folder: string | undefined, userId: number): { folderPath: string; category: 'avatar' | 'chat' | 'general' } {
  const f = (folder || 'chat').toLowerCase();
  if (f === 'avatars' || f === 'avatar') {
    return { folderPath: `avatars/${userId}`, category: 'avatar' };
  }
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { folderPath: `chat/${yearMonth}`, category: 'chat' };
}

export function validateUploadParameters(params: PresignedUploadRequest): { valid: boolean; error?: string } {
  if (!params.filename || typeof params.filename !== 'string') {
    return { valid: false, error: 'Invalid or missing filename.' };
  }

  if (!params.mimeType || typeof params.mimeType !== 'string') {
    return { valid: false, error: 'Invalid or missing mimeType.' };
  }

  const isAllowed = ALLOWED_MIME_PREFIXES.some(prefix => params.mimeType.startsWith(prefix));
  if (!isAllowed) {
    return { valid: false, error: `MIME type ${params.mimeType} is not supported for out-of-band attachments.` };
  }

  if (!params.fileSizeBytes || params.fileSizeBytes <= 0 || params.fileSizeBytes > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be between 1 byte and ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
  }

  if (params.sha256Checksum && !/^[a-fA-F0-9]{64}$/.test(params.sha256Checksum)) {
    return { valid: false, error: 'sha256Checksum must be a 64-character hexadecimal string.' };
  }

  return { valid: true };
}

const activePresignedTokens = new Map<string, { userId: number; expiresAt: number; filename: string; folder: string; category: 'avatar' | 'chat' | 'general' }>();

export async function registerPresignedToken(token: string, data: { userId: number; expiresAt: number; filename: string; folder: string; category: 'avatar' | 'chat' | 'general' }) {
  const ttlSeconds = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000));
  
  // Try Redis first for persistence
  const redis = await getRedisClient();
  if (redis) {
    try {
      const tokenKey = `presigned_upload:${token}`;
      await redis.set(tokenKey, JSON.stringify(data), { EX: ttlSeconds });
      logger.debug('Presigned token stored in Redis', { token, ttlSeconds });
      return;
    } catch (err) {
      logger.warn('Failed to store presigned token in Redis, falling back to memory', { error: (err as Error).message });
    }
  }
  
  // Fallback to in-memory storage
  activePresignedTokens.set(token, data);
  logger.debug('Presigned token stored in memory fallback', { token, ttlSeconds });
}

export async function validatePresignedToken(token: string): Promise<{ valid: boolean; userId?: number; folder?: string; filename?: string; category?: 'avatar' | 'chat' | 'general' }> {
  // Try Redis first
  const redis = await getRedisClient();
  if (redis) {
    try {
      const tokenKey = `presigned_upload:${token}`;
      const data = await redis.get(tokenKey);
      if (data) {
        const rawStr = typeof data === 'string' ? data : JSON.stringify(data);
        const parsed = JSON.parse(rawStr) as { userId: number; expiresAt: number; filename: string; folder: string; category: 'avatar' | 'chat' | 'general' };
        if (Date.now() <= parsed.expiresAt) {
          logger.debug('Presigned token validated from Redis', { token, userId: parsed.userId });
          return { valid: true, userId: parsed.userId, folder: parsed.folder, filename: parsed.filename, category: parsed.category };
        } else {
          await redis.del(tokenKey);
          logger.debug('Presigned token expired in Redis', { token });
        }
      }
    } catch (err) {
      logger.warn('Failed to validate presigned token in Redis, falling back to memory', { error: (err as Error).message });
    }
  }
  
  // Fallback to in-memory storage
  const entry = activePresignedTokens.get(token);
  if (!entry) return { valid: false };
  if (Date.now() > entry.expiresAt) {
    activePresignedTokens.delete(token);
    return { valid: false };
  }
  logger.debug('Presigned token validated from memory fallback', { token, userId: entry.userId });
  return { valid: true, userId: entry.userId, folder: entry.folder, filename: entry.filename, category: entry.category };
}

export async function generatePresignedUpload(
  params: PresignedUploadRequest,
  userId: number,
  hostHeader: string
): Promise<PresignedUploadResponse> {
  const { folderPath, category } = getStoragePartition(params.folder, userId);
  const rawExt = (path.extname(params.filename) || '.bin').replace('.', '').toLowerCase();
  let prefix = 'doc';
  if (params.mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(rawExt)) {
    prefix = 'img';
  } else if (params.mimeType.startsWith('audio/') || ['webm', 'ogg', 'mp3', 'm4a', 'wav'].includes(rawExt)) {
    prefix = 'aud';
  } else if (params.mimeType.startsWith('video/') || ['mp4', 'mov', 'mkv'].includes(rawExt)) {
    prefix = 'vid';
  }
  const id10 = crypto.randomBytes(5).toString('hex');
  const cleanFilename = `${prefix}_${id10}.${rawExt}`;
  const randomToken = crypto.randomBytes(16).toString('hex');
  const mediaId = `media_${id10}`;

  await registerPresignedToken(randomToken, {
    userId,
    expiresAt: Date.now() + 900 * 1000,
    filename: cleanFilename,
    folder: folderPath,
    category
  });

  const relativePath = `/uploads/${folderPath}/${cleanFilename}`;

  // Check if Cloudflare R2 / S3 is configured, or fallback to server direct upload endpoint
  const s3 = getS3Config();

  let uploadUrl = '';
  let fileUrl = '';

  if (s3.isConfigured && s3.client && s3.bucket) {
    const s3Key = `${folderPath}/${cleanFilename}`;
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: s3Key,
      ContentType: params.mimeType,
      Metadata: {
        uploader: String(userId)
      },
      ...(params.sha256Checksum ? { ChecksumSHA256: params.sha256Checksum } : {})
    });

    uploadUrl = await getSignedUrl(s3.client, command, { expiresIn: 900 });
    fileUrl = `${(s3.publicUrl || '').replace(/\/+$/, '')}/${s3Key}`;
  } else {
    // Local / direct server endpoint fallback
    const protocol = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1') ? 'http' : 'https';
    uploadUrl = `${protocol}://${hostHeader}/v2/media/upload?token=${randomToken}&media_id=${mediaId}&folder=${encodeURIComponent(folderPath)}&filename=${encodeURIComponent(cleanFilename)}`;
    fileUrl = relativePath;
  }

  return {
    mediaId,
    uploadUrl,
    fileUrl,
    relativePath,
    expiresInSeconds: 900, // 15 mins
    maxSizeBytes: MAX_FILE_SIZE,
    sha256Checksum: params.sha256Checksum,
    headers: {
      'Content-Type': params.mimeType,
      'x-amz-meta-uploader': String(userId),
      ...(params.sha256Checksum ? { 'x-amz-checksum-sha256': params.sha256Checksum } : {})
    }
  };
}

export function verifyFileSha256(buffer: Buffer, expectedSha256?: string): boolean {
  if (!expectedSha256) return true;
  const computed = crypto.createHash('sha256').update(buffer).digest('hex');
  return computed.toLowerCase() === expectedSha256.toLowerCase();
}
