import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { organizations } from '../../shared/database/schema/index.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

async function registerOrganization() {
  const response = await app.inject({
    method: 'POST',
    url: '/organizations',
    payload: {
      organizationName: 'Nen Protocol System',
      document: '12.345.678/0001-90',
      ownerName: 'Carlos Sousa',
      phone: '(11) 98765-4321',
      email: 'carlos@example.com',
      password: 'senha-segura',
      passwordConfirmation: 'senha-segura',
      acceptedTerms: true,
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json().organization as { id: string; slug: string };
}

function getBySlug(slug: string) {
  return app.inject({ method: 'GET', url: `/organizations/by-slug/${slug}` });
}

describe('GET /organizations/by-slug/:slug', () => {
  it('retorna apenas o nome da empresa ativa', async () => {
    const organization = await registerOrganization();

    const response = await getBySlug(organization.slug);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'Nen Protocol System' });
  });

  it('ignora maiúsculas no slug do link', async () => {
    await registerOrganization();

    const response = await getBySlug('Nen-Protocol-System');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'Nen Protocol System' });
  });

  it('retorna 404 para slug inexistente', async () => {
    const response = await getBySlug('empresa-que-nao-existe');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'Empresa não encontrada',
      statusCode: 404,
      exception: 'OrganizationNotFoundException',
    });
  });

  it('retorna 404 para organização inativa', async () => {
    const organization = await registerOrganization();
    await db
      .update(organizations)
      .set({ active: false })
      .where(eq(organizations.id, organization.id));

    const response = await getBySlug(organization.slug);

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('OrganizationNotFoundException');
  });

  it('retorna 404 para organização excluída', async () => {
    const organization = await registerOrganization();
    await db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(eq(organizations.id, organization.id));

    const response = await getBySlug(organization.slug);

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('OrganizationNotFoundException');
  });

  it('aparece documentada no OpenAPI', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
    const operation = response.json().paths['/organizations/by-slug/{slug}']?.get;

    expect(operation?.tags).toEqual(['Organizations']);
    expect(operation?.responses?.['200']).toBeDefined();
    expect(operation?.responses?.['404']).toBeDefined();
  });
});
