import { createDb, sql } from '@vitrinos/db';
import { config } from '../config.js';
export async function healthRoutes(fastify) {
    const db = createDb(config.DATABASE_URL);
    fastify.get('/health/live', async () => {
        return {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    });
    fastify.get('/health/ready', async (request, reply) => {
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
    });
}
//# sourceMappingURL=health.js.map