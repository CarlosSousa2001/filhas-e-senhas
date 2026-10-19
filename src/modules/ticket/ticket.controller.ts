import type { FastifyReply, FastifyRequest } from 'fastify';
import { toPaginatedResponse, type PaginationQuery } from '../../shared/http/pagination.js';
import { toTicketResponse } from './ticket.dto.js';
import { cancelTicket, createTicket, listTicketDepartments } from './ticket.service.js';
import type { TicketCancelRequest, TicketCreateRequest, TicketIdParams } from './ticket.types.js';

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

export async function cancelTicketController(
  request: FastifyRequest<{ Params: TicketIdParams; Body: TicketCancelRequest }>,
) {
  const ticket = await cancelTicket(request.user, request.params.id, request.body?.reason);
  return toTicketResponse(ticket);
}
