import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { brands, brandPrompts, eq, and } from '@vitrinos/db';

const PromptSchema = z.object({
  basePrompt: z.string().optional().nullable(),
  bannerPrompt: z.string().optional().nullable(),
  metaPostPrompt: z.string().optional().nullable(),
  storyPrompt: z.string().optional().nullable(),
  revizePrompt: z.string().optional().nullable(),
});

export const promptsRoutes: FastifyPluginAsync = async (fastify) => {
  // Kimlik doğrulama kontrolü
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }
  });

  // Yardımcı fonksiyon: Marka yetkisini denetler
  const checkBrandAccess = async (brandId: string, userId: string, role: string) => {
    const brand = await fastify.db.query.brands.findFirst({
      where: role === 'admin' 
        ? eq(brands.id, brandId)
        : and(eq(brands.id, brandId), eq(brands.userId, userId)),
    });
    return brand;
  };

  // GET /api/v1/brands/:brandId/prompt
  fastify.get('/api/v1/brands/:brandId/prompt', async (request, reply) => {
    const { brandId } = request.params as { brandId: string };
    
    const brand = await checkBrandAccess(brandId, request.user!.id, request.user!.role);
    if (!brand) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Marka bulunamadı veya erişiminiz yok' });
    }

    let prompts = await fastify.db.query.brandPrompts.findFirst({
      where: eq(brandPrompts.brandId, brandId),
    });

    // Eğer prompt kaydı yoksa, boş şablon olarak oluştur/dön
    if (!prompts) {
      const [newPrompts] = await fastify.db.insert(brandPrompts).values({
        brandId,
        basePrompt: '',
        bannerPrompt: '',
        metaPostPrompt: '',
        storyPrompt: '',
        revizePrompt: '',
      }).returning();
      prompts = newPrompts;
    }

    return reply.send({ data: prompts });
  });

  // PUT /api/v1/brands/:brandId/prompt
  fastify.put('/api/v1/brands/:brandId/prompt', async (request, reply) => {
    const { brandId } = request.params as { brandId: string };
    const body = PromptSchema.parse(request.body);

    const brand = await checkBrandAccess(brandId, request.user!.id, request.user!.role);
    if (!brand) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Marka bulunamadı veya erişiminiz yok' });
    }

    const existingPrompts = await fastify.db.query.brandPrompts.findFirst({
      where: eq(brandPrompts.brandId, brandId),
    });

    let result;
    if (existingPrompts) {
      const [updated] = await fastify.db.update(brandPrompts)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(brandPrompts.brandId, brandId))
        .returning();
      result = updated;
    } else {
      const [inserted] = await fastify.db.insert(brandPrompts)
        .values({
          brandId,
          basePrompt: body.basePrompt || '',
          bannerPrompt: body.bannerPrompt || '',
          metaPostPrompt: body.metaPostPrompt || '',
          storyPrompt: body.storyPrompt || '',
          revizePrompt: body.revizePrompt || '',
        })
        .returning();
      result = inserted;
    }

    return reply.send({ data: result });
  });
};
