import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { verifyPassword } from '../../shared/auth/password.js';
import { users } from '../../shared/database/schema/index.js';

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
  const admin = await createUserAndLogin(app, { ...base, role: 'ADMIN', username: 'admin.0001' });
  const attendant = await createUserAndLogin(app, {
    ...base,
    role: 'ATTENDANT',
    username: 'gabriel.4821',
  });
  return { ...org, admin, attendant };
}

function resetPassword(token: string, userId: string, newPassword = 'senha-redefinida') {
  return app.inject({
    method: 'PATCH',
    url: `/users/${userId}/password`,
    headers: bearer(token),
    payload: { newPassword },
  });
}

async function passwordMatches(userId: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return verifyPassword(user!.passwordHash, password);
}

describe('PATCH /users/:userId/password', () => {
  it('OWNER redefine a senha de um funcionário e derruba as sessões dele', async () => {
    const s = await setup();

    const response = await resetPassword(s.ownerToken, s.attendant.id);

    expect(response.statusCode).toBe(204);
    expect(await passwordMatches(s.attendant.id, 'senha-redefinida')).toBe(true);
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: bearer(s.attendant.token),
    });
    expect(me.statusCode).toBe(401);
  });

  it('ADMIN redefine a senha de um funcionário', async () => {
    const s = await setup();

    const response = await resetPassword(s.admin.token, s.attendant.id);

    expect(response.statusCode).toBe(204);
  });

  it('ADMIN não redefine a senha do OWNER', async () => {
    const s = await setup();

    const response = await resetPassword(s.admin.token, s.owner.id);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('ForbiddenException');
  });

  it('funcionário não redefine senha de ninguém', async () => {
    const s = await setup();

    const response = await resetPassword(s.attendant.token, s.admin.id);

    expect(response.statusCode).toBe(403);
  });

  it('não encontra usuário de outra organização', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');

    const response = await resetPassword(s.ownerToken, other.owner.id);

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('UserNotFoundException');
  });

  it('não encontra usuário excluído', async () => {
    const s = await setup();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, s.attendant.id));

    const response = await resetPassword(s.ownerToken, s.attendant.id);

    expect(response.statusCode).toBe(404);
  });

  it('valida o id e a política de senha', async () => {
    const s = await setup();

    const invalidId = await resetPassword(s.ownerToken, 'abc');
    const shortPassword = await resetPassword(s.ownerToken, s.attendant.id, 'curta');

    expect(invalidId.statusCode).toBe(400);
    expect(shortPassword.statusCode).toBe(400);
    expect(shortPassword.json().errors[0].field).toBe('newPassword');
  });
});
