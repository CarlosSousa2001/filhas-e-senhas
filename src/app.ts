import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { organizationRoutes } from './modules/organization/organization.routes.js';
import { registerDocs } from './shared/http/docs.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import { loggerOptions } from './shared/http/logger.js';

/**
 * Monta a aplicação Fastify sem abrir porta.
 * Usado pelo server.ts (produção/desenvolvimento) e pelos testes (app.inject).
 */
export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test' ? loggerOptions : false,
  }).withTypeProvider<ZodTypeProvider>();

  // O mesmo schema Zod valida a entrada, filtra a saída e gera a documentação.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  // A documentação precisa ser registrada antes das rotas.
  if (env.DOCS_ENABLED) {
    await registerDocs(app);
  }

  await app.register(healthRoutes);
  await app.register(organizationRoutes);

  return app;
}
