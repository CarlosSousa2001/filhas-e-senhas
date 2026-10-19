import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase } from '../../../test/helpers.js';
import { env } from '../../env.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  // Limites baixos só neste arquivo (o env é lido ao montar as rotas).
  env.RATE_LIMIT_LOGIN_PER_IP = 4;
  env.RATE_LIMIT_LOGIN_PER_ACCOUNT = 2;
  env.RATE_LIMIT_SIGNUP_PER_HOUR = 2;
  env.RATE_LIMIT_PUBLIC_PER_MINUTE = 2;
  app = await createTestApp();
});

beforeEach(resetDatabase);

const rateLimitResponse = {
  message: 'Muitas requisições. Tente novamente em instantes.',
  statusCode: 429,
  exception: 'RateLimitExceededException',
};

function login(payload: Record<string, unknown>, ip = '10.0.0.1') {
  return app.inject({ method: 'POST', url: '/auth/login', payload, remoteAddress: ip });
}

describe('rate limit', () => {
  it('limita tentativas de login por conta', async () => {
    const payload = { email: 'carlos@example.com', password: 'qualquer' };

    expect((await login(payload)).statusCode).toBe(401);
    expect((await login(payload)).statusCode).toBe(401);
    const blocked = await login(payload);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual(rateLimitResponse);
  });

  it('o limite por conta não bloqueia outras contas', async () => {
    const payload = { email: 'carlos@example.com', password: 'qualquer' };
    await login(payload, '10.0.0.2');
    await login(payload, '10.0.0.2');

    const other = await login({ email: 'outra@example.com', password: 'qualquer' }, '10.0.0.2');

    expect(other.statusCode).toBe(401);
  });

  it('limita tentativas de login por IP, mesmo variando a conta', async () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 4; i++) {
      expect((await login({ email: `conta${i}@example.com`, password: 'x' }, ip)).statusCode).toBe(
        401,
      );
    }

    const blocked = await login({ email: 'conta-nova@example.com', password: 'x' }, ip);

    expect(blocked.statusCode).toBe(429);
  });

  it('limita cadastros de organização por IP', async () => {
    const signup = () =>
      app.inject({
        method: 'POST',
        url: '/organizations',
        payload: {},
        remoteAddress: '10.0.0.4',
      });

    expect((await signup()).statusCode).toBe(400);
    expect((await signup()).statusCode).toBe(400);
    const blocked = await signup();

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual(rateLimitResponse);
  });

  it('limita a consulta pública do nome da empresa por IP', async () => {
    const getBySlug = () =>
      app.inject({
        method: 'GET',
        url: '/organizations/by-slug/nao-existe',
        remoteAddress: '10.0.0.5',
      });

    expect((await getBySlug()).statusCode).toBe(404);
    expect((await getBySlug()).statusCode).toBe(404);
    expect((await getBySlug()).statusCode).toBe(429);
  });

  it('não limita rotas sem configuração (ex.: /health)', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        remoteAddress: '10.0.0.6',
      });
      expect(response.statusCode).toBe(200);
    }
  });
});
