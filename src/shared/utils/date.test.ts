import { describe, expect, it } from 'vitest';
import { getServiceDate } from './date.js';

describe('getServiceDate', () => {
  it.each([
    ['2026-03-10T02:30:00Z', '2026-03-09'],
    ['2026-03-10T02:59:59.999Z', '2026-03-09'],
    ['2026-03-10T03:00:00Z', '2026-03-10'],
    ['2026-01-01T02:00:00Z', '2025-12-31'],
    ['2024-03-01T02:30:00Z', '2024-02-29'],
    ['2026-03-09T23:30:00-03:00', '2026-03-09'],
  ])('converte %s para %s sem alterar o instante', (instant, expected) => {
    const now = new Date(instant);
    const timestamp = now.getTime();
    expect(getServiceDate(now)).toBe(expected);
    expect(now.getTime()).toBe(timestamp);
  });
});
