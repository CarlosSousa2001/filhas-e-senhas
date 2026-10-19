import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { ticketHistory, tickets } from '../../shared/database/schema/index.js';

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
  const department = await app.inject({
    method: 'POST',
    url: '/departments',
    headers: bearer(org.ownerToken),
    payload: { name: 'Técnico', prefix: 'TEC' },
  });
  const ticket = await app.inject({
    method: 'POST',
    url: '/tickets',
    headers: bearer(attendant.token),
    payload: { departmentId: department.json().id },
  });
  return { ...org, attendant, viewer, ticketId: ticket.json().id as string };
}

function cancel(token: string, ticketId: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/tickets/${ticketId}/cancel`,
    headers: bearer(token),
    ...(payload === undefined ? {} : { payload }),
  });
}

describe('POST /tickets/:id/cancel', () => {
  it('cancela uma senha aguardando, com motivo e evento no histórico', async () => {
    const s = await setup();

    const response = await cancel(s.attendant.token, s.ticketId, {
      reason: ' Cliente desistiu ',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: s.ticketId, status: 'CANCELLED' });
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, s.ticketId));
    expect(ticket).toMatchObject({ status: 'CANCELLED', cancelReason: 'Cliente desistiu' });
    const history = await db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, s.ticketId));
    expect(history.map((h) => h.eventType)).toEqual(['CREATED', 'CANCELLED']);
    expect(history[1]).toMatchObject({
      actorUserId: s.attendant.id,
      metadata: { reason: 'Cliente desistiu' },
    });
  });

  it('cancela sem body e sem motivo', async () => {
    const s = await setup();

    const response = await cancel(s.attendant.token, s.ticketId);

    expect(response.statusCode).toBe(200);
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, s.ticketId));
    expect(ticket?.cancelReason).toBeNull();
  });

  it('cancela uma senha em atendimento', async () => {
    const s = await setup();
    await db.update(tickets).set({ status: 'IN_SERVICE' }).where(eq(tickets.id, s.ticketId));

    expect((await cancel(s.ownerToken, s.ticketId)).statusCode).toBe(200);
  });

  it.each(['FINISHED', 'NO_SHOW', 'CANCELLED', 'EXPIRED'] as const)(
    'recusa cancelar senha %s',
    async (status) => {
      const s = await setup();
      await db.update(tickets).set({ status }).where(eq(tickets.id, s.ticketId));

      const response = await cancel(s.attendant.token, s.ticketId);

      expect(response.statusCode).toBe(409);
      expect(response.json().exception).toBe('InvalidTicketStatusException');
    },
  );

  it('cancelar duas vezes: a segunda recebe 409', async () => {
    const s = await setup();

    const [first, second] = await Promise.all([
      cancel(s.attendant.token, s.ticketId),
      cancel(s.ownerToken, s.ticketId),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    const history = await db
      .select()
      .from(ticketHistory)
      .where(eq(ticketHistory.ticketId, s.ticketId));
    expect(history.filter((h) => h.eventType === 'CANCELLED')).toHaveLength(1);
  });

  it('VIEWER não cancela', async () => {
    const s = await setup();

    expect((await cancel(s.viewer.token, s.ticketId)).statusCode).toBe(403);
  });

  it('senha de outra organização → 404', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');

    const response = await cancel(other.ownerToken, s.ticketId);

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('TicketNotFoundException');
  });

  it('motivo com mais de 100 caracteres → 400', async () => {
    const s = await setup();

    const response = await cancel(s.attendant.token, s.ticketId, { reason: 'x'.repeat(101) });

    expect(response.statusCode).toBe(400);
  });
});
