import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { departments, userDepartmentAccess, users } from '../../shared/database/schema/index.js';
import { paginationOffset, type PaginationQuery } from '../../shared/http/pagination.js';
import type { UserRole } from '../../shared/types/user-role.js';
import type { User } from './user.types.js';

const userColumns = {
  id: users.id,
  organizationId: users.organizationId,
  branchId: users.branchId,
  name: users.name,
  username: users.username,
  email: users.email,
  role: users.role,
  active: users.active,
};

type Conflict = { id: string; deletedAt: Date | null };

export const userRepository = {
  async findInOrganization(organizationId: string, userId: string): Promise<User | null> {
    const [user] = await db
      .select(userColumns)
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId), notDeleted(users)))
      .limit(1);
    return user ?? null;
  },

  /** Inclui excluídos: username e e-mail nunca são reaproveitados (seção 16.1 do contexto). */
  async findByUsernameIncludingDeleted(
    organizationId: string,
    username: string,
  ): Promise<Conflict | null> {
    const [row] = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.username, username)))
      .limit(1);
    return row ?? null;
  },

  async findByEmailIncludingDeleted(
    organizationId: string,
    email: string,
  ): Promise<Conflict | null> {
    const [row] = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.email, email)))
      .limit(1);
    return row ?? null;
  },

  async create(data: {
    organizationId: string;
    branchId: string | null;
    name: string;
    username: string;
    email: string | null;
    role: UserRole;
    passwordHash: string;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...data, passwordChangedAt: new Date() })
      .returning(userColumns);
    return user!;
  },

  async update(
    userId: string,
    changes: Partial<Pick<User, 'name' | 'username' | 'role' | 'active' | 'branchId'>>,
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set(changes)
      .where(eq(users.id, userId))
      .returning(userColumns);
    return user!;
  },

  async updatePassword(userId: string, passwordHash: string, changedAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash, passwordChangedAt: changedAt })
      .where(eq(users.id, userId));
  },

  async listInOrganization(
    organizationId: string,
    pagination: PaginationQuery,
  ): Promise<{ items: User[]; total: number }> {
    const where = and(eq(users.organizationId, organizationId), notDeleted(users));
    const [items, [totalRow]] = await Promise.all([
      db
        .select(userColumns)
        .from(users)
        .where(where)
        .orderBy(asc(users.name), asc(users.id))
        .limit(pagination.pageSize)
        .offset(paginationOffset(pagination)),
      db.select({ total: count() }).from(users).where(where),
    ]);
    return { items, total: totalRow?.total ?? 0 };
  },

  async findDepartmentInBranch(
    organizationId: string,
    branchId: string,
    departmentId: string,
  ): Promise<{ id: string; name: string; prefix: string } | null> {
    const [department] = await db
      .select({ id: departments.id, name: departments.name, prefix: departments.prefix })
      .from(departments)
      .where(
        and(
          eq(departments.id, departmentId),
          eq(departments.organizationId, organizationId),
          eq(departments.branchId, branchId),
          notDeleted(departments),
        ),
      )
      .limit(1);
    return department ?? null;
  },

  async hasDepartmentAccess(userId: string, departmentId: string): Promise<boolean> {
    const [row] = await db
      .select({ userId: userDepartmentAccess.userId })
      .from(userDepartmentAccess)
      .where(
        and(
          eq(userDepartmentAccess.userId, userId),
          eq(userDepartmentAccess.departmentId, departmentId),
        ),
      )
      .limit(1);
    return row !== undefined;
  },

  async grantDepartmentAccess(userId: string, departmentId: string): Promise<void> {
    await db.insert(userDepartmentAccess).values({ userId, departmentId });
  },
};
