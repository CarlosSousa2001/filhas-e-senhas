import fastifySwagger from '@fastify/swagger';
import fastifyApiReference from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Documentação da API: OpenAPI gerado a partir dos schemas Zod das rotas,
 * exibido pelo Scalar em /docs (especificação em /docs/openapi.json).
 *
 * Precisa ser registrado antes das rotas, para que todas apareçam na especificação.
 */
export async function registerDocs(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Filas e Senhas — API',
        description: 'API do sistema de filas e senhas de atendimento.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifyApiReference, {
    routePrefix: '/docs',
    logLevel: 'silent',
  });
}
