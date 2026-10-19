import { AppError } from '../../shared/errors/app-error.js';
import { MAX_DEPARTMENTS_PER_BRANCH } from '../../shared/constants/index.js';

export class DepartmentNotFoundException extends AppError {
  constructor() {
    super('Departamento não encontrado', 404, 'DepartmentNotFoundException');
  }
}

export class DepartmentPrefixAlreadyExistsException extends AppError {
  constructor() {
    super(
      'Já existe um departamento com este prefixo',
      409,
      'DepartmentPrefixAlreadyExistsException',
    );
  }
}

/** Conflito com departamento excluído: o frontend pode oferecer a restauração (meta.deletedId). */
export class DeletedDepartmentExistsException extends AppError {
  constructor(deletedId: string) {
    super(
      'Já existe um departamento excluído com este prefixo. Deseja restaurá-lo?',
      409,
      'DeletedDepartmentExistsException',
      { deletedId },
    );
  }
}

export class DepartmentLimitReachedException extends AppError {
  constructor() {
    super(
      `Limite de ${MAX_DEPARTMENTS_PER_BRANCH} departamentos por filial atingido`,
      409,
      'DepartmentLimitReachedException',
    );
  }
}
