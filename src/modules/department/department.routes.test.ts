import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { departments, userDepartmentAccess } from '../../shared/database/schema/index.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

async function setup() {
  const org = await createOrganizationWithOwner(app);
  const attendant = await createUserAndLogin(app, {
    organizationId: org.organization.id,
    organizationSlug: org.organization.slug,
    branchId: org.branch.id,
    role: 'ATTENDANT',
    username: 'gabriel.4821',
  });
  return { ...org, attendant };
}

function create(token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/departments', headers: bearer(token), payload });
}

function list(token: string, query = '') {
  return app.inject({ method: 'GET', url: `/departments${query}`, headers: bearer(token) });
}

function update(token: string, id: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'PATCH',
    url: `/departments/${id}`,
    headers: bearer(token),
    payload,
  });
}

describe('POST /departments', () => {
  it('cria departamento com prefixo normalizado para maiúsculas', async () => {
    const s = await setup();

    const response = await create(s.ownerToken, { name: ' Exames ', prefix: 'ex' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      name: 'Exames',
      prefix: 'EX',
      active: true,
    });
    const [row] = await db.select().from(departments).where(eq(departments.id, response.json().id));
    expect(row?.branchId).toBe(s.branch.id);
    expect(row?.organizationId).toBe(s.organization.id);
  });

  it.each(['', 'EXAME', 'E-X', 'ÉX'])('recusa prefixo inválido %j', async (prefix) => {
    const s = await setup();

    const response = await create(s.ownerToken, { name: 'Exames', prefix });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors[0].field).toBe('prefix');
  });

  it('recusa prefixo repetido na filial', async () => {
    const s = await setup();

    const response = await create(s.ownerToken, { name: 'Outro', prefix: 'at' });

    expect(response.statusCode).toBe(409);
    expect(response.json().exception).toBe('DepartmentPrefixAlreadyExistsException');
  });

  it('oferece restaurar quando o prefixo é de um departamento excluído', async () => {
    const s = await setup();
    const created = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });
    await db
      .update(departments)
      .set({ deletedAt: new Date() })
      .where(eq(departments.id, created.json().id));

    const response = await create(s.ownerToken, { name: 'Exames 2', prefix: 'EX' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Já existe um departamento excluído com este prefixo. Deseja restaurá-lo?',
      statusCode: 409,
      exception: 'DeletedDepartmentExistsException',
      meta: { deletedId: created.json().id },
    });
  });

  it('permite o mesmo prefixo em outra organização', async () => {
    await setup();
    const other = await createOrganizationWithOwner(app, '2');

    const response = await create(other.ownerToken, { name: 'Exames', prefix: 'EX' });

    expect(response.statusCode).toBe(201);
  });

  it('respeita o limite de 5 por filial (inativos contam, excluídos não)', async () => {
    const s = await setup();
    // A filial já nasce com "Atendimento" (AT).
    for (const prefix of ['A1', 'A2', 'A3']) {
      expect((await create(s.ownerToken, { name: prefix, prefix })).statusCode).toBe(201);
    }
    const inactive = await create(s.ownerToken, { name: 'Inativo', prefix: 'IN' });
    await update(s.ownerToken, inactive.json().id, { active: false });

    const blocked = await create(s.ownerToken, { name: 'Sexto', prefix: 'S6' });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().exception).toBe('DepartmentLimitReachedException');

    await db
      .update(departments)
      .set({ deletedAt: new Date() })
      .where(eq(departments.id, inactive.json().id));
    expect((await create(s.ownerToken, { name: 'Sexto', prefix: 'S6' })).statusCode).toBe(201);
  });

  it('atendente não cria departamento', async () => {
    const s = await setup();

    const response = await create(s.attendant.token, { name: 'Exames', prefix: 'EX' });

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /departments', () => {
  it('OWNER vê todos os departamentos da filial, inclusive inativos, ordenados por nome', async () => {
    const s = await setup();
    await create(s.ownerToken, { name: 'Técnico', prefix: 'TEC' });
    const financeiro = await create(s.ownerToken, { name: 'Financeiro', prefix: 'FIN' });
    await update(s.ownerToken, financeiro.json().id, { active: false });

    const response = await list(s.ownerToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((d: { prefix: string }) => d.prefix)).toEqual([
      'AT',
      'FIN',
      'TEC',
    ]);
    expect(response.json()).toMatchObject({
      totalItems: 3,
      totalPages: 1,
      currentPage: 1,
      pageSize: 20,
      nextPage: null,
      previousPage: null,
    });
  });

  it('atendente vê apenas os departamentos ativos liberados para ele', async () => {
    const s = await setup();
    const tec = await create(s.ownerToken, { name: 'Técnico', prefix: 'TEC' });
    const fin = await create(s.ownerToken, { name: 'Financeiro', prefix: 'FIN' });
    await create(s.ownerToken, { name: 'Reparos', prefix: 'REP' });
    await db.insert(userDepartmentAccess).values([
      { userId: s.attendant.id, departmentId: tec.json().id },
      { userId: s.attendant.id, departmentId: fin.json().id },
    ]);
    await update(s.ownerToken, fin.json().id, { active: false });

    const response = await list(s.attendant.token);

    expect(response.json().data.map((d: { prefix: string }) => d.prefix)).toEqual(['TEC']);
    expect(response.json().totalItems).toBe(1);
  });

  it('não mostra departamentos de outra organização', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');
    await create(other.ownerToken, { name: 'Outra', prefix: 'OUT' });

    const response = await list(s.ownerToken);

    expect(response.json().data.map((d: { prefix: string }) => d.prefix)).toEqual(['AT']);
  });

  it('pagina os resultados', async () => {
    const s = await setup();
    for (const prefix of ['B', 'C', 'D']) {
      await create(s.ownerToken, { name: prefix, prefix });
    }

    const response = await list(s.ownerToken, '?page=2&pageSize=2');

    expect(response.json()).toMatchObject({
      totalItems: 4,
      totalPages: 2,
      currentPage: 2,
      pageSize: 2,
      nextPage: null,
      previousPage: 1,
    });
    expect(response.json().data).toHaveLength(2);
  });

  it('recusa pageSize acima de 100', async () => {
    const s = await setup();

    const response = await list(s.ownerToken, '?pageSize=101');

    expect(response.statusCode).toBe(400);
  });
});

describe('PATCH /departments/:id', () => {
  it('altera nome e desativa', async () => {
    const s = await setup();
    const created = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });

    const response = await update(s.ownerToken, created.json().id, {
      name: 'Exames Laboratoriais',
      active: false,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Exames Laboratoriais',
      prefix: 'EX',
      active: false,
    });
  });

  it('não permite alterar o prefixo', async () => {
    const s = await setup();
    const created = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });

    const response = await update(s.ownerToken, created.json().id, { prefix: 'EXA' });

    expect(response.statusCode).toBe(400);
  });

  it('exige ao menos um campo', async () => {
    const s = await setup();
    const created = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });

    const response = await update(s.ownerToken, created.json().id, {});

    expect(response.statusCode).toBe(400);
  });

  it('não encontra departamento de outra organização nem excluído', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');
    const foreign = await create(other.ownerToken, { name: 'Outra', prefix: 'OUT' });
    const deleted = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });
    await db
      .update(departments)
      .set({ deletedAt: new Date() })
      .where(eq(departments.id, deleted.json().id));

    expect((await update(s.ownerToken, foreign.json().id, { name: 'X' })).statusCode).toBe(404);
    expect((await update(s.ownerToken, deleted.json().id, { name: 'X' })).statusCode).toBe(404);
  });

  it('atendente não edita departamento', async () => {
    const s = await setup();
    const created = await create(s.ownerToken, { name: 'Exames', prefix: 'EX' });

    const response = await update(s.attendant.token, created.json().id, { name: 'X' });

    expect(response.statusCode).toBe(403);
  });
});

it('rotas de departamentos aparecem no OpenAPI com bearerAuth', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
  const paths = response.json().paths;

  expect(paths['/departments']?.post?.security).toEqual([{ bearerAuth: [] }]);
  expect(paths['/departments']?.get?.tags).toEqual(['Departments']);
  expect(paths['/departments/{id}']?.patch?.responses?.['404']).toBeDefined();
});
