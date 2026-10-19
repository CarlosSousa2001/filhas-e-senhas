import { foreignKey, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { departments } from './departments.js';
import { servicePoints } from './service-points.js';

export const departmentServicePoints = pgTable(
  'department_service_points',
  {
    departmentId: uuid('department_id').notNull(),
    servicePointId: uuid('service_point_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'department_service_points_department_id_fkey',
      columns: [table.departmentId],
      foreignColumns: [departments.id],
    }),
    foreignKey({
      name: 'department_service_points_service_point_id_fkey',
      columns: [table.servicePointId],
      foreignColumns: [servicePoints.id],
    }),
    primaryKey({
      name: 'department_service_points_pkey',
      columns: [table.departmentId, table.servicePointId],
    }),
    index('ix_department_service_points_service_point').on(table.servicePointId),
  ],
);
