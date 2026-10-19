import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authMiddleware, requireBranch, requireRole } from '../../shared/auth/auth-middleware.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import {
  createUserController,
  grantDepartmentAccessController,
  listUsersController,
  resetUserPasswordController,
  updateUserController,
} from './user.controller.js';
import {
  userCreateSchema,
  userDepartmentAccessResponseSchema,
  userDepartmentAccessSchema,
  userEmptySchema,
  userIdParamsSchema,
  userResetPasswordSchema,
  userResponseListSchema,
  userResponseSchema,
  userUpdateSchema,
} from './user.schema.js';

const authErrors = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
};

export async function userRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const manage = [authMiddleware, requireBranch, requireRole('OWNER', 'ADMIN')];

  routes.post(
    '/users',
    {
      preHandler: manage,
      schema: {
        tags: ['Users'],
        summary: 'Criar usuário',
        description:
          'OWNER cria ADMIN, MANAGER, ATTENDANT e VIEWER; ADMIN cria MANAGER, ATTENDANT e VIEWER. Username opcional (gerado a partir do primeiro nome quando ausente) e único na organização; e-mail opcional. ADMIN fica sem filial; as demais roles nascem na filial do token. Conflito com usuário excluído → 409 com meta.deletedId.',
        security: [{ bearerAuth: [] }],
        body: userCreateSchema,
        querystring: userEmptySchema,
        response: {
          201: userResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          409: apiErrorResponseSchema,
        },
      },
    },
    createUserController,
  );

  routes.get(
    '/users',
    {
      preHandler: manage,
      schema: {
        tags: ['Users'],
        summary: 'Listar usuários',
        description: 'OWNER/ADMIN. Usuários da organização (exceto excluídos), ordenados por nome.',
        security: [{ bearerAuth: [] }],
        querystring: paginationQuerySchema,
        response: {
          200: userResponseListSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
        },
      },
    },
    listUsersController,
  );

  routes.patch(
    '/users/:userId',
    {
      preHandler: manage,
      schema: {
        tags: ['Users'],
        summary: 'Editar ou desativar usuário',
        description:
          'OWNER/ADMIN. ADMIN não altera o OWNER e só troca roles entre MANAGER, ATTENDANT e VIEWER. A role do OWNER não muda. Ninguém desativa a si mesmo nem o OWNER. Usuário desativado é bloqueado na hora.',
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: userUpdateSchema,
        querystring: userEmptySchema,
        response: {
          200: userResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    updateUserController,
  );

  routes.post(
    '/users/:userId/departments',
    {
      preHandler: manage,
      schema: {
        tags: ['Users'],
        summary: 'Liberar acesso a um departamento',
        description:
          'OWNER/ADMIN. Libera para um usuário de filial (MANAGER, ATTENDANT, VIEWER) um departamento da mesma filial. OWNER e ADMIN já veem todos os departamentos (400).',
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: userDepartmentAccessSchema,
        querystring: userEmptySchema,
        response: {
          201: userDepartmentAccessResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    grantDepartmentAccessController,
  );

  routes.patch(
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
          ...authErrors,
          404: apiErrorResponseSchema,
        },
      },
    },
    resetUserPasswordController,
  );
}
