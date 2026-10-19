import { AppError } from '../../shared/errors/app-error.js';

export class InvalidCredentialsException extends AppError {
  constructor() {
    super('Credenciais inválidas', 401, 'InvalidCredentialsException');
  }
}

export class InvalidCurrentPasswordException extends AppError {
  constructor() {
    super('Senha atual incorreta', 400, 'InvalidCurrentPasswordException');
  }
}
