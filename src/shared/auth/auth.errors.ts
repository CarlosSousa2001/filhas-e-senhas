import { AppError } from '../errors/app-error.js';

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

export class LicenseInactiveException extends AppError {
  constructor() {
    super(
      'A licença da organização não está ativa. Entre em contato com o suporte.',
      403,
      'LicenseInactiveException',
    );
  }
}

export class BranchNotSelectedException extends AppError {
  constructor() {
    super('Nenhuma filial selecionada', 400, 'BranchNotSelectedException');
  }
}
