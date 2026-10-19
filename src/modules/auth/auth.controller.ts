import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '../../shared/auth/jwt.js';
import { toAuthResponse } from './auth.dto.js';
import { login } from './auth.service.js';
import type { AuthLoginRequest } from './auth.types.js';

export async function loginController(
  request: FastifyRequest<{ Body: AuthLoginRequest }>,
  reply: FastifyReply,
) {
  const auth = await login(request.body);
  const payload: JwtPayload = {
    userId: auth.user.id,
    organizationId: auth.organization.id,
    branchId: auth.branch.id,
    role: auth.user.role,
  };
  const accessToken = await reply.jwtSign(payload);
  return reply.code(200).send(toAuthResponse(auth, accessToken));
}
