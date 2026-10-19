import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { getUniqueViolationConstraint } from '../database/unique-violation.js';
import { AppError } from './app-error.js';
import {
  ConflictException,
  ForbiddenException,
  InternalServerError,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './common-exceptions.js';
import type { ApiErrorResponse } from '../types/api-error-response.js';

function fastifyClientError(statusCode: number): AppError {
  switch (statusCode) {
    case 400:
      return new ValidationException();
    case 401:
      return new UnauthorizedException();
    case 403:
      return new ForbiddenException();
    case 404:
      return new NotFoundException();
    case 409:
      return new ConflictException();
    case 413:
      return new AppError('Corpo da requisição muito grande', 413, 'PayloadTooLargeException');
    case 415:
      return new AppError('Tipo de conteúdo não suportado', 415, 'UnsupportedMediaTypeException');
    case 429:
      return new AppError(
        'Muitas requisições. Tente novamente em instantes.',
        429,
        'RateLimitExceededException',
      );
    default:
      return new AppError('Requisição inválida', statusCode, 'BadRequestException');
  }
}

export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    let normalized: AppError;

    if (error instanceof AppError) {
      normalized = error;
    } else if (hasZodFastifySchemaValidationErrors(error)) {
      normalized = new ValidationException(
        error.validation.map((issue) => ({
          field: issue.instancePath.replace(/^\//, '').split('/').join('.'),
          message: issue.message ?? 'Valor inválido',
        })),
      );
    } else if (error instanceof ZodError) {
      normalized = new ValidationException(
        error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    } else if (getUniqueViolationConstraint(error) !== undefined) {
      normalized = new ConflictException();
    } else if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.startsWith('FST_ERR_') &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      normalized = fastifyClientError(error.statusCode);
    } else {
      request.log.error({ err: error }, 'Erro interno do servidor');
      normalized = new InternalServerError();
    }

    const response: ApiErrorResponse = {
      message: normalized.message,
      statusCode: normalized.statusCode,
      exception: normalized.exception,
      ...(normalized.meta !== undefined && { meta: normalized.meta }),
      ...(normalized instanceof ValidationException &&
        normalized.errors !== undefined && { errors: normalized.errors }),
    };
    return reply.status(response.statusCode).send(response);
  });

  app.setNotFoundHandler((_request, reply) => {
    const response: ApiErrorResponse = {
      message: 'Rota não encontrada',
      statusCode: 404,
      exception: 'RouteNotFoundException',
    };
    return reply.status(404).send(response);
  });
}
