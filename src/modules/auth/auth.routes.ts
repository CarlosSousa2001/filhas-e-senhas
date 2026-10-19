import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import { authenticate } from '../../shared/auth/auth-middleware.js';
import { loginController, meController } from './auth.controller.js';
import {
  authEmptySchema,
  authLoginSchema,
  authMeResponseSchema,
  authResponseSchema,
} from './auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login do dono ou funcionário',
        description:
          'Dono por e-mail ou qualquer usuário por organizationSlug e username. Retorna JWT HS256 válido por 8h com a Matriz. Credenciais inválidas: 401; usuário, organização ou filial inativos/excluídos: 403. Licença inválida não impede login.',
        body: authLoginSchema,
        params: authEmptySchema,
        querystring: authEmptySchema,
        response: {
          200: authResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
      },
    },
    loginController,
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/auth/me',
    {
      // Responde mesmo com a licença vencida, para o frontend mostrar o aviso.
      preHandler: [authenticate({ allowInvalidLicense: true })],
      schema: {
        tags: ['Auth'],
        summary: 'Usuário logado',
        description:
          'Mesmo formato da resposta do login, sem o token: usuário, organização (com slug), filial e licença. Continua respondendo com licença inválida.',
        security: [{ bearerAuth: [] }],
        querystring: authEmptySchema,
        response: {
          200: authMeResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
      },
    },
    meController,
  );
}
