import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'velumbucket';
const publicUrl = process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL || '';
const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

export const isCloudStorageConfigured = (): boolean => {
  return !!(accessKeyId && secretAccessKey && (endpoint || accountId));
};

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: accessKeyId || 'dummy',
        secretAccessKey: secretAccessKey || 'dummy',
      },
    });
  }
  return s3Client;
}

/**
 * Uploads a binary buffer directly to R2 / S3
 */
export const uploadBufferToCloudStorage = async (
  buffer: Buffer,
  fileKey: string,
  contentType: string
): Promise<string> => {
  if (!isCloudStorageConfigured()) {
    throw new Error('Cloud storage credentials not configured');
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  if (publicUrl) {
    const cleanPublicUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return `${cleanPublicUrl}/${fileKey}`;
  }

  return `/${fileKey}`;
};

/**
 * Generates a presigned upload link valid for 5 minutes.
 */
export const getSecureUploadAssetConfig = async (
  userId: string, 
  targetFolder: 'avatars' | 'media', 
  ext: string
) => {
  const timestamp = Date.now();
  const fileKey = `${targetFolder}/${userId}_${timestamp}.${ext}`;
  
  if (!isCloudStorageConfigured()) {
    return {
      uploadUrl: `/api/user/upload-${targetFolder === 'avatars' ? 'avatar' : 'media'}`,
      relativeDbPath: `/${targetFolder}/${userId}_${timestamp}.${ext}`
    };
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return {
    uploadUrl,
    relativeDbPath: publicUrl ? `${publicUrl}/${fileKey}` : `/${fileKey}`
  };
};

export const getSecureAssetStream = async (targetFolder: 'avatars' | 'media', filename: string) => {
  const fileKey = `${targetFolder}/${filename}`;
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });
  const response = await client.send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
};
