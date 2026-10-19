import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateRandomCode(length: number): string {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError('O tamanho deve ser um inteiro positivo.');
  }

  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}
