import { foreignKey, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ticketEventType } from './enums.js';
import { publicDevices } from './public-devices.js';
import { tickets } from './tickets.js';
import { users } from './users.js';

export const ticketHistory = pgTable(
  'ticket_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull(),
    eventType: ticketEventType('event_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorDeviceId: uuid('actor_device_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'ticket_history_ticket_id_fkey',
      columns: [table.ticketId],
      foreignColumns: [tickets.id],
    }),
    foreignKey({
      name: 'ticket_history_actor_user_id_fkey',
      columns: [table.actorUserId],
      foreignColumns: [users.id],
    }),
    foreignKey({
      name: 'fk_ticket_history_actor_device',
      columns: [table.actorDeviceId],
      foreignColumns: [publicDevices.id],
    }),
    index('ix_ticket_history_ticket').on(table.ticketId, table.createdAt),
  ],
);
