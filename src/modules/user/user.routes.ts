import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authMiddleware, requireRole } from '../../shared/auth/auth-middleware.js';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import { resetUserPasswordController } from './user.controller.js';
import { userEmptySchema, userIdParamsSchema, userResetPasswordSchema } from './user.schema.js';

export async function userRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/users/:userId/password',
    {
      preHandler: [authMiddleware, requireRole('OWNER', 'ADMIN')],
      schema: {
        tags: ['Users'],
        summary: 'Redefinir a senha de um usuário',
        description:
          'OWNER redefine de qualquer usuário; ADMIN de qualquer um, exceto do OWNER. As sessões do usuário são derrubadas.',
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: userResetPasswordSchema,
        querystring: userEmptySchema,
        response: {
          204: userEmptySchema.describe('Senha redefinida'),
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    resetUserPasswordController,
  );
}
