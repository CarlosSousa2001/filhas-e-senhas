import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { operatorSessionStatus, operatorSessionEndReason } from './enums.js';
import { servicePoints } from './service-points.js';
import { users } from './users.js';

export const operatorSessions = pgTable(
  'operator_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    servicePointId: uuid('service_point_id').notNull(),
    status: operatorSessionStatus('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByUserId: uuid('ended_by_user_id'),
    endReason: operatorSessionEndReason('end_reason'),
  },
  (table) => [
    foreignKey({
      name: 'operator_sessions_user_id_fkey',
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    foreignKey({
      name: 'operator_sessions_service_point_id_fkey',
      columns: [table.servicePointId],
      foreignColumns: [servicePoints.id],
    }),
    foreignKey({
      name: 'operator_sessions_ended_by_user_id_fkey',
      columns: [table.endedByUserId],
      foreignColumns: [users.id],
    }),
    check(
      'chk_operator_session_closed_data',
      sql`${table.status} <> 'CLOSED' OR ( ${table.endedAt} IS NOT NULL AND ${table.endedByUserId} IS NOT NULL AND ${table.endReason} IS NOT NULL )`,
    ),
    check(
      'chk_operator_session_active_data',
      sql`${table.status} <> 'ACTIVE' OR ( ${table.endedAt} IS NULL AND ${table.endedByUserId} IS NULL AND ${table.endReason} IS NULL )`,
    ),
    uniqueIndex('uq_operator_sessions_active_user')
      .on(table.userId)
      .where(sql`${table.status} = 'ACTIVE'`),
    uniqueIndex('uq_operator_sessions_active_service_point')
      .on(table.servicePointId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index('ix_operator_sessions_user_history').on(
      table.userId,
      table.startedAt.desc().nullsFirst(),
    ),
    index('ix_operator_sessions_service_point_history').on(
      table.servicePointId,
      table.startedAt.desc().nullsFirst(),
    ),
  ],
);
