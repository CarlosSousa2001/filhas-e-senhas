import { randomInt } from 'node:crypto';
import type * as crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateRandomCode } from './random-code.js';

vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof crypto>()),
  randomInt: vi.fn((await importOriginal<typeof crypto>()).randomInt),
}));

afterEach(() => vi.mocked(randomInt).mockReset());

describe('generateRandomCode', () => {
  it.each([1, 7, 36, 100])('gera %i caracteres de A–Z e 0–9', (length) => {
    const result = generateRandomCode(length);
    expect(result).toHaveLength(length);
    expect(result).toMatch(/^[A-Z0-9]+$/);
  });

  it('usa crypto e permite todos os caracteres do alfabeto', () => {
    for (let index = 0; index < 36; index++) {
      vi.mocked(randomInt as (max: number) => number).mockReturnValueOnce(index);
    }
    expect(generateRandomCode(36)).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    expect(randomInt).toHaveBeenCalledWith(36);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita tamanho inválido: %s',
    (length) => expect(() => generateRandomCode(length)).toThrow(RangeError),
  );
});
