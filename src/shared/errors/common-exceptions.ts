import { AppError } from './app-error.js';
import type { FieldError } from '../types/api-error-response.js';

export class ValidationException extends AppError {
  constructor(public readonly errors?: FieldError[]) {
    super('Dados inválidos', 400, 'ValidationException');
  }
}

export class UnauthorizedException extends AppError {
  constructor() {
    super('Não autenticado', 401, 'UnauthorizedException');
  }
}

export class ForbiddenException extends AppError {
  constructor() {
    super('Acesso negado', 403, 'ForbiddenException');
  }
}

export class NotFoundException extends AppError {
  constructor() {
    super('Recurso não encontrado', 404, 'NotFoundException');
  }
}

export class ConflictException extends AppError {
  constructor() {
    super('Conflito com um registro existente', 409, 'ConflictException');
  }
}

export class InternalServerError extends AppError {
  constructor() {
    super('Erro interno do servidor', 500, 'InternalServerError');
  }
}
