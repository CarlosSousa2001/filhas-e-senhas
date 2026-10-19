import { randomInt } from 'node:crypto';
import { MAX_SLUG_LENGTH, MIN_SLUG_LENGTH, RESERVED_SLUGS } from '../constants/index.js';

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, '') || 'organizacao'
  );
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH &&
    slug === slug.trim() &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
  );
}

export function appendRandomSlugSuffix(slug: string): string {
  const base = slugify(slug)
    .slice(0, MAX_SLUG_LENGTH - 5)
    .replace(/-+$/g, '');
  const suffix = randomInt(10_000).toString().padStart(4, '0');
  return `${base}-${suffix}`;
}
