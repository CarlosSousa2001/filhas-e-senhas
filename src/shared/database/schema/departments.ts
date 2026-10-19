import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { branches } from './branches.js';
import { organizations } from './organizations.js';

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    prefix: varchar('prefix', { length: 4 }).notNull(),
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
      name: 'departments_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'departments_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    unique('uq_departments_branch_prefix').on(table.branchId, table.prefix),
    check('chk_departments_prefix_format', sql`${table.prefix} ~ '^[A-Z0-9]{1,4}$'`),
  ],
);
