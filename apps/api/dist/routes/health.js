import { createDb, sql } from '@vitrinos/db';
import { config } from '../config.js';
export async function healthRoutes(fastify) {
    const db = createDb(config.DATABASE_URL);
    const handleLive = async () => {
        return {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    };
    const handleReady = async (request, reply) => {
        try {
            // Veritabanı canlılık testi
            await db.execute(sql `SELECT 1`);
            return {
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: {
                    database: 'healthy'
                }
            };
        }
        catch (err) {
            fastify.log.error(err, 'Database connection failed during healthcheck');
            return reply.status(503).send({
                status: 'error',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: {
                    database: 'unhealthy'
                }
            });
        }
    };
    fastify.get('/health/live', handleLive);
    fastify.get('/api/health/live', handleLive);
    fastify.get('/api/v1/health/live', handleLive);
    fastify.get('/health/ready', handleReady);
    fastify.get('/api/health/ready', handleReady);
    fastify.get('/api/v1/health/ready', handleReady);
}
//# sourceMappingURL=health.js.map