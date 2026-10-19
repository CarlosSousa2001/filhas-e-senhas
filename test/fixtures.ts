import { eq } from 'drizzle-orm';
import type { buildApp } from '../src/app.js';
import { hashPassword } from '../src/shared/auth/password.js';
import { users } from '../src/shared/database/schema/index.js';
import type { UserRole } from '../src/shared/types/user-role.js';
import { db } from './helpers.js';

type TestApp = Awaited<ReturnType<typeof buildApp>>;

export const OWNER_PASSWORD = 'senha-do-dono';

/**
 * Cadastra uma organização pela API e faz login do dono.
 * O password_changed_at do dono é recuado 1 minuto para que o token do login seja válido.
 */
export async function createOrganizationWithOwner(app: TestApp, suffix = '1') {
  const signup = await app.inject({
    method: 'POST',
    url: '/organizations',
    payload: {
      organizationName: `Empresa ${suffix}`,
      document: `1234567800019${suffix}`.slice(0, 14),
      ownerName: 'Carlos Sousa',
      phone: '11987654321',
      email: `dono${suffix}@example.com`,
      password: OWNER_PASSWORD,
      passwordConfirmation: OWNER_PASSWORD,
      acceptedTerms: true,
    },
  });
  if (signup.statusCode !== 201) {
    throw new Error(`Falha no cadastro de teste: ${signup.body}`);
  }
  const { organization, owner, branch } = signup.json();
  await db
    .update(users)
    .set({ passwordChangedAt: new Date(Date.now() - 60_000) })
    .where(eq(users.id, owner.id));

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: `dono${suffix}@example.com`, password: OWNER_PASSWORD },
  });

  return {
    organization: organization as { id: string; name: string; slug: string },
    owner: owner as { id: string; name: string; email: string; username: string },
    branch: branch as { id: string; name: string },
    ownerToken: login.json().accessToken as string,
  };
}

/** Cria um usuário direto no banco e devolve o token de login dele (pelo slug). */
export async function createUserAndLogin(
  app: TestApp,
  params: {
    organizationId: string;
    organizationSlug: string;
    branchId: string;
    role: UserRole;
    username: string;
    password?: string;
  },
) {
  const password = params.password ?? 'senha-do-usuario';
  const isOrganizationUser = params.role === 'OWNER' || params.role === 'ADMIN';
  const [user] = await db
    .insert(users)
    .values({
      organizationId: params.organizationId,
      branchId: isOrganizationUser ? null : params.branchId,
      name: params.username,
      username: params.username,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(Date.now() - 60_000),
      role: params.role,
    })
    .returning({ id: users.id });

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      organizationSlug: params.organizationSlug,
      username: params.username,
      password,
    },
  });

  return { id: user!.id, token: login.json().accessToken as string, password };
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}
