import { z } from 'zod';
import crypto from 'node:crypto';
import { assets, eq, and } from '@vitrinos/db';
import { getPresignedUploadUrl, s3Client } from '../utils/s3.js';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
const UploadUrlRequestSchema = z.object({
    mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif|avif)$/, 'Sadece resim dosyaları desteklenir'),
    sizeBytes: z.number().max(10 * 1024 * 1024, 'Dosya boyutu en fazla 10MB olmalıdır'),
    checksum: z.string().min(8, 'Geçersiz checksum formatı'),
    purpose: z.enum(['source_image', 'logo', 'generated_asset']),
});
export const assetsRoutes = async (fastify) => {
    // Kimlik doğrulama kontrolü
    fastify.addHook('preHandler', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
        }
    });
    // POST /api/v1/assets/upload-url
    fastify.post('/api/v1/assets/upload-url', async (request, reply) => {
        const { mimeType, sizeBytes, checksum, purpose } = UploadUrlRequestSchema.parse(request.body);
        // Uzantı belirle
        const ext = mimeType.split('/')[1] || 'bin';
        const uuid = crypto.randomUUID();
        const key = `${purpose}/${request.user.id}/${uuid}.${ext}`;
        // Veritabanına status='pending' olarak ekle
        const [assetRecord] = await fastify.db.insert(assets).values({
            key,
            bucket: config.S3_BUCKET_NAME,
            ownerId: request.user.id,
            mimeType,
            sizeBytes,
            checksum,
            purpose,
            status: 'pending', // Yükleme tamamlanana kadar pending
        }).returning();
        // Presigned upload URL üret (PUT)
        const uploadUrl = await getPresignedUploadUrl(key, mimeType);
        return reply.send({
            data: {
                assetId: assetRecord.id,
                key,
                uploadUrl,
            }
        });
    });
    // POST /api/v1/assets/:assetId/complete
    fastify.post('/api/v1/assets/:assetId/complete', async (request, reply) => {
        const { assetId } = request.params;
        const assetRecord = await fastify.db.query.assets.findFirst({
            where: and(eq(assets.id, assetId), eq(assets.ownerId, request.user.id))
        });
        if (!assetRecord) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'Asset bulunamadı' });
        }
        try {
            // S3 üzerinde objenin varlığını ve boyutunu sorgula
            const headResponse = await s3Client.send(new HeadObjectCommand({
                Bucket: config.S3_BUCKET_NAME,
                Key: assetRecord.key,
            }));
            // Boyut kontrolü
            if (headResponse.ContentLength !== assetRecord.sizeBytes) {
                return reply.code(400).send({
                    code: 'SIZE_MISMATCH',
                    message: `Yüklenen dosya boyutu (${headResponse.ContentLength}) ile belirtilen boyut (${assetRecord.sizeBytes}) eşleşmiyor`
                });
            }
            // Durumu 'active' olarak güncelle
            const [updatedAsset] = await fastify.db.update(assets)
                .set({
                status: 'active',
                updatedAt: new Date(),
            })
                .where(eq(assets.id, assetId))
                .returning();
            return reply.send({ data: updatedAsset });
        }
        catch (err) {
            if (err.name === 'NotFound') {
                return reply.code(400).send({
                    code: 'UPLOAD_NOT_COMPLETED',
                    message: 'Dosya henüz depolama alanına yüklenmemiş'
                });
            }
            fastify.log.error(err);
            return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Dosya kontrolü sırasında hata oluştu' });
        }
    });
};
//# sourceMappingURL=assets.js.map