import { expect, it } from 'vitest';
import { normalizeEmail } from './email.js';

it('normaliza e-mail com trim e minúsculas', () => {
  expect(normalizeEmail(' \tCamila+Contato@Example.COM\n')).toBe('camila+contato@example.com');
  expect(normalizeEmail('camila@example.com')).toBe('camila@example.com');
  expect(normalizeEmail('  ')).toBe('');
});
