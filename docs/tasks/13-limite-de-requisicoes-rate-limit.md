# Tarefa 13 — Limite de requisições (rate limit)

- **Marco:** M1 — Cadastro e acesso
- **Status:** ✅
- **Objetivo:** proteger login, cadastro e busca por slug.
- **Entrega:** limites por IP (e por conta no login), configuráveis por variável de ambiente; resposta `429`.
- **Como conferir:** teste que excede o limite.
- **Depende de:** 09.
- **Tamanho:** pequena.

## Implementação

- `@fastify/rate-limit` sem limite global (`src/shared/http/rate-limit.ts`), store em memória; IP via `request.ip`, que respeita `TRUST_PROXY`.
- Limites (configuráveis por variável de ambiente): login 60/min por IP + 10/min por conta (e-mail, ou empresa + usuário); cadastro 30/hora por IP; `GET /organizations/by-slug/:slug` 120/min por IP.
- Ao exceder: `429 RateLimitExceededException`, documentado no Scalar das rotas.
- O limite por conta usa `createRateLimit` num preHandler, porque o plugin executa apenas um limitador por requisição.

## Como conferir

```sh
npx vitest run src/shared/http/rate-limit.test.ts
```
