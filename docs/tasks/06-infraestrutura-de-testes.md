# Tarefa 06 — Infraestrutura de testes

- **Marco:** M0 — Fundação
- **Status:** ✅
- **Objetivo:** testes de integração contra o Postgres real.
- **Entrega:** configuração do Vitest com o banco `senhas_test`, limpeza antes de cada execução, helper para subir a API em teste e fazer requisições.
- **Como conferir:** um teste de exemplo que chama `GET /health` e consulta o banco.
- **Depende de:** 02, 03.
- **Tamanho:** pequena.

## Implementação

Vitest usa `DATABASE_URL_TEST` do ambiente ou `.env`, com fallback para `postgresql://postgres:postgres@localhost:5432/senhas_test`, e bloqueia bancos sem sufixo `_test`. O setup aplica as migrations de `drizzle/` e limpa as tabelas públicas antes de cada execução, preservando o controle de migrations. Os arquivos rodam sem paralelismo; `test/helpers.ts` fornece `createTestApp()`, `resetDatabase()`, `db` e `pool`, com fechamento automático das aplicações e conexões. O exemplo verifica `/health`, escrita/leitura e limpeza do banco.

## Como conferir

Com o PostgreSQL disponível e o banco de teste criado: `npm run lint`, `npm run typecheck`, `npm run format:check` e `npm test`. Para executar apenas o exemplo: `npm test -- test/infrastructure.test.ts`.
