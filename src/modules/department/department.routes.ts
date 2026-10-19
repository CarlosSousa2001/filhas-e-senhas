import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  BRANCH_MANAGEMENT_ROLES,
  authMiddleware,
  requireBranch,
  requireRole,
} from '../../shared/auth/auth-middleware.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import {
  createDepartmentController,
  listDepartmentsController,
  updateDepartmentController,
} from './department.controller.js';
import {
  departmentCreateSchema,
  departmentEmptySchema,
  departmentIdParamsSchema,
  departmentResponseListSchema,
  departmentResponseSchema,
  departmentUpdateSchema,
} from './department.schema.js';

const authErrors = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
};

export async function departmentRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const manage = [authMiddleware, requireBranch, requireRole(...BRANCH_MANAGEMENT_ROLES)];

  routes.post(
    '/departments',
    {
      preHandler: manage,
      schema: {
        tags: ['Departments'],
        summary: 'Criar departamento',
        description:
          'OWNER/ADMIN. Prefixo de 1 a 4 letras ou números, normalizado para maiúsculas, único na filial e imutável. Limite de 5 departamentos por filial (inativos contam). Prefixo de um departamento excluído → 409 com meta.deletedId.',
        security: [{ bearerAuth: [] }],
        body: departmentCreateSchema,
        querystring: departmentEmptySchema,
        response: {
          201: departmentResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          409: apiErrorResponseSchema,
        },
      },
    },
    createDepartmentController,
  );

  routes.get(
    '/departments',
    {
      preHandler: [authMiddleware, requireBranch],
      schema: {
        tags: ['Departments'],
        summary: 'Listar departamentos',
        description:
          'OWNER/ADMIN veem todos os departamentos da filial (inclusive inativos); as demais roles veem apenas os ativos liberados para elas. Ordenado por nome.',
        security: [{ bearerAuth: [] }],
        querystring: paginationQuerySchema,
        response: {
          200: departmentResponseListSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
        },
      },
    },
    listDepartmentsController,
  );

  routes.patch(
    '/departments/:id',
    {
      preHandler: manage,
      schema: {
        tags: ['Departments'],
        summary: 'Editar ou desativar departamento',
        description:
          'OWNER/ADMIN. Altera nome e/ou active. O prefixo não pode ser alterado (enviar prefix → 400).',
        security: [{ bearerAuth: [] }],
        params: departmentIdParamsSchema,
        body: departmentUpdateSchema,
        querystring: departmentEmptySchema,
        response: {
          200: departmentResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
        },
      },
    },
    updateDepartmentController,
  );
}
