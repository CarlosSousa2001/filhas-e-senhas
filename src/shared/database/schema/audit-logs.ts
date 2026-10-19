import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { branches } from './branches.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id'),
    actorUserId: uuid('actor_user_id'),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: uuid('target_id'),
    description: text('description'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'audit_logs_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'audit_logs_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    foreignKey({
      name: 'audit_logs_actor_user_id_fkey',
      columns: [table.actorUserId],
      foreignColumns: [users.id],
    }),
    index('ix_audit_logs_organization_created_at').on(
      table.organizationId,
      table.createdAt.desc().nullsFirst(),
    ),
    index('ix_audit_logs_actor').on(table.actorUserId, table.createdAt.desc().nullsFirst()),
  ],
);
