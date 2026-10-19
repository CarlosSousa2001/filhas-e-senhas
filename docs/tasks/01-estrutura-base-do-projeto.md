# Tarefa 01 — Estrutura base do projeto

- **Marco:** M0 — Fundação
- **Status:** ✅
- **Objetivo:** projeto Node.js + TypeScript + Fastify rodando.
- **Entrega:** `package.json` (npm), TypeScript, Fastify, Zod (`fastify-type-provider-zod`), Vitest, ESLint/Prettier, estrutura de pastas `src/modules` e `src/shared`, `GET /health`, `.env.example`, documentação OpenAPI (`@fastify/swagger`) com UI **Scalar** em `/docs` (ligada por `DOCS_ENABLED`).
- **Como conferir:** `npm run dev` sobe a API; `GET /health` responde `{ "status": "ok" }`; abrir `http://localhost:3333/docs` e ver o `GET /health` documentado no Scalar; `npm test` roda (mesmo sem testes ainda).
- **Depende de:** nada.
- **Tamanho:** pequena.
