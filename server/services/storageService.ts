import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || 'dummy_account';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'dummy_key';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'dummy_secret';

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

/**
 * Generates an encrypted upload lease link valid for 5 minutes.
 */
export const getSecureUploadAssetConfig = async (userId: string, targetFolder: 'avatars' | 'media', ext: string) => {
    const timestamp = Date.now();
    const fileKey = `${targetFolder}/${userId}_${timestamp}.${ext}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'dummy_bucket',
        Key: fileKey,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
        uploadUrl, // Target streaming path used by client application PUT requests
        relativeDbPath: `/${targetFolder}/${userId}_${timestamp}.${ext}` // Lightweight index string for SQLite
    };
};
