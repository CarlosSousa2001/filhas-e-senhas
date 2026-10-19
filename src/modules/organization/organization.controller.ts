import type { FastifyReply, FastifyRequest } from 'fastify';
import { toOrganizationResponse } from './organization.dto.js';
import { createOrganization, getOrganizationNameBySlug } from './organization.service.js';
import type {
  OrganizationCreateRequest,
  OrganizationPublicResponse,
} from './organization.types.js';

export async function createOrganizationController(
  request: FastifyRequest<{ Body: OrganizationCreateRequest }>,
  reply: FastifyReply,
) {
  const result = await createOrganization(request.body);
  return reply.code(201).send(toOrganizationResponse(result));
}

export async function getOrganizationBySlugController(
  request: FastifyRequest<{ Params: { slug: string } }>,
): Promise<OrganizationPublicResponse> {
  const name = await getOrganizationNameBySlug(request.params.slug);
  return { name };
}
