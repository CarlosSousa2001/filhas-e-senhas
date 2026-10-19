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
  associateServicePointController,
  createServicePointController,
  listDepartmentServicePointsController,
  updateServicePointController,
} from './service-point.controller.js';
import {
  departmentIdParamsSchema,
  servicePointAssociateSchema,
  servicePointCreateSchema,
  servicePointEmptySchema,
  servicePointIdParamsSchema,
  servicePointResponseListSchema,
  servicePointResponseSchema,
  servicePointUpdateSchema,
} from './service-point.schema.js';

const authErrors = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
};

export async function servicePointRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const manage = [authMiddleware, requireBranch, requireRole(...BRANCH_MANAGEMENT_ROLES)];

  routes.post(
    '/service-points',
    {
      preHandler: manage,
      schema: {
        tags: ['Service points'],
        summary: 'Criar guichê',
        description: 'OWNER/ADMIN. Cria um guichê (balcão, mesa, sala…) na filial. Nome livre.',
        security: [{ bearerAuth: [] }],
        body: servicePointCreateSchema,
        querystring: servicePointEmptySchema,
        response: {
          201: servicePointResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
        },
      },
    },
    createServicePointController,
  );

  routes.patch(
    '/service-points/:id',
    {
      preHandler: manage,
      schema: {
        tags: ['Service points'],
        summary: 'Editar ou desativar guichê',
        description: 'OWNER/ADMIN. Altera nome e/ou active.',
        security: [{ bearerAuth: [] }],
        params: servicePointIdParamsSchema,
        body: servicePointUpdateSchema,
        querystring: servicePointEmptySchema,
        response: {
          200: servicePointResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
        },
      },
    },
    updateServicePointController,
  );

  routes.get(
    '/departments/:departmentId/service-points',
    {
      preHandler: [authMiddleware, requireBranch],
      schema: {
        tags: ['Service points'],
        summary: 'Listar guichês de um departamento',
        description:
          'OWNER/ADMIN veem todos os guichês (inclusive inativos) de qualquer departamento da filial; as demais roles, só os ativos dos departamentos liberados para elas.',
        security: [{ bearerAuth: [] }],
        params: departmentIdParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: servicePointResponseListSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
        },
      },
    },
    listDepartmentServicePointsController,
  );

  routes.post(
    '/departments/:departmentId/service-points',
    {
      preHandler: manage,
      schema: {
        tags: ['Service points'],
        summary: 'Associar guichê a um departamento',
        description:
          'OWNER/ADMIN. Departamento e guichê da mesma filial. Limite de 10 guichês por departamento (inativos contam). Guichê já associado → 409.',
        security: [{ bearerAuth: [] }],
        params: departmentIdParamsSchema,
        body: servicePointAssociateSchema,
        querystring: servicePointEmptySchema,
        response: {
          201: servicePointResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    associateServicePointController,
  );
}
