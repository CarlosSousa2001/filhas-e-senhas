import { MAX_SERVICE_POINTS_PER_DEPARTMENT } from '../../shared/constants/index.js';
import { AppError } from '../../shared/errors/app-error.js';

export class ServicePointNotFoundException extends AppError {
  constructor() {
    super('Guichê não encontrado', 404, 'ServicePointNotFoundException');
  }
}

export class ServicePointAlreadyAssociatedException extends AppError {
  constructor() {
    super(
      'Este guichê já está associado ao departamento',
      409,
      'ServicePointAlreadyAssociatedException',
    );
  }
}

export class ServicePointLimitReachedException extends AppError {
  constructor() {
    super(
      `Limite de ${MAX_SERVICE_POINTS_PER_DEPARTMENT} guichês por departamento atingido`,
      409,
      'ServicePointLimitReachedException',
    );
  }
}
