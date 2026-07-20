import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export const createDb = (connectionString: string) => {
  const pool = new pg.Pool({
    connectionString,
  });
  
  return drizzle(pool, { schema });
};

export { sql } from 'drizzle-orm';
export * from './schema.js';
export * from './repository.js';

