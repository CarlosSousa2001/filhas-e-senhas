import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { loggerOptions } from './logger.js';

it('oculta credenciais em logs estruturados, arrays, causas e headers sem alterar os dados', async () => {
  const lines: string[] = [];
  const app = Fastify({
    logger: {
      ...loggerOptions,
      stream: {
        write: (line: string) => {
          lines.push(line);
        },
      },
    },
  });
  const secrets = {
    password: 'secret-password',
    passwordConfirmation: 'secret-confirmation',
    currentPassword: 'secret-current',
    newPassword: 'secret-new',
    passwordHash: 'secret-hash',
    password_hash: 'secret-db-hash',
    accessToken: 'secret-access',
    refreshToken: 'secret-refresh',
    token: 'secret-token',
  };
  try {
    app.get('/log', async (request) => {
      app.log.info(
        {
          ...secrets,
          body: secrets,
          req: { headers: request.headers, body: secrets },
          nested: { items: [{ user: secrets }] },
        },
        'Diagnóstico',
      );
      app.log.error({
        err: new Error('Falha', { cause: Object.assign(new Error('Causa'), secrets) }),
      });
      return { ok: true };
    });
    const response = await app.inject({
      url: '/log',
      headers: { authorization: 'Bearer secret-header' },
    });
    expect(response.statusCode).toBe(200);
    const logs = lines.join('');
    for (const secret of Object.values(secrets)) expect(logs).not.toContain(secret);
    expect(logs).not.toContain('secret-header');
    expect(logs).toContain('[Redacted]');
    expect(logs).toContain('Diagnóstico');
    expect(logs).toContain('Causa');
    expect(secrets.password).toBe('secret-password');
  } finally {
    await app.close();
  }
});
