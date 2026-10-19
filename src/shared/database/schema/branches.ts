import { boolean, foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
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
      name: 'branches_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    index('ix_branches_organization').on(table.organizationId),
  ],
);
