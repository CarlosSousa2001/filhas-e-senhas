import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { is, Table } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema/index.js';

describe('Schema do banco', () => {
  it('reproduz o catálogo do SQL de referência na primeira migration', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const suffix = randomUUID().replaceAll('-', '');
    const referenceSchema = `reference_${suffix}`;
    const migrationSchema = `migration_${suffix}`;
    const reference = readFileSync('docs/schema-example-db', 'utf8');
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
      entries: { tag: string }[];
    };
    const migration = readFileSync(`drizzle/${journal.entries[0]!.tag}.sql`, 'utf8');

    await client.connect();
    try {
      await client.query('BEGIN');
      const catalogs = [];
      for (const [namespace, source] of [
        [referenceSchema, reference],
        [migrationSchema, migration.replaceAll('"public".', `"${migrationSchema}".`)],
      ] as const) {
        await client.query(`CREATE SCHEMA "${namespace}"`);
        await client.query(`SET LOCAL search_path TO "${namespace}", public`);
        await client.query(source);

        const columns = await client.query(
          `SELECT c.relname AS table_name, a.attname AS column_name,
                  format_type(a.atttypid, a.atttypmod) AS type,
                  a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_value
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid
           LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
           WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
           ORDER BY c.relname, a.attnum`,
          [namespace],
        );
        const constraints = await client.query(
          `SELECT c.relname AS table_name, con.conname AS name,
                  pg_get_constraintdef(con.oid) AS definition
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = $1 ORDER BY c.relname, con.conname`,
          [namespace],
        );
        const indexes = await client.query(
          `SELECT tablename, indexname, replace(indexdef, quote_ident($1) || '.', '') AS definition
           FROM pg_indexes WHERE schemaname = $1 ORDER BY tablename, indexname`,
          [namespace],
        );
        const enums = await client.query(
          `SELECT t.typname AS name, e.enumlabel AS value
           FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = $1 ORDER BY t.typname, e.enumsortorder`,
          [namespace],
        );
        catalogs.push({
          columns: columns.rows,
          constraints: constraints.rows,
          indexes: indexes.rows,
          enums: enums.rows,
        });
      }
      expect(catalogs[1]).toEqual(catalogs[0]);
    } finally {
      try {
        await client.query('ROLLBACK');
      } finally {
        await client.end();
      }
    }
  });

  it('atualiza updated_at pela aplicação em todas as tabelas que possuem a coluna', () => {
    const tables = Object.values(schema).filter((value) => is(value, Table));
    for (const table of tables) {
      const column = getTableConfig(table).columns.find((column) => column.name === 'updated_at');
      if (column) {
        const before = Date.now();
        const updatedAt = column.onUpdateFn?.();
        expect(updatedAt).toBeInstanceOf(Date);
        expect((updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
        expect((updatedAt as Date).getTime()).toBeLessThanOrEqual(Date.now());
      }
    }
  });
});
