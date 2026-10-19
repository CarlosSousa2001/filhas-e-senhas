import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../../env.js';
import { perIp, perKey } from '../../shared/http/rate-limit.js';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import type { AuthLoginRequest } from './auth.types.js';
import { authenticate, authMiddleware } from '../../shared/auth/auth-middleware.js';
import { changePasswordController, loginController, meController } from './auth.controller.js';
import {
  authChangePasswordResponseSchema,
  authChangePasswordSchema,
  authEmptySchema,
  authLoginSchema,
  authMeResponseSchema,
  authResponseSchema,
} from './auth.schema.js';

/** Chave do limite por conta: o e-mail do dono ou empresa + usuário do funcionário. */
function loginAccountKey(request: FastifyRequest): string {
  const body = request.body as AuthLoginRequest;
  return 'email' in body
    ? `login:owner:${body.email}`
    : `login:user:${body.organizationSlug}:${body.username}`;
}

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login',
    {
      config: { rateLimit: perIp(env.RATE_LIMIT_LOGIN_PER_IP, '1 minute') },
      preHandler: [
        perKey(app, {
          max: env.RATE_LIMIT_LOGIN_PER_ACCOUNT,
          timeWindow: '1 minute',
          keyGenerator: loginAccountKey,
        }),
      ],
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
          429: apiErrorResponseSchema,
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

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/auth/password',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['Auth'],
        summary: 'Trocar a própria senha',
        description:
          'Exige a senha atual. Invalida os tokens anteriores (outros dispositivos são deslogados) e devolve um token novo para a sessão atual.',
        security: [{ bearerAuth: [] }],
        body: authChangePasswordSchema,
        querystring: authEmptySchema,
        response: {
          200: authChangePasswordResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
        },
      },
    },
    changePasswordController,
  );
}
