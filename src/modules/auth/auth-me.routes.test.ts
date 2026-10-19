import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { licenses, users } from '../../shared/database/schema/index.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

async function signupAndLogin() {
  const signup = await app.inject({
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
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'carlos@example.com', password: 'senha-segura' },
  });
  const { accessToken, ...loginWithoutToken } = login.json();
  return { signup: signup.json(), accessToken: accessToken as string, loginWithoutToken };
}

function me(token?: string) {
  return app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /auth/me', () => {
  it('devolve o mesmo formato do login, sem o token', async () => {
    const { accessToken, loginWithoutToken } = await signupAndLogin();

    const response = await me(accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(loginWithoutToken);
    expect(response.json()).not.toHaveProperty('accessToken');
    expect(response.json().organization.slug).toBe('nen-protocol-system');
  });

  it('continua respondendo com a licença vencida, com valid = false', async () => {
    const { signup, accessToken } = await signupAndLogin();
    await db
      .update(licenses)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(licenses.organizationId, signup.organization.id));

    const response = await me(accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().license.valid).toBe(false);
  });

  it('reflete os dados atuais do banco', async () => {
    const { signup, accessToken } = await signupAndLogin();
    await db.update(users).set({ name: 'Carlos S.' }).where(eq(users.id, signup.owner.id));

    const response = await me(accessToken);

    expect(response.json().user.name).toBe('Carlos S.');
  });

  it('exige autenticação', async () => {
    const response = await me();

    expect(response.statusCode).toBe(401);
    expect(response.json().exception).toBe('UnauthorizedException');
  });

  it('bloqueia usuário desativado', async () => {
    const { signup, accessToken } = await signupAndLogin();
    await db.update(users).set({ active: false }).where(eq(users.id, signup.owner.id));

    const response = await me(accessToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('UserInactiveException');
  });

  it('aparece documentada no OpenAPI com autenticação bearer', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
    const operation = response.json().paths['/auth/me']?.get;

    expect(operation?.tags).toEqual(['Auth']);
    expect(operation?.security).toEqual([{ bearerAuth: [] }]);
  });
});
