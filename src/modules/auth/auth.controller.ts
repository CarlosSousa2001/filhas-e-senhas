import type { FastifyReply, FastifyRequest } from 'fastify';
import { createJwtPayload } from '../../shared/auth/jwt.js';
import { toAuthMeResponse, toAuthResponse } from './auth.dto.js';
import { changeOwnPassword, getCurrentUser, login } from './auth.service.js';
import type { AuthChangePasswordRequest, AuthLoginRequest } from './auth.types.js';

export async function loginController(
  request: FastifyRequest<{ Body: AuthLoginRequest }>,
  reply: FastifyReply,
) {
  const auth = await login(request.body);
  const payload = createJwtPayload({
    userId: auth.user.id,
    organizationId: auth.organization.id,
    branchId: auth.branch.id,
    role: auth.user.role,
  });
  const accessToken = await reply.jwtSign(payload);
  return reply.code(200).send(toAuthResponse(auth, accessToken));
}

export async function meController(request: FastifyRequest) {
  const me = await getCurrentUser(request.user);
  return toAuthMeResponse(me);
}

export async function changePasswordController(
  request: FastifyRequest<{ Body: AuthChangePasswordRequest }>,
  reply: FastifyReply,
) {
  await changeOwnPassword(request.user, request.body);
  // A troca invalida os tokens anteriores; a sessão atual continua com um token novo.
  const payload = createJwtPayload({
    userId: request.user.userId,
    organizationId: request.user.organizationId,
    branchId: request.user.branchId,
    role: request.user.role,
  });
  return { accessToken: await reply.jwtSign(payload) };
}
