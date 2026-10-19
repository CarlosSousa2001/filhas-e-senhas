import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { departments, userDepartmentAccess } from '../../shared/database/schema/index.js';
import { paginationOffset, type PaginationQuery } from '../../shared/http/pagination.js';
import type { Department } from './department.types.js';

const departmentColumns = {
  id: departments.id,
  organizationId: departments.organizationId,
  branchId: departments.branchId,
  name: departments.name,
  prefix: departments.prefix,
  active: departments.active,
};

type ListFilter = {
  organizationId: string;
  branchId: string;
  /** Quando informado, retorna apenas os departamentos ativos liberados para o usuário. */
  accessibleByUserId?: string;
};

export const departmentRepository = {
  /** Conta ativos e inativos; excluídos não contam no limite. */
  async countInBranch(branchId: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(departments)
      .where(and(eq(departments.branchId, branchId), notDeleted(departments)));
    return row?.total ?? 0;
  },

  /** Inclui excluídos: o prefixo nunca é reaproveitado (seção 16.1 do contexto). */
  async findByPrefixIncludingDeleted(
    branchId: string,
    prefix: string,
  ): Promise<{ id: string; deletedAt: Date | null } | null> {
    const [row] = await db
      .select({ id: departments.id, deletedAt: departments.deletedAt })
      .from(departments)
      .where(and(eq(departments.branchId, branchId), eq(departments.prefix, prefix)))
      .limit(1);
    return row ?? null;
  },

  async create(data: {
    organizationId: string;
    branchId: string;
    name: string;
    prefix: string;
  }): Promise<Department> {
    const [department] = await db.insert(departments).values(data).returning(departmentColumns);
    return department!;
  },

  async findInBranch(
    organizationId: string,
    branchId: string,
    id: string,
  ): Promise<Department | null> {
    const [department] = await db
      .select(departmentColumns)
      .from(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.organizationId, organizationId),
          eq(departments.branchId, branchId),
          notDeleted(departments),
        ),
      )
      .limit(1);
    return department ?? null;
  },

  async update(id: string, changes: { name?: string; active?: boolean }): Promise<Department> {
    const [department] = await db
      .update(departments)
      .set(changes)
      .where(eq(departments.id, id))
      .returning(departmentColumns);
    return department!;
  },

  async listInBranch(
    filter: ListFilter,
    pagination: PaginationQuery,
  ): Promise<{ items: Department[]; total: number }> {
    const conditions: SQL[] = [
      eq(departments.organizationId, filter.organizationId),
      eq(departments.branchId, filter.branchId),
      notDeleted(departments),
    ];

    const restricted = filter.accessibleByUserId !== undefined;
    if (restricted) {
      conditions.push(eq(departments.active, true));
      conditions.push(eq(userDepartmentAccess.userId, filter.accessibleByUserId!));
    }
    const where = and(...conditions);

    const itemsQuery = db.select(departmentColumns).from(departments).$dynamic();
    const totalQuery = db.select({ total: count() }).from(departments).$dynamic();
    if (restricted) {
      const joinOn = eq(userDepartmentAccess.departmentId, departments.id);
      itemsQuery.innerJoin(userDepartmentAccess, joinOn);
      totalQuery.innerJoin(userDepartmentAccess, joinOn);
    }

    const [items, [totalRow]] = await Promise.all([
      itemsQuery
        .where(where)
        .orderBy(asc(departments.name), asc(departments.id))
        .limit(pagination.pageSize)
        .offset(paginationOffset(pagination)),
      totalQuery.where(where),
    ]);
    return { items, total: totalRow?.total ?? 0 };
  },
};
