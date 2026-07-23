import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import dbPlugin from './db.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { brandsRoutes } from './routes/brands.js';
import { promptsRoutes } from './routes/prompts.js';
import { assetsRoutes } from './routes/assets.js';
import { jobsRoutes } from './routes/jobs.js';
import { leadsRoutes } from './routes/leads.js';
import { internalRoutes } from './routes/internal.js';
import { configRoutes } from './routes/config.js';
const fastify = Fastify({
    logger: true
});
// Global Rate Limit (Public ve app uçları için geçerli, internal token'lılar veya sse için rate limit by-pass veya yüksek limitler ayarlanabilir, şimdilik varsayılan bırakıyoruz)
fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
});
// Cookie Desteği
fastify.register(cookie, {
    secret: config.SESSION_SECRET,
    hook: 'onRequest'
});
// DB Plugin
fastify.register(dbPlugin);
// Rotaları kaydet
fastify.register(configRoutes);
fastify.register(healthRoutes);
fastify.register(authRoutes);
fastify.register(adminRoutes);
fastify.register(brandsRoutes);
fastify.register(promptsRoutes);
fastify.register(assetsRoutes);
fastify.register(jobsRoutes);
fastify.register(leadsRoutes);
fastify.register(internalRoutes);
const start = async () => {
    try {
        await fastify.listen({ port: config.PORT, host: config.HOST });
        fastify.log.info(`Server is running at http://${config.HOST}:${config.PORT}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map