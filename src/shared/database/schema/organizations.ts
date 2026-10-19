import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 60 }).notNull(),
    document: varchar('document', { length: 14 }).notNull(),
    contactEmail: varchar('contact_email', { length: 200 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 11 }).notNull(),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
    termsVersion: varchar('terms_version', { length: 20 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('uq_organizations_slug').on(table.slug),
    check(
      'chk_organizations_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 3 AND 60`,
    ),
    unique('uq_organizations_document').on(table.document),
    check('chk_organizations_document_format', sql`${table.document} ~ '^([0-9]{11}|[0-9]{14})$'`),
    check('chk_organizations_contact_phone_format', sql`${table.contactPhone} ~ '^[0-9]{10,11}$'`),
    check(
      'chk_organizations_contact_email_lowercase',
      sql`${table.contactEmail} = lower(${table.contactEmail})`,
    ),
  ],
);
