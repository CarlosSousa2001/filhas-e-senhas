import { randomInt } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESERVED_SLUGS } from '../constants/index.js';
import { appendRandomSlugSuffix, isReservedSlug, isValidSlug, slugify } from './slug.js';

vi.mock('node:crypto', () => ({ randomInt: vi.fn() }));

beforeEach(() => {
  vi.mocked(randomInt).mockReset();
  vi.mocked(randomInt as (max: number) => number).mockReturnValue(7);
});

describe('slugify', () => {
  it.each([
    ['Clínica Sorriso', 'clinica-sorriso'],
    ['Laboratório Vida', 'laboratorio-vida'],
    [' -- Ação & Saúde___123 !! ', 'acao-saude-123'],
    ['Cafe\u0301', 'cafe'],
    ['', 'organizacao'],
    ['!!!', 'organizacao'],
    ['AB', 'ab'],
    ['Login', 'login'],
    ['a'.repeat(61), 'a'.repeat(60)],
    [`${'a'.repeat(59)} b`, 'a'.repeat(59)],
  ])('transforma %s em %s', (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });
});

describe('validação de slug', () => {
  it.each(RESERVED_SLUGS)('reconhece o reservado %s', (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it('separa formato válido de reserva', () => {
    expect(isReservedSlug('clinica-sorriso')).toBe(false);
    expect(isValidSlug('login')).toBe(true);
  });

  it.each(['abc', 'a-1', 'a'.repeat(60)])('aceita %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['', 'ab', 'a'.repeat(61), '-abc', 'abc-', 'a--b', 'ABC', 'ação', 'a_b', 'a.b', 'abc\n'])(
    'rejeita %s',
    (slug) => expect(isValidSlug(slug)).toBe(false),
  );
});

describe('appendRandomSlugSuffix', () => {
  it('acrescenta quatro dígitos, inclusive zeros à esquerda', () => {
    expect(appendRandomSlugSuffix('login')).toBe('login-0007');
    expect(randomInt).toHaveBeenCalledWith(10_000);
    vi.mocked(randomInt as (max: number) => number).mockReturnValue(9999);
    expect(appendRandomSlugSuffix('ab')).toBe('ab-9999');
  });

  it.each(['a'.repeat(60), `${'a'.repeat(54)}-bcdef`, '', '!!!'])(
    'mantém formato válido e no máximo 60 caracteres: %s',
    (slug) => {
      const result = appendRandomSlugSuffix(slug);
      expect(result.length).toBeLessThanOrEqual(60);
      expect(isValidSlug(result)).toBe(true);
      expect(result).toMatch(/-0007$/);
    },
  );
});
