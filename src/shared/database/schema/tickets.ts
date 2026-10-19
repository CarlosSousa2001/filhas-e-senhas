import { sql } from 'drizzle-orm';
import {
  date,
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ticketStatus } from './enums.js';
import { branches } from './branches.js';
import { departments } from './departments.js';
import { operatorSessions } from './operator-sessions.js';
import { organizations } from './organizations.js';
import { servicePoints } from './service-points.js';

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    status: ticketStatus('status').notNull().default('WAITING'),
    serviceDate: date('service_date').notNull(),
    servicePointId: uuid('service_point_id'),
    operatorSessionId: uuid('operator_session_id'),
    cancelReason: varchar('cancel_reason', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    calledAt: timestamp('called_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'tickets_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'tickets_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    foreignKey({
      name: 'tickets_department_id_fkey',
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      name: 'tickets_service_point_id_fkey',
      columns: [table.servicePointId],
      foreignColumns: [servicePoints.id],
    }),
    foreignKey({
      name: 'tickets_operator_session_id_fkey',
      columns: [table.operatorSessionId],
      foreignColumns: [operatorSessions.id],
    }),
    unique('uq_tickets_branch_code_date').on(table.branchId, table.code, table.serviceDate),
    index('ix_tickets_queue_lookup')
      .on(table.departmentId, table.serviceDate, table.createdAt, table.id)
      .where(sql`${table.status} = 'WAITING'`),
    index('ix_tickets_organization_service_date').on(table.organizationId, table.serviceDate),
    index('ix_tickets_branch_service_date').on(table.branchId, table.serviceDate),
    index('ix_tickets_department_service_date').on(table.departmentId, table.serviceDate),
  ],
);
