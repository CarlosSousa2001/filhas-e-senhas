import { boolean, foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { branches } from './branches.js';
import { organizations } from './organizations.js';

export const servicePoints = pgTable(
  'service_points',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'service_points_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'service_points_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    index('ix_service_points_branch').on(table.branchId),
  ],
);
