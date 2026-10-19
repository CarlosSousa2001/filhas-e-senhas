import { AppError } from '../../shared/errors/app-error.js';

export class InvalidCredentialsException extends AppError {
  constructor() {
    super('Credenciais inválidas', 401, 'InvalidCredentialsException');
  }
}
