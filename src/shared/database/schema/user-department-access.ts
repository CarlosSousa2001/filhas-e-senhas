import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { users } from './users.js';

export const userDepartmentAccess = pgTable(
  'user_department_access',
  {
    userId: uuid('user_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'user_department_access_user_id_fkey',
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    foreignKey({
      name: 'user_department_access_department_id_fkey',
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    primaryKey({
      name: 'user_department_access_pkey',
      columns: [table.userId, table.departmentId],
    }),
    index('ix_user_department_access_department').on(table.departmentId),
  ],
);
