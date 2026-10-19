import { AppError } from '../../shared/errors/app-error.js';

export class OrganizationDocumentAlreadyExistsException extends AppError {
  constructor() {
    super(
      'Já existe uma organização com este CPF/CNPJ',
      409,
      'OrganizationDocumentAlreadyExistsException',
    );
  }
}

export class OwnerEmailAlreadyExistsException extends AppError {
  constructor() {
    super(
      'Este e-mail já é usado por um dono de organização',
      409,
      'OwnerEmailAlreadyExistsException',
    );
  }
}
