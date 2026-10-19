import { foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deviceType, deviceStatus } from './enums.js';
import { branches } from './branches.js';
import { organizations } from './organizations.js';

export const publicDevices = pgTable(
  'public_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: deviceType('type').notNull(),
    status: deviceStatus('status').notNull().default('PENDING_ACTIVATION'),
    credentialHash: varchar('credential_hash', { length: 255 }),
    activationCode: varchar('activation_code', { length: 20 }),
    activationCodeExpiresAt: timestamp('activation_code_expires_at', { withTimezone: true }),
    activationCodeUsedAt: timestamp('activation_code_used_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: 'public_devices_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'public_devices_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    index('ix_public_devices_organization').on(table.organizationId),
    index('ix_public_devices_status').on(table.organizationId, table.status),
  ],
);
