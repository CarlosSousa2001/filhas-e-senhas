import { AppError } from '../../shared/errors/app-error.js';

export class TicketNotFoundException extends AppError {
  constructor() {
    super('Senha não encontrada', 404, 'TicketNotFoundException');
  }
}

/** Ação não permitida para o status atual da senha (ex.: cancelar uma senha finalizada). */
export class InvalidTicketStatusException extends AppError {
  constructor() {
    super('Ação não permitida para o status atual da senha', 409, 'InvalidTicketStatusException');
  }
}

export class TicketCodeGenerationException extends AppError {
  constructor() {
    super('Não foi possível gerar a senha. Tente novamente.', 409, 'TicketCodeGenerationException');
  }
}
