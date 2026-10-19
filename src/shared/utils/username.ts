import { randomInt } from 'node:crypto';
import { MAX_USERNAME_LENGTH } from '../constants/index.js';

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return (
    username.length <= MAX_USERNAME_LENGTH &&
    username === username.trim() &&
    /^[a-z0-9]+([._][a-z0-9]+)*$/.test(username)
  );
}

export function generateUsername(name: string, digits = 4): string {
  if (!Number.isInteger(digits) || digits < 1 || digits > MAX_USERNAME_LENGTH - 2) {
    throw new RangeError('A quantidade de dígitos deve ser um inteiro entre 1 e 58.');
  }

  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const base =
    firstName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]/g, '') || 'usuario';
  const suffix = Array.from({ length: digits }, () => randomInt(10)).join('');
  return `${base.slice(0, MAX_USERNAME_LENGTH - digits - 1)}.${suffix}`;
}
