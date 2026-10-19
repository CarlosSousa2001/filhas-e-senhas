import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './modules/auth/auth.routes.js';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from './env.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { organizationRoutes } from './modules/organization/organization.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { registerDocs } from './shared/http/docs.js';
import { registerRateLimit } from './shared/http/rate-limit.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';
import { loggerOptions } from './shared/http/logger.js';

// Mensagens padrão de validação do Zod em português.
z.config(z.locales.pt());

/**
 * Monta a aplicação Fastify sem abrir porta.
 * Usado pelo server.ts (produção/desenvolvimento) e pelos testes (app.inject).
 */
export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test' ? loggerOptions : false,
    trustProxy: env.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  // O mesmo schema Zod valida a entrada, filtra a saída e gera a documentação.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: 'HS256', expiresIn: '8h' },
    verify: { algorithms: ['HS256'] },
  });

  // Rate limit e documentação precisam ser registrados antes das rotas.
  await registerRateLimit(app);

  if (env.DOCS_ENABLED) {
    await registerDocs(app);
  }

  await app.register(healthRoutes);
  await app.register(organizationRoutes);
  await app.register(userRoutes);
  await app.register(authRoutes);

  return app;
}
