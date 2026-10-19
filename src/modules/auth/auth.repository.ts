import { and, eq } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { branches, licenses, organizations, users } from '../../shared/database/schema/index.js';
import type { Auth, AuthOrganization, AuthUser } from './auth.types.js';

// Login inclui excluídos para distinguir 403 somente depois de conferir a senha.
export const authRepository = {
  async findOwnerByEmailIncludingDeleted(email: string): Promise<AuthUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.role, 'OWNER')))
      .limit(1);
    return user ?? null;
  },
  async findUserIncludingDeleted(
    organizationId: string,
    username: string,
  ): Promise<AuthUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.username, username)))
      .limit(1);
    return user ?? null;
  },
  async findOrganizationBySlugIncludingDeleted(slug: string): Promise<AuthOrganization | null> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return organization ?? null;
  },
  async findOrganizationByIdIncludingDeleted(id: string): Promise<AuthOrganization | null> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return organization ?? null;
  },
  /**
   * Filial do token: a do próprio usuário (usuários de filial) ou, para OWNER/ADMIN,
   * a filial ativa da organização (V1: uma única filial, a Matriz).
   */
  async findLoginBranch(
    organizationId: string,
    branchId: string | null,
  ): Promise<Auth['branch'] | null> {
    const [branch] = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(
        and(
          eq(branches.organizationId, organizationId),
          branchId === null ? undefined : eq(branches.id, branchId),
          eq(branches.active, true),
          notDeleted(branches),
        ),
      )
      .orderBy(branches.createdAt)
      .limit(1);
    return branch ?? null;
  },
  async findUserById(id: string): Promise<Auth['user'] | null> {
    const [user] = await db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ?? null;
  },
  async findBranchById(id: string): Promise<Auth['branch'] | null> {
    const [branch] = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.id, id))
      .limit(1);
    return branch ?? null;
  },
  async findLicense(organizationId: string): Promise<Omit<Auth['license'], 'valid'> | null> {
    const [license] = await db
      .select({ status: licenses.status, expiresAt: licenses.expiresAt })
      .from(licenses)
      .where(eq(licenses.organizationId, organizationId))
      .limit(1);
    return license ?? null;
  },
};
