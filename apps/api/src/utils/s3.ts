import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

const s3Config: any = {
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
  region: 'auto', // Cloudflare R2 için auto, AWS için gerekirse ayarlanabilir
};

if (config.S3_ENDPOINT) {
  s3Config.endpoint = config.S3_ENDPOINT;
  s3Config.forcePathStyle = config.S3_FORCE_PATH_STYLE;
}

export const s3Client = new S3Client(s3Config);

/**
 * Belirli bir key için presigned upload (PUT) URL'si üretir.
 */
export async function getPresignedUploadUrl(key: string, mimeType: string, expiresInSeconds: number = 3600): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Belirli bir key için presigned download (GET) URL'si üretir.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
