import { AppError } from '../../shared/errors/app-error.js';

export class InvalidCredentialsException extends AppError {
  constructor() {
    super('Credenciais inválidas', 401, 'InvalidCredentialsException');
  }
}
export class UserInactiveException extends AppError {
  constructor() {
    super('Usuário inativo', 403, 'UserInactiveException');
  }
}
export class OrganizationInactiveException extends AppError {
  constructor() {
    super('Organização inativa', 403, 'OrganizationInactiveException');
  }
}
export class BranchInactiveException extends AppError {
  constructor() {
    super('Filial inativa', 403, 'BranchInactiveException');
  }
}
