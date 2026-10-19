import type { FastifyReply, FastifyRequest } from 'fastify';
import { toOrganizationResponse } from './organization.dto.js';
import { createOrganization } from './organization.service.js';
import type { OrganizationCreateRequest } from './organization.types.js';

export async function createOrganizationController(
  request: FastifyRequest<{ Body: OrganizationCreateRequest }>,
  reply: FastifyReply,
) {
  const result = await createOrganization(request.body);
  return reply.code(201).send(toOrganizationResponse(result));
}
