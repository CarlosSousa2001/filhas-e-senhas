import type { FastifyReply, FastifyRequest } from 'fastify';
import { toPaginatedResponse, type PaginationQuery } from '../../shared/http/pagination.js';
import { toServicePointResponse } from './service-point.dto.js';
import {
  associateServicePoint,
  createServicePoint,
  listDepartmentServicePoints,
  updateServicePoint,
} from './service-point.service.js';
import type {
  DepartmentIdParams,
  ServicePointAssociateRequest,
  ServicePointCreateRequest,
  ServicePointIdParams,
  ServicePointUpdateRequest,
} from './service-point.types.js';

export async function createServicePointController(
  request: FastifyRequest<{ Body: ServicePointCreateRequest }>,
  reply: FastifyReply,
) {
  const servicePoint = await createServicePoint(request.user, request.body);
  return reply.code(201).send(toServicePointResponse(servicePoint));
}

export async function updateServicePointController(
  request: FastifyRequest<{ Params: ServicePointIdParams; Body: ServicePointUpdateRequest }>,
) {
  const servicePoint = await updateServicePoint(request.user, request.params.id, request.body);
  return toServicePointResponse(servicePoint);
}

export async function associateServicePointController(
  request: FastifyRequest<{ Params: DepartmentIdParams; Body: ServicePointAssociateRequest }>,
  reply: FastifyReply,
) {
  const servicePoint = await associateServicePoint(
    request.user,
    request.params.departmentId,
    request.body.servicePointId,
  );
  return reply.code(201).send(toServicePointResponse(servicePoint));
}

export async function listDepartmentServicePointsController(
  request: FastifyRequest<{ Params: DepartmentIdParams; Querystring: PaginationQuery }>,
) {
  const { items, total } = await listDepartmentServicePoints(
    request.user,
    request.params.departmentId,
    request.query,
  );
  return toPaginatedResponse(items.map(toServicePointResponse), total, request.query);
}
