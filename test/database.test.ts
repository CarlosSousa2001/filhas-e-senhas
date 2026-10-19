import { expect, it } from 'vitest';
import { validateTestDatabaseUrl } from './database.js';

it.each([
  'postgresql://postgres:postgres@localhost:5432/senhas',
  'postgresql://localhost/senhas_test?database=senhas',
  'postgresql://localhost/senhas_test_backup',
  'postgresql://localhost/',
  'invalid',
])('bloqueia uma URL insegura: %s', (url) => {
  expect(() => validateTestDatabaseUrl(url)).toThrow('nome do banco termina em _test');
});

it('aceita um banco separado com sufixo _test', () => {
  expect(() => validateTestDatabaseUrl('postgresql://localhost/senhas_test')).not.toThrow();
});
