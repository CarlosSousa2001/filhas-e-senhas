import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone } from './phone.js';

describe('phone', () => {
  it('mantém apenas dígitos e preserva zeros iniciais', () => {
    expect(normalizePhone(' (01) 2345-6789 abc ')).toBe('0123456789');
    expect(normalizePhone('')).toBe('');
  });

  it.each(['(11) 2345-6789', '(11) 98765-4321', '0000000000', '00000000000'])(
    'aceita 10 ou 11 dígitos: %s',
    (value) => expect(isValidPhone(value)).toBe(true),
  );

  it.each(['', 'abc', '1'.repeat(9), '1'.repeat(12)])('rejeita %s', (value) => {
    expect(isValidPhone(value)).toBe(false);
  });
});
