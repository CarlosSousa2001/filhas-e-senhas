import { afterAll } from 'vitest';
import type { buildApp } from '../src/app.js';
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

type TestApp = Awaited<ReturnType<typeof buildApp>>;

/**
 * Sobe a API para testes (app.inject).
 * `registerRoutes` permite registrar rotas temporárias de teste antes do ready.
 */
export async function createTestApp(registerRoutes?: (app: TestApp) => void | Promise<void>) {
  const { buildApp } = await import('../src/app.js');
  const app = await buildApp();
  apps.push(app);
  await registerRoutes?.(app);
  await app.ready();
  return app;
}

export async function resetDatabase() {
  await truncateTestDatabase(pool);
}
