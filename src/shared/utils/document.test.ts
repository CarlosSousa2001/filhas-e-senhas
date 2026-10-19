import { describe, expect, it } from 'vitest';
import { isValidDocument, normalizeDocument } from './document.js';

describe('document', () => {
  it('remove tudo exceto dígitos, preservando zeros iniciais', () => {
    expect(normalizeDocument(' 012.345.678-90 abc ')).toBe('01234567890');
    expect(normalizeDocument('12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizeDocument('')).toBe('');
  });

  it.each(['012.345.678-90', '12.345.678/0001-90', '00000000000', '00000000000000'])(
    'aceita %s sem verificar dígitos verificadores',
    (value) => expect(isValidDocument(value)).toBe(true),
  );

  it.each(['', 'abc', '1'.repeat(10), '1'.repeat(12), '1'.repeat(13), '1'.repeat(15)])(
    'rejeita tamanho inválido: %s',
    (value) => expect(isValidDocument(value)).toBe(false),
  );
});
