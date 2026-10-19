import { randomInt } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUsername, isValidUsername, normalizeUsername } from './username.js';

vi.mock('node:crypto', () => ({ randomInt: vi.fn() }));

beforeEach(() => {
  vi.mocked(randomInt).mockReset();
  vi.mocked(randomInt as (max: number) => number).mockReturnValue(0);
});

describe('generateUsername', () => {
  it.each([
    ['Gabriel Silva', 'gabriel.0000'],
    ['  João\tSilva ', 'joao.0000'],
    ['A-na_12 Silva', 'ana12.0000'],
    ['Jose\u0301 Silva', 'jose.0000'],
    ['!!!', 'usuario.0000'],
    ['', 'usuario.0000'],
  ])('gera username para %s', (name, expected) => {
    expect(generateUsername(name)).toBe(expected);
    expect(randomInt).toHaveBeenCalledWith(10);
  });

  it('preserva a ordem dos dígitos aleatórios', () => {
    vi.mocked(randomInt as (max: number) => number)
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(1);
    expect(generateUsername('Gabriel')).toBe('gabriel.4821');
  });

  it.each([1, 6, 58])('permite %i dígitos e limita o nome a 60 caracteres no total', (digits) => {
    const result = generateUsername('a'.repeat(150), digits);
    expect(result).toBe(`${'a'.repeat(59 - digits)}.${'0'.repeat(digits)}`);
    expect(isValidUsername(result)).toBe(true);
  });

  it.each([0, -1, 1.5, 59, NaN, Infinity])('rejeita quantidade inválida: %s', (digits) => {
    expect(() => generateUsername('Ana', digits)).toThrow(RangeError);
  });
});

describe('normalização e validação de username', () => {
  it('normaliza apenas espaços nas pontas e maiúsculas', () => {
    expect(normalizeUsername(' \tANA.Silva_1\n')).toBe('ana.silva_1');
    expect(normalizeUsername(' João Silva ')).toBe('joão silva');
  });

  it.each(['a', 'ana.1234', 'ana_silva.1', 'a'.repeat(60)])('aceita %s', (value) => {
    expect(isValidUsername(value)).toBe(true);
  });

  it.each([
    '',
    'a'.repeat(61),
    'Ana',
    'joão',
    'ana silva',
    '.ana',
    'ana_',
    'a..b',
    'a._b',
    'a__b',
    'a-b',
    'ana\n',
  ])('rejeita %s', (value) => expect(isValidUsername(value)).toBe(false));
});
