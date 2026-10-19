import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde que a API está no ar', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('aparece documentado na especificação OpenAPI', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' });

    expect(response.statusCode).toBe(200);

    const spec = response.json();
    const health = spec.paths['/health']?.get;

    expect(health?.tags).toEqual(['Health']);
    expect(health?.responses?.['200']).toBeDefined();
  });
});
