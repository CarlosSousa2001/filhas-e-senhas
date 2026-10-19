import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import {
  departmentServicePoints,
  departments,
  servicePoints,
  userDepartmentAccess,
} from '../../shared/database/schema/index.js';
import { paginationOffset, type PaginationQuery } from '../../shared/http/pagination.js';
import type { ServicePoint } from './service-point.types.js';

const servicePointColumns = {
  id: servicePoints.id,
  organizationId: servicePoints.organizationId,
  branchId: servicePoints.branchId,
  name: servicePoints.name,
  active: servicePoints.active,
};

type Scope = { organizationId: string; branchId: string };

export const servicePointRepository = {
  async create(data: Scope & { name: string }): Promise<ServicePoint> {
    const [servicePoint] = await db
      .insert(servicePoints)
      .values(data)
      .returning(servicePointColumns);
    return servicePoint!;
  },

  async findInBranch(scope: Scope, id: string): Promise<ServicePoint | null> {
    const [servicePoint] = await db
      .select(servicePointColumns)
      .from(servicePoints)
      .where(
        and(
          eq(servicePoints.id, id),
          eq(servicePoints.organizationId, scope.organizationId),
          eq(servicePoints.branchId, scope.branchId),
          notDeleted(servicePoints),
        ),
      )
      .limit(1);
    return servicePoint ?? null;
  },

  async update(id: string, changes: { name?: string; active?: boolean }): Promise<ServicePoint> {
    const [servicePoint] = await db
      .update(servicePoints)
      .set(changes)
      .where(eq(servicePoints.id, id))
      .returning(servicePointColumns);
    return servicePoint!;
  },

  /**
   * Departamento da filial (não excluído). Com `accessibleByUserId`, exige também que esteja
   * ativo e liberado para o usuário (roles operacionais).
   */
  async departmentExistsInBranch(
    scope: Scope,
    departmentId: string,
    accessibleByUserId?: string,
  ): Promise<boolean> {
    const conditions: SQL[] = [
      eq(departments.id, departmentId),
      eq(departments.organizationId, scope.organizationId),
      eq(departments.branchId, scope.branchId),
      notDeleted(departments),
    ];
    const query = db.select({ id: departments.id }).from(departments).$dynamic();
    if (accessibleByUserId !== undefined) {
      conditions.push(eq(departments.active, true));
      conditions.push(eq(userDepartmentAccess.userId, accessibleByUserId));
      query.innerJoin(userDepartmentAccess, eq(userDepartmentAccess.departmentId, departments.id));
    }
    const [row] = await query.where(and(...conditions)).limit(1);
    return row !== undefined;
  },

  async isAssociated(departmentId: string, servicePointId: string): Promise<boolean> {
    const [row] = await db
      .select({ departmentId: departmentServicePoints.departmentId })
      .from(departmentServicePoints)
      .where(
        and(
          eq(departmentServicePoints.departmentId, departmentId),
          eq(departmentServicePoints.servicePointId, servicePointId),
        ),
      )
      .limit(1);
    return row !== undefined;
  },

  /** Guichês associados ao departamento; inativos contam no limite, excluídos não. */
  async countInDepartment(departmentId: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(departmentServicePoints)
      .innerJoin(servicePoints, eq(servicePoints.id, departmentServicePoints.servicePointId))
      .where(and(eq(departmentServicePoints.departmentId, departmentId), notDeleted(servicePoints)))
      .limit(1);
    return row?.total ?? 0;
  },

  async associate(departmentId: string, servicePointId: string): Promise<void> {
    await db.insert(departmentServicePoints).values({ departmentId, servicePointId });
  },

  async listInDepartment(
    departmentId: string,
    options: { onlyActive: boolean },
    pagination: PaginationQuery,
  ): Promise<{ items: ServicePoint[]; total: number }> {
    const conditions: SQL[] = [
      eq(departmentServicePoints.departmentId, departmentId),
      notDeleted(servicePoints),
    ];
    if (options.onlyActive) conditions.push(eq(servicePoints.active, true));
    const where = and(...conditions);
    const joinOn = eq(servicePoints.id, departmentServicePoints.servicePointId);

    const [items, [totalRow]] = await Promise.all([
      db
        .select(servicePointColumns)
        .from(departmentServicePoints)
        .innerJoin(servicePoints, joinOn)
        .where(where)
        .orderBy(asc(servicePoints.name), asc(servicePoints.id))
        .limit(pagination.pageSize)
        .offset(paginationOffset(pagination)),
      db
        .select({ total: count() })
        .from(departmentServicePoints)
        .innerJoin(servicePoints, joinOn)
        .where(where),
    ]);
    return { items, total: totalRow?.total ?? 0 };
  },
};
