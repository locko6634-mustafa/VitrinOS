import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createDb } from '@vitrinos/db';
import { config } from './config.js';

// Fastify instance'ına db tipini ekliyoruz
declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const db = createDb(config.DATABASE_URL);
  
  fastify.decorate('db', db);
  
  fastify.addHook('onClose', async () => {
    // node-postgres pool kapatma işlemi otomatik yapılıyor ya da gerekirse burası genişletilebilir.
  });
};

export default fp(dbPlugin);
