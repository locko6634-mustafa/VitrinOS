import { S3Client } from '@aws-sdk/client-s3';
export declare const s3Client: S3Client;
/**
 * Belirli bir key için presigned upload (PUT) URL'si üretir.
 */
export declare function getPresignedUploadUrl(key: string, mimeType: string, expiresInSeconds?: number): Promise<string>;
/**
 * Belirli bir key için presigned download (GET) URL'si üretir.
 */
export declare function getPresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
