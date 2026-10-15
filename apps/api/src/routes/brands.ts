import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { brands, eq, and } from '@vitrinos/db';

const BrandSchema = z.object({
  name: z.string().min(2, 'Marka adı en az 2 karakter olmalıdır'),
  userId: z.string().uuid().nullable().optional(),
  logoUrl: z.string().url('Geçersiz logo URL').optional().or(z.literal('')),
  websiteUrl: z.string().url('Geçersiz web sitesi URL').optional().or(z.literal('')),
  colorPalette: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçersiz HEX renk kodu'),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçersiz HEX renk kodu'),
    theme: z.enum(['koyu', 'acik']),
  }).default({
    primary: '#d9962a',
    secondary: '#7a4f12',
    theme: 'koyu',
  }),
  toneRules: z.string().optional(),
  bannedWords: z.array(z.string()).default([]),
});

export const brandsRoutes: FastifyPluginAsync = async (fastify) => {
  // Kimlik doğrulama kontrolü (preHandler)
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
    }
  });

  // GET /api/v1/brands
  fastify.get('/api/v1/brands', async (request, reply) => {
    const userBrands = await fastify.db.query.brands.findMany({
      where: request.user!.role === 'admin' ? undefined : eq(brands.userId, request.user!.id),
      orderBy: (brands, { desc }) => [desc(brands.createdAt)],
    });

    return reply.send({ data: userBrands });
  });

  // POST /api/v1/brands
  fastify.post('/api/v1/brands', async (request, reply) => {
    const body = BrandSchema.parse(request.body);

    const [newBrand] = await fastify.db.insert(brands).values({
      userId: request.user!.role === 'admin' ? body.userId ?? request.user!.id : request.user!.id,
      name: body.name,
      logoUrl: body.logoUrl || null,
      websiteUrl: body.websiteUrl || null,
      colorPalette: body.colorPalette,
      toneRules: body.toneRules || null,
      bannedWords: body.bannedWords,
    }).returning();

    return reply.code(201).send({ data: newBrand });
  });

  // PATCH /api/v1/brands/:brandId
  fastify.patch('/api/v1/brands/:brandId', async (request, reply) => {
    const { brandId } = request.params as { brandId: string };
    const body = BrandSchema.partial().parse(request.body);

    const existingBrand = await fastify.db.query.brands.findFirst({
      where: request.user!.role === 'admin' 
        ? eq(brands.id, brandId)
        : and(eq(brands.id, brandId), eq(brands.userId, request.user!.id)),
    });

    if (!existingBrand) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Marka bulunamadı' });
    }

    const [updatedBrand] = await fastify.db.update(brands)
      .set({
        ...body,
        userId: request.user!.role === 'admin' && body.userId !== undefined ? body.userId : existingBrand.userId,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, brandId))
      .returning();

    return reply.send({ data: updatedBrand });
  });

  // DELETE /api/v1/brands/:brandId
  fastify.delete('/api/v1/brands/:brandId', async (request, reply) => {
    const { brandId } = request.params as { brandId: string };

    const existingBrand = await fastify.db.query.brands.findFirst({
      where: request.user!.role === 'admin' 
        ? eq(brands.id, brandId)
        : and(eq(brands.id, brandId), eq(brands.userId, request.user!.id)),
    });

    if (!existingBrand) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Marka bulunamadı' });
    }

    await fastify.db.delete(brands).where(eq(brands.id, brandId));

    return reply.send({ data: { success: true } });
  });
};
