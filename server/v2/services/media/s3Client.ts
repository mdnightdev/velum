import { S3Client } from '@aws-sdk/client-s3';

let s3ClientInstance: S3Client | null = null;

export interface S3Config {
  client: S3Client | null;
  bucket: string | null;
  publicUrl: string | null;
  isConfigured: boolean;
}

export function getS3Config(): S3Config {
  const bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || null;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || null;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || null;
  const accountId = process.env.R2_ACCOUNT_ID || null;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null) || process.env.S3_ENDPOINT || null;
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.CDN_BASE_URL || (endpoint && bucket ? `${endpoint.replace(/\/+$/, '')}/${bucket}` : null);

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    return { client: null, bucket: null, publicUrl: null, isConfigured: false };
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: process.env.R2_REGION || process.env.AWS_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  return { client: s3ClientInstance, bucket, publicUrl, isConfigured: true };
}
