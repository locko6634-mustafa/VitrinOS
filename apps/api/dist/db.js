import fp from 'fastify-plugin';
import { createDb } from '@vitrinos/db';
import { config } from './config.js';
const dbPlugin = async (fastify) => {
    const db = createDb(config.DATABASE_URL);
    fastify.decorate('db', db);
    fastify.addHook('onClose', async () => {
        // node-postgres pool kapatma işlemi otomatik yapılıyor ya da gerekirse burası genişletilebilir.
    });
};
export default fp(dbPlugin);
//# sourceMappingURL=db.js.map