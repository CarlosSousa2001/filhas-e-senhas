import { AppError } from '../../shared/errors/app-error.js';

export class UserNotFoundException extends AppError {
  constructor() {
    super('Usuário não encontrado', 404, 'UserNotFoundException');
  }
}

export class UsernameAlreadyExistsException extends AppError {
  constructor() {
    super('Este nome de usuário já está em uso', 409, 'UsernameAlreadyExistsException');
  }
}

export class UserEmailAlreadyExistsException extends AppError {
  constructor() {
    super('Este e-mail já está em uso na organização', 409, 'UserEmailAlreadyExistsException');
  }
}

/** Conflito com usuário excluído: o frontend pode oferecer a restauração (meta.deletedId). */
export class DeletedUserExistsException extends AppError {
  constructor(deletedId: string) {
    super(
      'Já existe um usuário excluído com este nome de usuário ou e-mail. Deseja restaurá-lo?',
      409,
      'DeletedUserExistsException',
      { deletedId },
    );
  }
}

export class UserDepartmentAccessAlreadyExistsException extends AppError {
  constructor() {
    super(
      'O usuário já tem acesso a este departamento',
      409,
      'UserDepartmentAccessAlreadyExistsException',
    );
  }
}

/** OWNER e ADMIN já veem todos os departamentos; o vínculo só faz sentido para usuários de filial. */
export class OrganizationUserDepartmentAccessException extends AppError {
  constructor() {
    super(
      'OWNER e ADMIN já têm acesso a todos os departamentos',
      400,
      'OrganizationUserDepartmentAccessException',
    );
  }
}
