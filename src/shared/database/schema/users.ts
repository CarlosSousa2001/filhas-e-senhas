import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { userRole } from './enums.js';
import { branches } from './branches.js';
import { organizations } from './organizations.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id'),
    name: varchar('name', { length: 150 }).notNull(),
    username: varchar('username', { length: 60 }).notNull(),
    email: varchar('email', { length: 200 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    role: userRole('role').notNull(),
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
      name: 'users_organization_id_fkey',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: 'users_branch_id_fkey',
      columns: [table.branchId],
      foreignColumns: [branches.id],
    }),
    unique('uq_users_organization_username').on(table.organizationId, table.username),
    unique('uq_users_organization_email').on(table.organizationId, table.email),
    check('chk_users_username_format', sql`${table.username} ~ '^[a-z0-9]+([._][a-z0-9]+)*$'`),
    check(
      'chk_users_email_lowercase',
      sql`${table.email} IS NULL OR ${table.email} = lower(${table.email})`,
    ),
    check('chk_users_owner_email', sql`${table.role} <> 'OWNER' OR ${table.email} IS NOT NULL`),
    check(
      'chk_users_branch_by_role',
      sql`(${table.role} IN ('OWNER', 'ADMIN') AND ${table.branchId} IS NULL) OR (${table.role} NOT IN ('OWNER', 'ADMIN') AND ${table.branchId} IS NOT NULL)`,
    ),
    uniqueIndex('uq_users_owner_email')
      .on(table.email)
      .where(sql`${table.role} = 'OWNER'`),
    uniqueIndex('uq_users_single_owner')
      .on(table.organizationId)
      .where(sql`${table.role} = 'OWNER'`),
  ],
);
