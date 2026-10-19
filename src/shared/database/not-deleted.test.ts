import { PgDialect, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';
import { notDeleted } from './not-deleted.js';

it('gera o filtro IS NULL para a coluna deletedAt sem acessar o banco', () => {
  const table = pgTable('example', { deletedAt: timestamp('deleted_at') });
  const query = new PgDialect().sqlToQuery(notDeleted(table));
  expect(query.sql).toBe('"example"."deleted_at" is null');
  expect(query.params).toEqual([]);
});
