import type { FastifyReply, FastifyRequest } from 'fastify';
import { resetUserPassword } from './user.service.js';
import type { UserIdParams, UserResetPasswordRequest } from './user.types.js';

export async function resetUserPasswordController(
  request: FastifyRequest<{ Params: UserIdParams; Body: UserResetPasswordRequest }>,
  reply: FastifyReply,
) {
  await resetUserPassword(request.user, request.params.userId, request.body.newPassword);
  return reply.code(204).send();
}
