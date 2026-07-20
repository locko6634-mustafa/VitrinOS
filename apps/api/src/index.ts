import Fastify from 'fastify';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';

const fastify = Fastify({
  logger: true
});

// Rotaları kaydet
fastify.register(healthRoutes);

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
