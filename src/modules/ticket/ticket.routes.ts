import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  OPERATOR_ROLES,
  authMiddleware,
  requireBranch,
  requireRole,
} from '../../shared/auth/auth-middleware.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import { createTicketController, listTicketDepartmentsController } from './ticket.controller.js';
import {
  ticketCreateSchema,
  ticketDepartmentResponseListSchema,
  ticketEmptySchema,
  ticketResponseSchema,
} from './ticket.schema.js';

const authErrors = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
};

export async function ticketRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operate = [authMiddleware, requireBranch, requireRole(...OPERATOR_ROLES)];

  routes.get(
    '/tickets/departments',
    {
      preHandler: operate,
      schema: {
        tags: ['Tickets'],
        summary: 'Departamentos para gerar senha',
        description:
          'Todos os departamentos ativos da filial (não filtra por acesso do usuário), para a tela de geração de senha do balcão. VIEWER não tem acesso.',
        security: [{ bearerAuth: [] }],
        querystring: paginationQuerySchema,
        response: {
          200: ticketDepartmentResponseListSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
        },
      },
    },
    listTicketDepartmentsController,
  );

  routes.post(
    '/tickets',
    {
      preHandler: operate,
      schema: {
        tags: ['Tickets'],
        summary: 'Gerar senha',
        description:
          'Gera a senha PREFIXO-XXXXXXX (WAITING) para um departamento ativo da filial do token. O dia da senha é o de São Paulo. Qualquer role exceto VIEWER; departamento inexistente, de outra filial, inativo ou excluído → 404.',
        security: [{ bearerAuth: [] }],
        body: ticketCreateSchema,
        querystring: ticketEmptySchema,
        response: {
          201: ticketResponseSchema,
          400: apiErrorResponseSchema,
          ...authErrors,
          404: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    createTicketController,
  );
}
