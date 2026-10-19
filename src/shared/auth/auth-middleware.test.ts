import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { branches, licenses, organizations, users } from '../database/schema/index.js';
import { authenticate, authMiddleware, requireBranch, requireRole } from './auth-middleware.js';
import type { JwtPayload } from './jwt.js';
import { hashPassword } from './password.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp((testApp) => {
    testApp.get('/test/protected', { preHandler: [authMiddleware] }, async (request) => ({
      user: request.user,
    }));
    testApp.get(
      '/test/allow-invalid-license',
      { preHandler: [authenticate({ allowInvalidLicense: true })] },
      async () => ({ ok: true }),
    );
    testApp.get('/test/branch', { preHandler: [authMiddleware, requireBranch] }, async () => ({
      ok: true,
    }));
    testApp.get(
      '/test/owner-only',
      { preHandler: [authMiddleware, requireRole('OWNER')] },
      async () => ({ ok: true }),
    );
  });
});

beforeEach(resetDatabase);

type Setup = {
  organizationId: string;
  branchId: string;
  ownerId: string;
  ownerToken: string;
  attendantId: string;
  attendantToken: string;
};

async function setup(): Promise<Setup> {
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
  const { organization, owner, branch } = signup.json();

  // Garante que o token emitido no login seja posterior ao password_changed_at.
  const past = new Date(Date.now() - 60_000);
  await db.update(users).set({ passwordChangedAt: past }).where(eq(users.id, owner.id));

  const [attendant] = await db
    .insert(users)
    .values({
      organizationId: organization.id,
      branchId: branch.id,
      name: 'Gabriel Silva',
      username: 'gabriel.4821',
      passwordHash: await hashPassword('senha-atendente'),
      passwordChangedAt: past,
      role: 'ATTENDANT',
    })
    .returning({ id: users.id });

  const ownerLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'carlos@example.com', password: 'senha-segura' },
  });
  const attendantLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      organizationSlug: organization.slug,
      username: 'gabriel.4821',
      password: 'senha-atendente',
    },
  });

  return {
    organizationId: organization.id,
    branchId: branch.id,
    ownerId: owner.id,
    ownerToken: ownerLogin.json().accessToken,
    attendantId: attendant!.id,
    attendantToken: attendantLogin.json().accessToken,
  };
}

function get(url: string, token?: string) {
  return app.inject({
    method: 'GET',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function sign(payload: JwtPayload, options: { expiresIn?: string | number } = {}) {
  return app.jwt.sign(payload, options);
}

describe('authMiddleware', () => {
  it('preenche request.user com organização, filial do token e role do banco', async () => {
    const s = await setup();

    const response = await get('/test/protected', s.ownerToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({
      userId: s.ownerId,
      organizationId: s.organizationId,
      branchId: s.branchId,
      role: 'OWNER',
    });
  });

  it.each([
    ['sem token', undefined],
    ['token malformado', 'abc.def.ghi'],
  ])('responde 401 %s', async (_case, token) => {
    const response = await get('/test/protected', token);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      message: 'Não autenticado',
      statusCode: 401,
      exception: 'UnauthorizedException',
    });
  });

  it('responde 401 para token expirado', async () => {
    const s = await setup();
    const expired = sign(
      { userId: s.ownerId, organizationId: s.organizationId, branchId: s.branchId, role: 'OWNER' },
      { expiresIn: -10 },
    );

    const response = await get('/test/protected', expired);

    expect(response.statusCode).toBe(401);
  });

  it('responde 401 para token assinado com outro segredo', async () => {
    const s = await setup();
    const [header, payload] = s.ownerToken.split('.');
    const forged = `${header}.${payload}.assinatura-invalida`;

    const response = await get('/test/protected', forged);

    expect(response.statusCode).toBe(401);
  });

  it('responde 401 quando o usuário do token não existe', async () => {
    const s = await setup();
    const token = sign({
      userId: '00000000-0000-4000-8000-000000000000',
      organizationId: s.organizationId,
      branchId: s.branchId,
      role: 'OWNER',
    });

    const response = await get('/test/protected', token);

    expect(response.statusCode).toBe(401);
  });

  it('responde 401 quando a organização do token não é a do usuário', async () => {
    const s = await setup();
    const token = sign({
      userId: s.ownerId,
      organizationId: '00000000-0000-4000-8000-000000000000',
      branchId: s.branchId,
      role: 'OWNER',
    });

    const response = await get('/test/protected', token);

    expect(response.statusCode).toBe(401);
  });

  it('recusa token emitido antes da última troca de senha', async () => {
    const s = await setup();
    await db
      .update(users)
      .set({ passwordChangedAt: new Date(Date.now() + 5_000) })
      .where(eq(users.id, s.ownerId));

    const response = await get('/test/protected', s.ownerToken);

    expect(response.statusCode).toBe(401);
  });

  it('bloqueia usuário desativado com token válido', async () => {
    const s = await setup();
    await db.update(users).set({ active: false }).where(eq(users.id, s.attendantId));

    const response = await get('/test/protected', s.attendantToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('UserInactiveException');
  });

  it('bloqueia usuário excluído com token válido', async () => {
    const s = await setup();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, s.attendantId));

    const response = await get('/test/protected', s.attendantToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('UserInactiveException');
  });

  it('bloqueia organização inativa', async () => {
    const s = await setup();
    await db
      .update(organizations)
      .set({ active: false })
      .where(eq(organizations.id, s.organizationId));

    const response = await get('/test/protected', s.ownerToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('OrganizationInactiveException');
  });

  it.each([
    ['vencida', { expiresAt: new Date(Date.now() - 1_000) }],
    ['cancelada', { status: 'CANCELLED' as const }],
  ])('bloqueia todas as rotas com licença %s', async (_case, change) => {
    const s = await setup();
    await db.update(licenses).set(change).where(eq(licenses.organizationId, s.organizationId));

    const response = await get('/test/protected', s.ownerToken);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: 'A licença da organização não está ativa. Entre em contato com o suporte.',
      statusCode: 403,
      exception: 'LicenseInactiveException',
    });
  });

  it('permite licença inválida apenas nas rotas que optam por isso', async () => {
    const s = await setup();
    await db
      .update(licenses)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(licenses.organizationId, s.organizationId));

    const response = await get('/test/allow-invalid-license', s.ownerToken);

    expect(response.statusCode).toBe(200);
  });

  it('usa a role atual do banco, não a do token', async () => {
    const s = await setup();
    await db.update(users).set({ role: 'MANAGER' }).where(eq(users.id, s.attendantId));

    const response = await get('/test/protected', s.attendantToken);

    expect(response.json().user.role).toBe('MANAGER');
  });

  it('recusa token de usuário de filial com filial diferente da dele (transferência)', async () => {
    const s = await setup();
    const [otherBranch] = await db
      .insert(branches)
      .values({ organizationId: s.organizationId, name: 'Filial 2' })
      .returning({ id: branches.id });
    await db.update(users).set({ branchId: otherBranch!.id }).where(eq(users.id, s.attendantId));

    const response = await get('/test/protected', s.attendantToken);

    expect(response.statusCode).toBe(401);
  });

  it('bloqueia filial inativa', async () => {
    const s = await setup();
    await db.update(branches).set({ active: false }).where(eq(branches.id, s.branchId));

    const response = await get('/test/protected', s.ownerToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('BranchInactiveException');
  });
});

describe('requireBranch', () => {
  it('permite token com filial', async () => {
    const s = await setup();

    const response = await get('/test/branch', s.ownerToken);

    expect(response.statusCode).toBe(200);
  });

  it('responde 400 quando o token não tem filial', async () => {
    const s = await setup();
    const token = sign({
      userId: s.ownerId,
      organizationId: s.organizationId,
      branchId: null,
      role: 'OWNER',
    });

    const response = await get('/test/branch', token);

    expect(response.statusCode).toBe(400);
    expect(response.json().exception).toBe('BranchNotSelectedException');
  });
});

describe('requireRole', () => {
  it('permite a role autorizada', async () => {
    const s = await setup();

    const response = await get('/test/owner-only', s.ownerToken);

    expect(response.statusCode).toBe(200);
  });

  it('responde 403 para role sem permissão', async () => {
    const s = await setup();

    const response = await get('/test/owner-only', s.attendantToken);

    expect(response.statusCode).toBe(403);
    expect(response.json().exception).toBe('ForbiddenException');
  });
});
