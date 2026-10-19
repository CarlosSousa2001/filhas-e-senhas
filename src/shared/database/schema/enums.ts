import { pgEnum } from 'drizzle-orm/pg-core';

export const licenseStatus = pgEnum('license_status', ['ACTIVE', 'EXPIRED', 'CANCELLED']);
export type LicenseStatus = (typeof licenseStatus.enumValues)[number];

export const userRole = pgEnum('user_role', [
  'OWNER',
  'ADMIN',
  'BRANCH_ADMIN',
  'MANAGER',
  'ATTENDANT',
  'VIEWER',
]);
export type UserRole = (typeof userRole.enumValues)[number];

export const operatorSessionStatus = pgEnum('operator_session_status', ['ACTIVE', 'CLOSED']);
export type OperatorSessionStatus = (typeof operatorSessionStatus.enumValues)[number];

export const operatorSessionEndReason = pgEnum('operator_session_end_reason', [
  'USER_LEFT',
  'FORCED_BY_USER',
  'SERVICE_POINT_DISABLED',
  'ADMIN_ACTION',
]);
export type OperatorSessionEndReason = (typeof operatorSessionEndReason.enumValues)[number];

export const ticketStatus = pgEnum('ticket_status', [
  'WAITING',
  'IN_SERVICE',
  'FINISHED',
  'NO_SHOW',
  'CANCELLED',
  'EXPIRED',
]);
export type TicketStatus = (typeof ticketStatus.enumValues)[number];

export const ticketEventType = pgEnum('ticket_event_type', [
  'CREATED',
  'CALLED',
  'RECALLED',
  'FINISHED',
  'CANCELLED',
  'NO_SHOW',
  'EXPIRED',
]);
export type TicketEventType = (typeof ticketEventType.enumValues)[number];

export const deviceType = pgEnum('device_type', ['TICKET_GENERATOR', 'QUEUE_DISPLAY']);
export type DeviceType = (typeof deviceType.enumValues)[number];

export const deviceStatus = pgEnum('device_status', ['PENDING_ACTIVATION', 'ACTIVE', 'REVOKED']);
export type DeviceStatus = (typeof deviceStatus.enumValues)[number];
