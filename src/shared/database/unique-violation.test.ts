import { describe, expect, it } from 'vitest';
import { getUniqueViolationConstraint } from './unique-violation.js';

describe('getUniqueViolationConstraint', () => {
  const violation = { code: '23505', constraint: 'uq_users_owner_email' };

  it('identifica o erro direto e encapsulado em várias causas', () => {
    expect(getUniqueViolationConstraint(violation)).toBe('uq_users_owner_email');
    expect(
      getUniqueViolationConstraint(
        new Error('Drizzle', { cause: new Error('pg', { cause: violation }) }),
      ),
    ).toBe('uq_users_owner_email');
  });

  it('identifica uma violação mesmo sem constraint', () => {
    expect(getUniqueViolationConstraint({ code: '23505' })).toBeNull();
    expect(getUniqueViolationConstraint({ code: '23505', constraint: 123 })).toBeNull();
  });

  it.each([null, undefined, '23505', 23505, {}, { code: '23503' }, new Error('outro erro')])(
    'ignora valores que não são violações: %s',
    (value) => expect(getUniqueViolationConstraint(value)).toBeUndefined(),
  );

  it('encerra cadeias circulares e ainda reconhece uma violação nelas', () => {
    const first: { cause?: unknown } = {};
    const second = { cause: first };
    first.cause = second;
    expect(getUniqueViolationConstraint(first)).toBeUndefined();
    Object.assign(second, violation);
    expect(getUniqueViolationConstraint(first)).toBe('uq_users_owner_email');
  });
});
