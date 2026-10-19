import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import { createOrganizationController } from './organization.controller.js';
import {
  organizationCreateSchema,
  organizationEmptySchema,
  organizationResponseSchema,
} from './organization.schema.js';

export async function organizationRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/organizations',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Cadastrar organização',
        description:
          'Cria a organização, licença de 30 dias, filial Matriz, dono e departamento Atendimento. Não retorna token.',
        body: organizationCreateSchema,
        params: organizationEmptySchema,
        querystring: organizationEmptySchema,
        response: {
          201: organizationResponseSchema,
          400: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
        },
      },
    },
    createOrganizationController,
  );
}
