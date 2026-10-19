import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import * as passwordAuth from '../../shared/auth/password.js';
import { branches, licenses, organizations, users } from '../../shared/database/schema/index.js';
import type { JwtPayload } from '../../shared/auth/jwt.js';
import type { AuthResponse } from './auth.types.js';

let app: Awaited<ReturnType<typeof createTestApp>>;
let owner: typeof users.$inferSelect;
let employee: typeof users.$inferSelect;
let branch: typeof branches.$inferSelect;
const password = 'senha-segura';
const email = 'carlos@example.com';
const organizationSlug = 'nen-protocol-system';
const invalidCredentials = {
  message: 'Credenciais inválidas',
  statusCode: 401,
  exception: 'InvalidCredentialsException',
};

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await resetDatabase();
  const registration = await app.inject({
    method: 'POST',
    url: '/organizations',
    payload: {
      organizationName: 'Nen Protocol System',
      document: '12345678000190',
      ownerName: 'Carlos Sousa',
      phone: '11987654321',
      email,
      password,
      passwordConfirmation: password,
      acceptedTerms: true,
    },
  });
  expect(registration.statusCode).toBe(201);
  [owner] = (await db.select().from(users)) as [typeof owner];
  [branch] = (await db.select().from(branches)) as [typeof branch];
  [employee] = (await db
    .insert(users)
    .values({
      organizationId: owner.organizationId,
      branchId: branch.id,
      name: 'Ana Silva',
      username: 'ana.1234',
      email: 'ana@example.com',
      role: 'ATTENDANT',
      passwordHash: owner.passwordHash,
    })
    .returning()) as [typeof employee];
});
afterEach(() => {
  vi.restoreAllMocks();
});

function login(payload: Record<string, unknown> = { email, password }) {
  return app.inject({ method: 'POST', url: '/auth/login', payload });
}

it.each(['OWNER', 'ATTENDANT', 'ADMIN'] as const)(
  'loga %s com Matriz e JWT HS256 de 8h',
  async (role) => {
    if (role === 'ADMIN') {
      await db.update(users).set({ role, branchId: null }).where(eq(users.id, employee.id));
    }
    const user = role === 'OWNER' ? owner : employee;
    const response = await login(
      role === 'OWNER'
        ? { email, password }
        : { organizationSlug, username: user.username, password },
    );
    expect(response.statusCode).toBe(200);
    const result = response.json<AuthResponse>();
    const [license] = await db.select().from(licenses);
    expect(result).toEqual({
      accessToken: expect.any(String),
      user: { id: user.id, name: user.name, username: user.username, role },
      organization: {
        id: owner.organizationId,
        name: 'Nen Protocol System',
        slug: organizationSlug,
      },
      branch: { id: branch.id, name: 'Matriz' },
      license: { status: 'ACTIVE', expiresAt: license!.expiresAt.toISOString(), valid: true },
    });
    const decoded = app.jwt.decode<JwtPayload & { iat: number; exp: number }>(result.accessToken)!;
    expect(decoded).toEqual({
      userId: user.id,
      organizationId: owner.organizationId,
      branchId: branch.id,
      role,
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60);
    expect(Math.abs(decoded.iat - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(1);
    expect(app.jwt.verify(result.accessToken)).toEqual(decoded);
    expect(
      JSON.parse(Buffer.from(result.accessToken.split('.')[0]!, 'base64url').toString()),
    ).toMatchObject({ alg: 'HS256' });
  },
);

it('permite OWNER pelo slug e normaliza e-mail, slug e username', async () => {
  expect((await login({ email: `  ${email.toUpperCase()}  `, password })).statusCode).toBe(200);
  for (const user of [owner, employee]) {
    const response = await login({
      organizationSlug: ` ${organizationSlug.toUpperCase()} `,
      username: ` ${user.username.toUpperCase()} `,
      password,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<AuthResponse>().user.id).toBe(user.id);
  }
});

it.each([
  { email, password: 'senha-errada' },
  { email: 'ausente@example.com', password },
  { email: 'ana@example.com', password },
  { organizationSlug, username: 'ana.1234', password: 'senha-errada' },
  { organizationSlug, username: 'ausente', password },
  { organizationSlug: 'inexistente', username: 'ana.1234', password },
])('retorna a mesma resposta para credenciais inválidas: %j', async (payload) => {
  const verify = vi.spyOn(passwordAuth, 'verifyPassword');
  const response = await login(payload);
  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual(invalidCredentials);
  expect(verify).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/^\$argon2id\$/),
    payload.password,
  );
});

it.each(['inactive', 'deleted'] as const)(
  'rejeita usuário %s somente com senha correta',
  async (state) => {
    await db
      .update(users)
      .set(state === 'inactive' ? { active: false } : { deletedAt: new Date() });
    for (const payload of [
      { email, password },
      { organizationSlug, username: employee.username, password },
    ]) {
      const response = await login(payload);
      expect(response.statusCode).toBe(403);
      expect(response.json().exception).toBe('UserInactiveException');
      expect((await login({ ...payload, password: 'senha-errada' })).json()).toEqual(
        invalidCredentials,
      );
    }
  },
);

it.each(['inactive', 'deleted'] as const)(
  'rejeita organização %s somente com senha correta',
  async (state) => {
    await db
      .update(organizations)
      .set(state === 'inactive' ? { active: false } : { deletedAt: new Date() });
    for (const payload of [
      { email, password },
      { organizationSlug, username: employee.username, password },
    ]) {
      const response = await login(payload);
      expect(response.statusCode).toBe(403);
      expect(response.json().exception).toBe('OrganizationInactiveException');
      expect((await login({ ...payload, password: 'senha-errada' })).json()).toEqual(
        invalidCredentials,
      );
    }
  },
);

it.each(['inactive', 'deleted'] as const)('rejeita Matriz %s', async (state) => {
  await db
    .update(branches)
    .set(state === 'inactive' ? { active: false } : { deletedAt: new Date() });
  const response = await login();
  expect(response.statusCode).toBe(403);
  expect(response.json().exception).toBe('BranchInactiveException');
});

it.each(['ACTIVE', 'EXPIRED', 'CANCELLED'] as const)(
  'permite licença inválida com status %s',
  async (status) => {
    const expiresAt = new Date(Date.now() + (status === 'ACTIVE' ? -60_000 : 60_000));
    await db.update(licenses).set({ status, expiresAt });
    const response = await login();
    expect(response.statusCode).toBe(200);
    expect(response.json<AuthResponse>().license).toEqual({
      status,
      expiresAt: expiresAt.toISOString(),
      valid: false,
    });
  },
);

it('considera inválida a licença que vence exatamente agora', async () => {
  const now = new Date();
  await db.update(licenses).set({ expiresAt: now });
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
  const response = await login();
  expect(response.statusCode).toBe(200);
  expect(response.json<AuthResponse>().license.valid).toBe(false);
});

it.each([
  { email, organizationSlug, username: 'ana.1234', password },
  { email, password, extra: true },
  { organizationSlug, username: 'ana.1234', password, extra: true },
  { username: 'ana.1234', password },
  {},
  { email, password: 'a'.repeat(129) },
])('rejeita body ambíguo, extra ou inválido: %j', async (payload) => {
  const response = await login(payload);
  expect(response.statusCode).toBe(400);
  expect(response.json().exception).toBe('ValidationException');
});

it('não permite usar username de outra organização', async () => {
  const [other] = await db
    .insert(organizations)
    .values({
      name: 'Outra',
      slug: 'outra',
      document: '12345678901',
      contactEmail: 'outra@example.com',
      contactPhone: '11987654321',
      termsAcceptedAt: new Date(),
      termsVersion: '2026-10',
    })
    .returning();
  expect(
    (await login({ organizationSlug: other!.slug, username: employee.username, password })).json(),
  ).toEqual(invalidCredentials);
});

it('documenta união estrita e respostas no Scalar', async () => {
  const spec = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
  expect(spec.statusCode).toBe(200);
  const operation = spec.json().paths['/auth/login'].post;
  expect(operation.tags).toEqual(['Auth']);
  expect(Object.keys(operation.responses)).toEqual(['200', '400', '401', '403']);
  const alternatives = operation.requestBody.content['application/json'].schema.anyOf;
  expect(alternatives).toHaveLength(2);
  expect(alternatives[0]).toMatchObject({
    additionalProperties: false,
    required: ['email', 'password'],
  });
  expect(alternatives[1]).toMatchObject({
    additionalProperties: false,
    required: ['organizationSlug', 'username', 'password'],
  });
  expect(
    Object.keys(operation.responses['200'].content['application/json'].schema.properties),
  ).toEqual(['accessToken', 'user', 'organization', 'branch', 'license']);
  for (const status of ['400', '401', '403']) {
    expect(
      operation.responses[status].content['application/json'].schema.properties,
    ).toHaveProperty('exception');
  }
  const docs = await app.inject({ method: 'GET', url: '/docs/' });
  expect(docs.statusCode).toBe(200);
});
