import { expect, it } from 'vitest';
import { notDeleted } from '../src/shared/database/not-deleted.js';
import { organizations } from '../src/shared/database/schema/index.js';
import { createTestApp, db, pool, resetDatabase } from './helpers.js';

it('atende GET /health e limpa os dados sem apagar o controle de migrations', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });

  const migrations = await pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id');
  expect(migrations.rows.length).toBeGreaterThan(0);

  await resetDatabase();
  expect(await db.select().from(organizations).where(notDeleted(organizations))).toEqual([]);
  try {
    await db.insert(organizations).values({
      name: 'Organização de teste',
      slug: 'organizacao-de-teste',
      document: '12345678901',
      contactEmail: 'teste@example.com',
      contactPhone: '11999999999',
      termsAcceptedAt: new Date(),
      termsVersion: 'test',
    });
    const rows = await db.select().from(organizations).where(notDeleted(organizations));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Organização de teste');
  } finally {
    await resetDatabase();
  }
  expect(await db.select().from(organizations).where(notDeleted(organizations))).toEqual([]);
  expect((await pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows).toEqual(
    migrations.rows,
  );
});
