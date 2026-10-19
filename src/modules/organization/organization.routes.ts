import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { apiErrorResponseSchema } from '../../shared/types/api-error-response.js';
import {
  createOrganizationController,
  getOrganizationBySlugController,
} from './organization.controller.js';
import {
  organizationCreateSchema,
  organizationEmptySchema,
  organizationPublicResponseSchema,
  organizationResponseSchema,
  organizationSlugParamsSchema,
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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/by-slug/:slug',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Nome da empresa pelo slug',
        description:
          'Rota pública usada pela tela de login do funcionário (app.senhas.com/<slug>/login) para mostrar o nome da empresa. Organização inexistente, inativa ou excluída retorna 404.',
        params: organizationSlugParamsSchema,
        querystring: organizationEmptySchema,
        response: {
          200: organizationPublicResponseSchema,
          404: apiErrorResponseSchema,
        },
      },
    },
    getOrganizationBySlugController,
  );
}
