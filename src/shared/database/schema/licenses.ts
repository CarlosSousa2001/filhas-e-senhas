import { foreignKey, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { licenseStatus } from './enums.js';
import { organizations } from './organizations.js';

export const licenses = pgTable(
  'licenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    status: licenseStatus('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: 'licenses_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    unique('uq_licenses_organization').on(table.organizationId),
  ],
);
