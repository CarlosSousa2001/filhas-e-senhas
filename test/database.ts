import type { Pool } from 'pg';

export function validateTestDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !decodeURIComponent(url.pathname.slice(1)).endsWith('_test') ||
      url.searchParams.has('database')
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'DATABASE_URL_TEST deve ser uma URL PostgreSQL cujo nome do banco termina em _test, sem parâmetro database. Testes contra senhas são proibidos.',
    );
  }
}

export async function assertTestDatabase(pool: Pool) {
  const result = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (!result.rows[0]?.name.endsWith('_test')) {
    throw new Error('Operação bloqueada: o banco conectado deve terminar em _test.');
  }
}

export async function truncateTestDatabase(pool: Pool) {
  await assertTestDatabase(pool);
  const tables = await pool.query<{ name: string }>(
    `SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS name
     FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'`,
  );
  if (tables.rows.length > 0) {
    await pool.query(
      `TRUNCATE TABLE ${tables.rows.map((table) => table.name).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}
