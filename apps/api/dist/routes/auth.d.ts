import { FastifyPluginAsync } from 'fastify';
import { users, authSessions } from '@vitrinos/db';
declare module 'fastify' {
    interface FastifyRequest {
        user: typeof users.$inferSelect | null;
        session: typeof authSessions.$inferSelect | null;
    }
}
export declare const authRoutes: FastifyPluginAsync;
