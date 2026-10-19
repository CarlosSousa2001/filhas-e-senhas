import { AppError } from '../../shared/errors/app-error.js';

export class UserNotFoundException extends AppError {
  constructor() {
    super('Usuário não encontrado', 404, 'UserNotFoundException');
  }
}
