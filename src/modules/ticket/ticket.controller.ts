import type { FastifyReply, FastifyRequest } from 'fastify';
import { toPaginatedResponse, type PaginationQuery } from '../../shared/http/pagination.js';
import { toTicketResponse } from './ticket.dto.js';
import { createTicket, listTicketDepartments } from './ticket.service.js';
import type { TicketCreateRequest } from './ticket.types.js';

export async function listTicketDepartmentsController(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
) {
  const { items, total } = await listTicketDepartments(request.user, request.query);
  return toPaginatedResponse(items, total, request.query);
}

export async function createTicketController(
  request: FastifyRequest<{ Body: TicketCreateRequest }>,
  reply: FastifyReply,
) {
  const ticket = await createTicket(request.user, request.body.departmentId);
  return reply.code(201).send(toTicketResponse(ticket));
}
