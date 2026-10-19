import type { z } from 'zod';
import type { TicketStatus } from '../../shared/types/ticket-status.js';
import type {
  ticketCreateSchema,
  ticketDepartmentResponseSchema,
  ticketResponseSchema,
} from './ticket.schema.js';

interface TicketDepartmentEntity {
  id: string;
  name: string;
  prefix: string;
}

interface TicketEntity {
  id: string;
  organizationId: string;
  branchId: string;
  departmentId: string;
  code: string;
  status: TicketStatus;
  serviceDate: string;
  createdAt: Date;
  department: TicketDepartmentEntity;
}

export type Ticket = TicketEntity;
export type TicketDepartment = TicketDepartmentEntity;
export type TicketCreateRequest = z.infer<typeof ticketCreateSchema>;
export type TicketResponse = z.infer<typeof ticketResponseSchema>;
export type TicketDepartmentResponse = z.infer<typeof ticketDepartmentResponseSchema>;
