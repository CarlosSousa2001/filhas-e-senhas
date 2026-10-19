import { foreignKey, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { publicDevices } from './public-devices.js';

export const publicDeviceDepartments = pgTable(
  'public_device_departments',
  {
    publicDeviceId: uuid('public_device_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'public_device_departments_public_device_id_fkey',
      columns: [table.publicDeviceId],
      foreignColumns: [publicDevices.id],
    }),
    foreignKey({
      name: 'public_device_departments_department_id_fkey',
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    primaryKey({
      name: 'public_device_departments_pkey',
      columns: [table.publicDeviceId, table.departmentId],
    }),
  ],
);
