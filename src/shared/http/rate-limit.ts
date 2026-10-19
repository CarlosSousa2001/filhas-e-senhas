import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { RateLimitExceededException } from '../errors/common-exceptions.js';

const errorResponseBuilder = () => new RateLimitExceededException();

/**
 * Registra o rate limit sem limite global: cada rota pública declara o seu.
 * Store em memória (instância única da API). O IP vem de request.ip, que respeita
 * o TRUST_PROXY (X-Forwarded-For enviado pelo servidor do Next.js).
 * Precisa ser registrado antes das rotas.
 */
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(fastifyRateLimit, { global: false, errorResponseBuilder });
}

/** Limite por IP, aplicado antes de ler o body (config.rateLimit da rota). */
export function perIp(max: number, timeWindow: string) {
  return { max, timeWindow, errorResponseBuilder };
}

/**
 * Limite por chave de negócio (ex.: conta do login), aplicado como preHandler,
 * depois da validação do body.
 *
 * Usa createRateLimit (apenas verifica) em vez de app.rateLimit: o plugin aplica só um
 * limitador por requisição, e o limite por IP da rota já roda antes, no onRequest.
 */
export function perKey(
  app: FastifyInstance,
  options: {
    max: number;
    timeWindow: string;
    keyGenerator: (request: FastifyRequest) => string;
  },
) {
  const check = app.createRateLimit(options);
  return async (request: FastifyRequest) => {
    const result = await check(request);
    if (!result.isAllowed && result.isExceeded) {
      throw new RateLimitExceededException();
    }
  };
}
