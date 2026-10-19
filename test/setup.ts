import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { assertTestDatabase, truncateTestDatabase, validateTestDatabaseUrl } from './database.js';

export default async function setup() {
  const connectionString = process.env.DATABASE_URL ?? '';
  validateTestDatabaseUrl(connectionString);
  const pool = new Pool({ connectionString });
  try {
    await assertTestDatabase(pool);
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    await truncateTestDatabase(pool);
  } finally {
    await pool.end();
  }
}
