import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export interface PresignedUploadRequest {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum?: string;
  folder?: 'media' | 'avatars' | 'voice_notes' | 'attachments';
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

export async function generatePresignedUpload(
  params: PresignedUploadRequest,
  userId: number,
  hostHeader: string
): Promise<PresignedUploadResponse> {
  const folder = params.folder || 'media';
  const ext = path.extname(params.filename) || '.bin';
  const randomToken = crypto.randomBytes(16).toString('hex');
  const mediaId = `media_${Date.now()}_${randomToken.slice(0, 8)}`;
  const cleanFilename = `${mediaId}${ext}`;

  const relativePath = `/uploads/${folder}/${cleanFilename}`;

  // Check if S3 / R2 env vars are present, or fallback to server direct upload endpoint
  const s3Bucket = process.env.S3_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  const s3Endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;

  let uploadUrl = '';
  let fileUrl = '';

  if (s3Bucket && s3Endpoint) {
    // S3 / R2 Presigned PUT URL format
    uploadUrl = `${s3Endpoint}/${s3Bucket}/${folder}/${cleanFilename}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&token=${randomToken}`;
    fileUrl = `${process.env.CDN_BASE_URL || s3Endpoint}/${s3Bucket}/${folder}/${cleanFilename}`;
  } else {
    // Local / direct server endpoint fallback
    const protocol = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1') ? 'http' : 'https';
    uploadUrl = `${protocol}://${hostHeader}/v2/media/upload?token=${randomToken}&media_id=${mediaId}&folder=${folder}&filename=${encodeURIComponent(cleanFilename)}`;
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
