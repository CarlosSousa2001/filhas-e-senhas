import { generateRandomCode } from '../../shared/utils/random-code.js';

/** Tamanho da parte aleatória do código da senha (seção 26 do contexto). */
export const TICKET_RANDOM_CODE_LENGTH = 7;

/** Código da senha: prefixo do departamento + "-" + 7 caracteres aleatórios (ex.: TEC-A7K92P1). */
export function generateTicketCode(prefix: string): string {
  return `${prefix}-${generateRandomCode(TICKET_RANDOM_CODE_LENGTH)}`;
}
