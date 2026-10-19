import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { departments, ticketHistory, tickets } from '../../shared/database/schema/index.js';
import { paginationOffset, type PaginationQuery } from '../../shared/http/pagination.js';
import type { TicketStatus } from '../../shared/types/ticket-status.js';
import type { Ticket, TicketDepartment } from './ticket.types.js';

type Scope = { organizationId: string; branchId: string };

const departmentColumns = {
  id: departments.id,
  name: departments.name,
  prefix: departments.prefix,
};

const ticketColumns = {
  id: tickets.id,
  organizationId: tickets.organizationId,
  branchId: tickets.branchId,
  departmentId: tickets.departmentId,
  code: tickets.code,
  status: tickets.status,
  serviceDate: tickets.serviceDate,
  createdAt: tickets.createdAt,
};

/** Senha + departamento (o histórico mostra o departamento mesmo se ele foi excluído depois). */
async function findTicketWithDepartment(where: ReturnType<typeof and>): Promise<Ticket | null> {
  const [row] = await db
    .select({ ...ticketColumns, department: departmentColumns })
    .from(tickets)
    .innerJoin(departments, eq(departments.id, tickets.departmentId))
    .where(where)
    .limit(1);
  return row ?? null;
}

function activeDepartmentConditions(scope: Scope) {
  return [
    eq(departments.organizationId, scope.organizationId),
    eq(departments.branchId, scope.branchId),
    eq(departments.active, true),
    notDeleted(departments),
  ];
}

export const ticketRepository = {
  /** Departamento ativo e não excluído da filial (a geração não depende de user_department_access). */
  async findActiveDepartment(scope: Scope, departmentId: string): Promise<TicketDepartment | null> {
    const [department] = await db
      .select(departmentColumns)
      .from(departments)
      .where(and(eq(departments.id, departmentId), ...activeDepartmentConditions(scope)))
      .limit(1);
    return department ?? null;
  },

  async listActiveDepartments(
    scope: Scope,
    pagination: PaginationQuery,
  ): Promise<{ items: TicketDepartment[]; total: number }> {
    const where = and(...activeDepartmentConditions(scope));
    const [items, [totalRow]] = await Promise.all([
      db
        .select(departmentColumns)
        .from(departments)
        .where(where)
        .orderBy(asc(departments.name), asc(departments.id))
        .limit(pagination.pageSize)
        .offset(paginationOffset(pagination)),
      db.select({ total: count() }).from(departments).where(where),
    ]);
    return { items, total: totalRow?.total ?? 0 };
  },

  async findInBranch(scope: Scope, ticketId: string): Promise<Ticket | null> {
    return findTicketWithDepartment(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.organizationId, scope.organizationId),
        eq(tickets.branchId, scope.branchId),
      ),
    );
  },

  /**
   * Cancela a senha somente se ela ainda estiver em um dos status permitidos
   * (atualização condicional: protege contra ações simultâneas) e grava o evento CANCELLED.
   * Retorna false quando o status já não permitia o cancelamento.
   */
  async cancel(data: {
    ticketId: string;
    allowedStatuses: TicketStatus[];
    reason: string | null;
    actorUserId: string;
    now: Date;
  }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const updated = await tx
        .update(tickets)
        .set({ status: 'CANCELLED', cancelReason: data.reason })
        .where(and(eq(tickets.id, data.ticketId), inArray(tickets.status, data.allowedStatuses)))
        .returning({ id: tickets.id });
      if (updated.length === 0) return false;
      await tx.insert(ticketHistory).values({
        ticketId: data.ticketId,
        eventType: 'CANCELLED',
        actorUserId: data.actorUserId,
        metadata: data.reason === null ? null : { reason: data.reason },
        createdAt: data.now,
      });
      return true;
    });
  },

  /** Cria a senha WAITING e o evento CREATED na mesma transação. */
  async createWithHistory(data: {
    organizationId: string;
    branchId: string;
    department: TicketDepartment;
    code: string;
    serviceDate: string;
    createdAt: Date;
    actorUserId: string;
  }): Promise<Ticket> {
    return db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(tickets)
        .values({
          organizationId: data.organizationId,
          branchId: data.branchId,
          departmentId: data.department.id,
          code: data.code,
          status: 'WAITING',
          serviceDate: data.serviceDate,
          createdAt: data.createdAt,
        })
        .returning();
      await tx.insert(ticketHistory).values({
        ticketId: ticket!.id,
        eventType: 'CREATED',
        actorUserId: data.actorUserId,
        createdAt: data.createdAt,
      });
      return {
        id: ticket!.id,
        organizationId: ticket!.organizationId,
        branchId: ticket!.branchId,
        departmentId: ticket!.departmentId,
        code: ticket!.code,
        status: ticket!.status,
        serviceDate: ticket!.serviceDate,
        createdAt: ticket!.createdAt,
        department: data.department,
      };
    });
  },
};
