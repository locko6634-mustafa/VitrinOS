import { FastifyPluginAsync } from 'fastify';
import { createDb } from '@vitrinos/db';
declare module 'fastify' {
    interface FastifyInstance {
        db: ReturnType<typeof createDb>;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
