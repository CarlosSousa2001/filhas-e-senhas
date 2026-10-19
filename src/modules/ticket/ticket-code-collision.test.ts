import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner } from '../../../test/fixtures.js';
import { tickets } from '../../shared/database/schema/index.js';

// Código aleatório previsível: a 1ª e a 2ª chamadas repetem o mesmo código, a 3ª é diferente.
const codes = vi.hoisted(() => ['AAAAAAA', 'AAAAAAA', 'BBBBBBB']);
vi.mock('../../shared/utils/random-code.js', () => ({
  generateRandomCode: () => codes.shift() ?? 'ZZZZZZZ',
}));

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

it('código repetido no mesmo dia gera outro código em vez de falhar', async () => {
  const org = await createOrganizationWithOwner(app);
  const department = await app.inject({
    method: 'POST',
    url: '/departments',
    headers: bearer(org.ownerToken),
    payload: { name: 'Técnico', prefix: 'TEC' },
  });
  const generate = () =>
    app.inject({
      method: 'POST',
      url: '/tickets',
      headers: bearer(org.ownerToken),
      payload: { departmentId: department.json().id },
    });

  const first = await generate();
  const second = await generate();

  expect(first.json().code).toBe('TEC-AAAAAAA');
  expect(second.statusCode).toBe(201);
  expect(second.json().code).toBe('TEC-BBBBBBB');
  expect(await db.select().from(tickets)).toHaveLength(2);
});
