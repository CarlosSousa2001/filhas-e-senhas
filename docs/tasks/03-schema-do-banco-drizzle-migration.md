# Tarefa 03 — Schema do banco (Drizzle) + migration

- **Marco:** M0 — Fundação
- **Status:** ✅
- **Objetivo:** todas as tabelas do `schema-example-db` criadas pelo Drizzle.
- **Entrega:** schema em TypeScript, primeira migration, `npm run db:migrate`.
- **Como conferir:** rodar a migration e ver as tabelas, enums, constraints e índices no banco.
- **Depende de:** 02.
- **Tamanho:** média.

## Implementação

- `src/shared/database/schema/`: 14 tabelas e 8 enums (uma tabela por arquivo + `index.ts`), com os mesmos nomes de constraints e índices do `schema-example-db`; `updated_at` atualizado pela aplicação (`$onUpdate`).
- `src/shared/database/client.ts`: conexão (`pg` Pool + Drizzle); `DATABASE_URL` obrigatória em `src/env.ts`.
- `drizzle.config.ts` e scripts `db:generate` / `db:migrate`; primeira migration em `drizzle/0000_initial_schema.sql`.
- `src/shared/database/schema.test.ts`: aplica o SQL de referência e a migration em schemas temporários do banco `senhas_test` e compara tabelas, colunas, defaults, enums, constraints e índices (tudo desfeito por rollback).

## Como conferir

```sh
npm run db:migrate     # aplica a migration no banco senhas
npm run db:generate    # deve responder "No schema changes"
npm test               # inclui o teste de equivalência com o SQL de referência
```
