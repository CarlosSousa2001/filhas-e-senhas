import type { FastifyReply, FastifyRequest } from 'fastify';
import { toPaginatedResponse, type PaginationQuery } from '../../shared/http/pagination.js';
import { toDepartmentResponse } from './department.dto.js';
import { createDepartment, listDepartments, updateDepartment } from './department.service.js';
import type {
  DepartmentCreateRequest,
  DepartmentIdParams,
  DepartmentUpdateRequest,
} from './department.types.js';

export async function createDepartmentController(
  request: FastifyRequest<{ Body: DepartmentCreateRequest }>,
  reply: FastifyReply,
) {
  const department = await createDepartment(request.user, request.body);
  return reply.code(201).send(toDepartmentResponse(department));
}

export async function listDepartmentsController(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
) {
  const { items, total } = await listDepartments(request.user, request.query);
  return toPaginatedResponse(items.map(toDepartmentResponse), total, request.query);
}

export async function updateDepartmentController(
  request: FastifyRequest<{ Params: DepartmentIdParams; Body: DepartmentUpdateRequest }>,
) {
  const department = await updateDepartment(request.user, request.params.id, request.body);
  return toDepartmentResponse(department);
}
