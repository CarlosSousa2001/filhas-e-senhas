import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { OWNER_PASSWORD, bearer, createOrganizationWithOwner } from '../../../test/fixtures.js';
import { verifyPassword } from '../../shared/auth/password.js';
import { users } from '../../shared/database/schema/index.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

function changePassword(token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: '/auth/password', headers: bearer(token), payload });
}

describe('PATCH /auth/password', () => {
  it('troca a senha e devolve um token novo que continua funcionando', async () => {
    const { owner, ownerToken } = await createOrganizationWithOwner(app);

    const response = await changePassword(ownerToken, {
      currentPassword: OWNER_PASSWORD,
      newPassword: 'nova-senha-123',
    });

    expect(response.statusCode).toBe(200);
    const { accessToken } = response.json();
    const [user] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(await verifyPassword(user!.passwordHash, 'nova-senha-123')).toBe(true);

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(accessToken) });
    expect(me.statusCode).toBe(200);
  });

  it('derruba os tokens anteriores', async () => {
    const { ownerToken } = await createOrganizationWithOwner(app);

    await changePassword(ownerToken, {
      currentPassword: OWNER_PASSWORD,
      newPassword: 'nova-senha-123',
    });

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(ownerToken) });
    expect(me.statusCode).toBe(401);
  });

  it('permite login com a senha nova e recusa a antiga', async () => {
    const { ownerToken } = await createOrganizationWithOwner(app);
    await changePassword(ownerToken, {
      currentPassword: OWNER_PASSWORD,
      newPassword: 'nova-senha-123',
    });

    const login = (password: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'dono1@example.com', password },
      });

    expect((await login('nova-senha-123')).statusCode).toBe(200);
    expect((await login(OWNER_PASSWORD)).statusCode).toBe(401);
  });

  it('responde 400 com a senha atual errada', async () => {
    const { ownerToken } = await createOrganizationWithOwner(app);

    const response = await changePassword(ownerToken, {
      currentPassword: 'errada',
      newPassword: 'nova-senha-123',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Senha atual incorreta',
      statusCode: 400,
      exception: 'InvalidCurrentPasswordException',
    });
  });

  it('valida a política da senha nova', async () => {
    const { ownerToken } = await createOrganizationWithOwner(app);

    const response = await changePassword(ownerToken, {
      currentPassword: OWNER_PASSWORD,
      newPassword: 'curta',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toEqual([
      { field: 'newPassword', message: 'A senha deve ter pelo menos 8 caracteres' },
    ]);
  });

  it('exige autenticação', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      payload: { currentPassword: OWNER_PASSWORD, newPassword: 'nova-senha-123' },
    });

    expect(response.statusCode).toBe(401);
  });
});
