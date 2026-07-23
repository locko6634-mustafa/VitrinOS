import { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  const getRuntimeConfigJs = () => {
    const runtimeConfig = {
      environment: config.NODE_ENV || 'development',
      appUrl: process.env.PUBLIC_APP_URL || `http://${config.HOST}:${config.PORT}`,
      contactEmail: process.env.PUBLIC_CONTACT_EMAIL || '',
      sentryDsn: process.env.SENTRY_DSN || process.env.PUBLIC_SENTRY_DSN || '',
      observabilitySampleRate: process.env.OBSERVABILITY_SAMPLE_RATE ? parseFloat(process.env.OBSERVABILITY_SAMPLE_RATE) : 1.0,
      release: process.env.RELEASE || process.env.GIT_COMMIT_SHA || 'vitrinos-web@1.0.0'
    };

    return `window.VitrinOSRuntimeConfig = ${JSON.stringify(runtimeConfig)};`;
  };

  fastify.get('/api/runtime-config.js', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0');
    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(getRuntimeConfigJs());
  });

  fastify.get('/api/v1/config', async (_request, reply) => {
    return reply.send({
      data: {
        environment: config.NODE_ENV || 'development',
        appUrl: process.env.PUBLIC_APP_URL || `http://${config.HOST}:${config.PORT}`,
        release: process.env.RELEASE || 'vitrinos-web@1.0.0'
      }
    });
  });
};
