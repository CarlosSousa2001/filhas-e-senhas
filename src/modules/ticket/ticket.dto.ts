import type { Ticket, TicketResponse } from './ticket.types.js';

export function toTicketResponse(ticket: Ticket): TicketResponse {
  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status,
    serviceDate: ticket.serviceDate,
    createdAt: ticket.createdAt.toISOString(),
    department: {
      id: ticket.department.id,
      name: ticket.department.name,
      prefix: ticket.department.prefix,
    },
  };
}
