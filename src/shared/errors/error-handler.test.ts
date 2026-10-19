import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../../app.js';
import { AppError } from './app-error.js';
import {
  ConflictException,
  ForbiddenException,
  InternalServerError,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './common-exceptions.js';
import { apiErrorResponseSchema } from '../types/api-error-response.js';

const internalError = {
  message: 'Erro interno do servidor',
  statusCode: 500,
  exception: 'InternalServerError',
};

describe('tratamento global de erros', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  async function throwingRoute(error: unknown) {
    app = await buildApp();
    app.get(
      '/test-error',
      {
        schema: { tags: ['Test'], response: { default: apiErrorResponseSchema } },
      },
      async () => {
        throw error;
      },
    );
    return app.inject('/test-error');
  }

  it.each([
    [new ValidationException(), 400, 'ValidationException', 'Dados inválidos'],
    [new UnauthorizedException(), 401, 'UnauthorizedException', 'Não autenticado'],
    [new ForbiddenException(), 403, 'ForbiddenException', 'Acesso negado'],
    [new NotFoundException(), 404, 'NotFoundException', 'Recurso não encontrado'],
    [new ConflictException(), 409, 'ConflictException', 'Conflito com um registro existente'],
    [new InternalServerError(), 500, 'InternalServerError', 'Erro interno do servidor'],
  ])('preserva a exceção %s', async (error, statusCode, exception, message) => {
    const response = await throwingRoute(error);
    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toEqual({ message, statusCode, exception });
  });

  it('preserva meta de um AppError específico', async () => {
    const response = await throwingRoute(
      new AppError('Registro excluído', 409, 'DeletedRecordExistsException', { deletedId: '123' }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Registro excluído',
      statusCode: 409,
      exception: 'DeletedRecordExistsException',
      meta: { deletedId: '123' },
    });
  });

  it('preserva FieldError de ValidationException', async () => {
    const errors = [{ field: 'name', message: 'Nome é obrigatório' }];
    const response = await throwingRoute(new ValidationException(errors));
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Dados inválidos',
      statusCode: 400,
      exception: 'ValidationException',
      errors,
    });
  });

  it.each(['body', 'querystring', 'params'] as const)(
    'converte validação de %s sem prefixo',
    async (part) => {
      app = await buildApp();
      app.post(
        part === 'params' ? '/validation/:name' : '/validation',
        {
          schema: {
            tags: ['Test'],
            [part]: z.object({
              name: z.string().min(3, 'Nome deve possuir no mínimo 3 caracteres'),
            }),
            response: { 200: z.object({}), 400: apiErrorResponseSchema },
          },
        },
        async () => ({}),
      );
      const response = await app.inject({
        method: 'POST',
        url:
          part === 'params'
            ? '/validation/a'
            : part === 'querystring'
              ? '/validation?name=a'
              : '/validation',
        payload: part === 'body' ? { name: 'a' } : undefined,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        message: 'Dados inválidos',
        statusCode: 400,
        exception: 'ValidationException',
        errors: [{ field: 'name', message: 'Nome deve possuir no mínimo 3 caracteres' }],
      });
    },
  );

  it('converte caminhos aninhados e índices de arrays, preservando nomes de campos', async () => {
    app = await buildApp();
    app.post(
      '/nested',
      {
        schema: {
          body: z.object({
            body: z.array(z.object({ name: z.string().min(1, 'Nome é obrigatório') })),
          }),
        },
      },
      async () => ({}),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/nested',
      payload: { body: [{ name: '' }] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Dados inválidos',
      statusCode: 400,
      exception: 'ValidationException',
      errors: [{ field: 'body.0.name', message: 'Nome é obrigatório' }],
    });
  });

  it.each([
    ['application/json', '{invalid', 400, 'ValidationException', 'Dados inválidos'],
    [
      'application/unsupported',
      'data',
      415,
      'UnsupportedMediaTypeException',
      'Tipo de conteúdo não suportado',
    ],
    [
      'application/json',
      JSON.stringify({ value: 'a'.repeat(100) }),
      413,
      'PayloadTooLargeException',
      'Corpo da requisição muito grande',
    ],
  ])(
    'normaliza erros Fastify: %s %s',
    async (contentType, payload, statusCode, exception, message) => {
      app = await buildApp();
      app.post('/parser', { bodyLimit: 50 }, async () => ({}));
      const response = await app.inject({
        method: 'POST',
        url: '/parser',
        headers: { 'content-type': contentType },
        payload,
      });
      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ message, statusCode, exception });
    },
  );

  it.each([false, true])('converte unicidade (encapsulado: %s)', async (wrapped) => {
    const pgError = Object.assign(new Error('duplicate key SQL segredo'), {
      code: '23505',
      constraint: 'uq_private',
    });
    const response = await throwingRoute(
      wrapped
        ? new Error('Drizzle query', { cause: new Error('wrapper', { cause: pgError }) })
        : pgError,
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Conflito com um registro existente',
      statusCode: 409,
      exception: 'ConflictException',
    });
  });

  it('converte unicidade sem nome de constraint', async () => {
    const response = await throwingRoute(Object.assign(new Error('pg'), { code: '23505' }));
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Conflito com um registro existente',
      statusCode: 409,
      exception: 'ConflictException',
    });
  });

  it('retorna 500 sem detalhes e registra o erro original', async () => {
    app = await buildApp();
    const error = Object.assign(new Error('SELECT password_hash FROM users; detalhe privado'), {
      statusCode: 401,
      code: '23503',
    });
    const log = vi.spyOn(app.log, 'error');
    app.get('/unexpected', async () => {
      throw error;
    });
    const response = await app.inject('/unexpected');
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(internalError);
    expect(log).toHaveBeenCalledWith({ err: error }, 'Erro interno do servidor');
  });

  it('trata falha de serialização como erro interno, não de entrada', async () => {
    app = await buildApp();
    app.get(
      '/serialization',
      {
        schema: { response: { 200: z.object({ name: z.string() }), 500: apiErrorResponseSchema } },
      },
      async () => ({ name: 123 as unknown as string }),
    );
    const response = await app.inject('/serialization');
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(internalError);
  });

  it('converte ZodError lançado diretamente', async () => {
    const result = z
      .object({ name: z.string().min(1, 'Nome é obrigatório') })
      .safeParse({ name: '' });
    const response = await throwingRoute(result.error);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Dados inválidos',
      statusCode: 400,
      exception: 'ValidationException',
      errors: [{ field: 'name', message: 'Nome é obrigatório' }],
    });
  });

  it('preserva outros status 4xx do Fastify sem expor sua mensagem', async () => {
    const response = await throwingRoute(
      Object.assign(new Error('internal detail'), { code: 'FST_ERR_TEST', statusCode: 406 }),
    );
    expect(response.statusCode).toBe(406);
    expect(response.json()).toEqual({
      message: 'Requisição inválida',
      statusCode: 406,
      exception: 'BadRequestException',
    });
  });

  it('padroniza rotas inexistentes', async () => {
    app = await buildApp();
    const response = await app.inject('/does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'Rota não encontrada',
      statusCode: 404,
      exception: 'RouteNotFoundException',
    });
  });

  it('documenta erros, campos e meta no OpenAPI consumido pelo Scalar', async () => {
    await throwingRoute(new ConflictException());
    const response = await app.inject('/docs/openapi.json');
    expect(response.statusCode).toBe(200);
    const schema =
      response.json().paths['/test-error'].get.responses.default.content['application/json'].schema;
    expect(schema.required).toEqual(['message', 'statusCode', 'exception']);
    expect(Object.keys(schema.properties)).toEqual([
      'message',
      'statusCode',
      'exception',
      'errors',
      'meta',
    ]);
    expect(schema.properties.errors.items.required).toEqual(['field', 'message']);
    expect((await app.inject('/docs/')).statusCode).toBe(200);
  });
});
