import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { servicePoints, userDepartmentAccess } from '../../shared/database/schema/index.js';

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
  const department = await app.inject({
    method: 'POST',
    url: '/departments',
    headers: bearer(org.ownerToken),
    payload: { name: 'Técnico', prefix: 'TEC' },
  });
  return { ...org, attendant, departmentId: department.json().id as string };
}

function createServicePoint(token: string, name: string) {
  return app.inject({
    method: 'POST',
    url: '/service-points',
    headers: bearer(token),
    payload: { name },
  });
}

function associate(token: string, departmentId: string, servicePointId: string) {
  return app.inject({
    method: 'POST',
    url: `/departments/${departmentId}/service-points`,
    headers: bearer(token),
    payload: { servicePointId },
  });
}

function listInDepartment(token: string, departmentId: string) {
  return app.inject({
    method: 'GET',
    url: `/departments/${departmentId}/service-points`,
    headers: bearer(token),
  });
}

describe('POST /service-points', () => {
  it('cria guichê na filial', async () => {
    const s = await setup();

    const response = await createServicePoint(s.ownerToken, ' Balcão 1 ');

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: expect.any(String), name: 'Balcão 1', active: true });
    const [row] = await db
      .select()
      .from(servicePoints)
      .where(eq(servicePoints.id, response.json().id));
    expect(row?.branchId).toBe(s.branch.id);
  });

  it('permite nomes repetidos', async () => {
    const s = await setup();
    await createServicePoint(s.ownerToken, 'Balcão 1');

    const response = await createServicePoint(s.ownerToken, 'Balcão 1');

    expect(response.statusCode).toBe(201);
  });

  it('atendente não cria guichê', async () => {
    const s = await setup();

    expect((await createServicePoint(s.attendant.token, 'Balcão 1')).statusCode).toBe(403);
  });
});

describe('PATCH /service-points/:id', () => {
  it('altera nome e desativa', async () => {
    const s = await setup();
    const created = await createServicePoint(s.ownerToken, 'Balcão 1');

    const response = await app.inject({
      method: 'PATCH',
      url: `/service-points/${created.json().id}`,
      headers: bearer(s.ownerToken),
      payload: { name: 'Balcão Principal', active: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Balcão Principal', active: false });
  });

  it('não encontra guichê de outra organização', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');
    const foreign = await createServicePoint(other.ownerToken, 'Balcão X');

    const response = await app.inject({
      method: 'PATCH',
      url: `/service-points/${foreign.json().id}`,
      headers: bearer(s.ownerToken),
      payload: { name: 'Meu' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('ServicePointNotFoundException');
  });
});

describe('POST /departments/:departmentId/service-points', () => {
  it('associa guichê ao departamento', async () => {
    const s = await setup();
    const sp = await createServicePoint(s.ownerToken, 'Balcão 1');

    const response = await associate(s.ownerToken, s.departmentId, sp.json().id);

    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Balcão 1');
  });

  it('o mesmo guichê pode atender vários departamentos', async () => {
    const s = await setup();
    const sp = await createServicePoint(s.ownerToken, 'Balcão 1');
    const other = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(s.ownerToken),
      payload: { name: 'Financeiro', prefix: 'FIN' },
    });

    expect((await associate(s.ownerToken, s.departmentId, sp.json().id)).statusCode).toBe(201);
    expect((await associate(s.ownerToken, other.json().id, sp.json().id)).statusCode).toBe(201);
  });

  it('recusa associação repetida', async () => {
    const s = await setup();
    const sp = await createServicePoint(s.ownerToken, 'Balcão 1');
    await associate(s.ownerToken, s.departmentId, sp.json().id);

    const response = await associate(s.ownerToken, s.departmentId, sp.json().id);

    expect(response.statusCode).toBe(409);
    expect(response.json().exception).toBe('ServicePointAlreadyAssociatedException');
  });

  it('respeita o limite de 10 guichês por departamento (excluídos não contam)', async () => {
    const s = await setup();
    const ids: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const sp = await createServicePoint(s.ownerToken, `Balcão ${i}`);
      ids.push(sp.json().id);
      expect((await associate(s.ownerToken, s.departmentId, sp.json().id)).statusCode).toBe(201);
    }
    const extra = await createServicePoint(s.ownerToken, 'Balcão 11');

    const blocked = await associate(s.ownerToken, s.departmentId, extra.json().id);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().exception).toBe('ServicePointLimitReachedException');

    await db
      .update(servicePoints)
      .set({ deletedAt: new Date() })
      .where(eq(servicePoints.id, ids[0]!));
    expect((await associate(s.ownerToken, s.departmentId, extra.json().id)).statusCode).toBe(201);
  });

  it('recusa guichê ou departamento de outra organização', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');
    const foreignSp = await createServicePoint(other.ownerToken, 'Balcão X');
    const mySp = await createServicePoint(s.ownerToken, 'Balcão 1');
    const foreignDept = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(other.ownerToken),
      payload: { name: 'Outro', prefix: 'OUT' },
    });

    const wrongSp = await associate(s.ownerToken, s.departmentId, foreignSp.json().id);
    const wrongDept = await associate(s.ownerToken, foreignDept.json().id, mySp.json().id);

    expect(wrongSp.statusCode).toBe(404);
    expect(wrongSp.json().exception).toBe('ServicePointNotFoundException');
    expect(wrongDept.statusCode).toBe(404);
    expect(wrongDept.json().exception).toBe('DepartmentNotFoundException');
  });

  it('atendente não associa guichê', async () => {
    const s = await setup();
    const sp = await createServicePoint(s.ownerToken, 'Balcão 1');

    expect((await associate(s.attendant.token, s.departmentId, sp.json().id)).statusCode).toBe(403);
  });
});

describe('GET /departments/:departmentId/service-points', () => {
  async function withTwoServicePoints() {
    const s = await setup();
    const b1 = await createServicePoint(s.ownerToken, 'Balcão 2');
    const b2 = await createServicePoint(s.ownerToken, 'Balcão 1');
    await associate(s.ownerToken, s.departmentId, b1.json().id);
    await associate(s.ownerToken, s.departmentId, b2.json().id);
    await app.inject({
      method: 'PATCH',
      url: `/service-points/${b1.json().id}`,
      headers: bearer(s.ownerToken),
      payload: { active: false },
    });
    return s;
  }

  it('OWNER vê todos os guichês do departamento, ordenados por nome', async () => {
    const s = await withTwoServicePoints();

    const response = await listInDepartment(s.ownerToken, s.departmentId);

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((sp: { name: string }) => sp.name)).toEqual([
      'Balcão 1',
      'Balcão 2',
    ]);
  });

  it('atendente com acesso vê apenas os guichês ativos', async () => {
    const s = await withTwoServicePoints();
    await db
      .insert(userDepartmentAccess)
      .values({ userId: s.attendant.id, departmentId: s.departmentId });

    const response = await listInDepartment(s.attendant.token, s.departmentId);

    expect(response.json().data.map((sp: { name: string }) => sp.name)).toEqual(['Balcão 1']);
  });

  it('atendente sem acesso ao departamento recebe 404', async () => {
    const s = await withTwoServicePoints();

    const response = await listInDepartment(s.attendant.token, s.departmentId);

    expect(response.statusCode).toBe(404);
  });
});
