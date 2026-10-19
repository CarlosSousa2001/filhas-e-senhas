import { afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { db, pool } from '../src/shared/database/client.js';
import { truncateTestDatabase } from './database.js';

export { db, pool };

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

// Registrado como setupFiles: encerra as aplicações e o pool de cada arquivo.
afterAll(async () => {
  try {
    await Promise.all(apps.map((app) => app.close()));
  } finally {
    await pool.end();
  }
});

export async function createTestApp() {
  const app = await buildApp();
  apps.push(app);
  await app.ready();
  return app;
}

export async function resetDatabase() {
  await truncateTestDatabase(pool);
}
