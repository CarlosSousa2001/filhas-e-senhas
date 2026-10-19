import type { FastifyReply, FastifyRequest } from 'fastify';
import { toPaginatedResponse, type PaginationQuery } from '../../shared/http/pagination.js';
import { toUserResponse } from './user.dto.js';
import {
  createUser,
  grantDepartmentAccess,
  listUsers,
  resetUserPassword,
  updateUser,
} from './user.service.js';
import type {
  UserCreateRequest,
  UserDepartmentAccessRequest,
  UserIdParams,
  UserResetPasswordRequest,
  UserUpdateRequest,
} from './user.types.js';

export async function createUserController(
  request: FastifyRequest<{ Body: UserCreateRequest }>,
  reply: FastifyReply,
) {
  const user = await createUser(request.user, request.body);
  return reply.code(201).send(toUserResponse(user));
}

export async function listUsersController(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
) {
  const { items, total } = await listUsers(request.user, request.query);
  return toPaginatedResponse(items.map(toUserResponse), total, request.query);
}

export async function updateUserController(
  request: FastifyRequest<{ Params: UserIdParams; Body: UserUpdateRequest }>,
) {
  const user = await updateUser(request.user, request.params.userId, request.body);
  return toUserResponse(user);
}

export async function grantDepartmentAccessController(
  request: FastifyRequest<{ Params: UserIdParams; Body: UserDepartmentAccessRequest }>,
  reply: FastifyReply,
) {
  const access = await grantDepartmentAccess(
    request.user,
    request.params.userId,
    request.body.departmentId,
  );
  return reply.code(201).send(access);
}

export async function resetUserPasswordController(
  request: FastifyRequest<{ Params: UserIdParams; Body: UserResetPasswordRequest }>,
  reply: FastifyReply,
) {
  await resetUserPassword(request.user, request.params.userId, request.body.newPassword);
  return reply.code(204).send();
}
