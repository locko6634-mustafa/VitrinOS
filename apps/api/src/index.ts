import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import dbPlugin from './db.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';

const fastify = Fastify({
  logger: true
});

// Global Rate Limit
fastify.register(rateLimit, {
  max: 100,
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
fastify.register(healthRoutes);
fastify.register(authRoutes);
fastify.register(adminRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: config.PORT, host: config.HOST });
    fastify.log.info(`Server is running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
