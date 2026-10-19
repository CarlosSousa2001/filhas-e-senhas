import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { departments, ticketHistory, tickets } from '../../shared/database/schema/index.js';
import { getServiceDate } from '../../shared/utils/date.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

async function setup() {
  const org = await createOrganizationWithOwner(app);
  const base = {
    organizationId: org.organization.id,
    organizationSlug: org.organization.slug,
    branchId: org.branch.id,
  };
  const attendant = await createUserAndLogin(app, {
    ...base,
    role: 'ATTENDANT',
    username: 'ana.balcao1',
  });
  const viewer = await createUserAndLogin(app, { ...base, role: 'VIEWER', username: 'tv.salao' });
  const created = [];
  for (const department of [
    { name: 'Técnico', prefix: 'TEC' },
    { name: 'Financeiro', prefix: 'FIN' },
    { name: 'Reparos', prefix: 'REP' },
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(org.ownerToken),
      payload: department,
    });
    created.push(response.json() as { id: string; prefix: string; name: string });
  }
  return { ...org, attendant, viewer, departments: created };
}

function createTicket(token: string, departmentId: string) {
  return app.inject({
    method: 'POST',
    url: '/tickets',
    headers: bearer(token),
    payload: { departmentId },
  });
}

describe('POST /tickets', () => {
  it('gera senhas para os 3 departamentos', async () => {
    const s = await setup();

    for (const department of s.departments) {
      const response = await createTicket(s.attendant.token, department.id);

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.code).toMatch(new RegExp(`^${department.prefix}-[A-Z0-9]{7}$`));
      expect(body).toMatchObject({
        status: 'WAITING',
        department: { id: department.id, name: department.name, prefix: department.prefix },
      });
    }
  });

  it('grava o dia de São Paulo, o mesmo instante em created_at e o evento CREATED', async () => {
    const s = await setup();
    const before = new Date();

    const response = await createTicket(s.attendant.token, s.departments[0]!.id);

    const body = response.json();
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, body.id));
    expect(ticket).toMatchObject({
      organizationId: s.organization.id,
      branchId: s.branch.id,
      departmentId: s.departments[0]!.id,
      status: 'WAITING',
      serviceDate: getServiceDate(ticket!.createdAt),
    });
    expect(ticket!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(body.serviceDate).toBe(ticket!.serviceDate);
    expect(body.createdAt).toBe(ticket!.createdAt.toISOString());

    const history = await db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, body.id));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      eventType: 'CREATED',
      actorUserId: s.attendant.id,
      createdAt: ticket!.createdAt,
    });
  });

  it('o atendente gera para qualquer departamento ativo, mesmo sem acesso liberado', async () => {
    const s = await setup();

    // O atendente não tem nenhum user_department_access.
    const response = await createTicket(s.attendant.token, s.departments[1]!.id);

    expect(response.statusCode).toBe(201);
  });

  it('VIEWER não gera senha', async () => {
    const s = await setup();

    const response = await createTicket(s.viewer.token, s.departments[0]!.id);

    expect(response.statusCode).toBe(403);
  });

  it('departamento inativo, excluído ou de outra organização → 404', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');
    const foreign = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(other.ownerToken),
      payload: { name: 'Outro', prefix: 'OUT' },
    });
    await db
      .update(departments)
      .set({ active: false })
      .where(eq(departments.id, s.departments[0]!.id));
    await db
      .update(departments)
      .set({ deletedAt: new Date() })
      .where(eq(departments.id, s.departments[1]!.id));

    for (const departmentId of [s.departments[0]!.id, s.departments[1]!.id, foreign.json().id]) {
      const response = await createTicket(s.attendant.token, departmentId);
      expect(response.statusCode).toBe(404);
      expect(response.json().exception).toBe('DepartmentNotFoundException');
    }
    expect(await db.select().from(tickets)).toHaveLength(0);
  });

  it('licença vencida bloqueia a geração', async () => {
    const s = await setup();
    const { licenses } = await import('../../shared/database/schema/index.js');
    await db
      .update(licenses)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(licenses.organizationId, s.organization.id));

    const response = await createTicket(s.attendant.token, s.departments[0]!.id);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('LicenseInactiveException');
  });

  it('valida o departmentId', async () => {
    const s = await setup();

    expect((await createTicket(s.attendant.token, 'abc')).statusCode).toBe(400);
  });
});

describe('GET /tickets/departments', () => {
  it('lista todos os departamentos ativos da filial, ordenados por nome', async () => {
    const s = await setup();
    await db
      .update(departments)
      .set({ active: false })
      .where(eq(departments.id, s.departments[2]!.id));

    const response = await app.inject({
      method: 'GET',
      url: '/tickets/departments',
      headers: bearer(s.attendant.token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      { id: expect.any(String), name: 'Atendimento', prefix: 'AT' },
      { id: s.departments[1]!.id, name: 'Financeiro', prefix: 'FIN' },
      { id: s.departments[0]!.id, name: 'Técnico', prefix: 'TEC' },
    ]);
  });

  it('VIEWER não acessa', async () => {
    const s = await setup();

    const response = await app.inject({
      method: 'GET',
      url: '/tickets/departments',
      headers: bearer(s.viewer.token),
    });

    expect(response.statusCode).toBe(403);
  });
});
