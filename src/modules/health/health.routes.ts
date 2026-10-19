import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { healthResponseSchema } from './health.schema.js';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Verifica se a API está no ar',
        description: 'Usada para checagem de disponibilidade. Não exige autenticação.',
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
};
