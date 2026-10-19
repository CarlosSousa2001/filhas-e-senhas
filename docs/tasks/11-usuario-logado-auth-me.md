# Tarefa 11 — Usuário logado (`/auth/me`)

- **Marco:** M1 — Cadastro e acesso
- **Status:** ✅
- **Objetivo:** `GET /auth/me`.
- **Entrega:** mesmo formato do login, sem token; responde mesmo com licença vencida.
- **Como conferir:** testes.
- **Depende de:** 10.
- **Tamanho:** pequena.

## Implementação

- `GET /auth/me` no módulo `auth`, protegida por `authenticate({ allowInvalidLicense: true })`.
- Devolve `user`, `organization` (com slug), `branch` e `license` (com `valid`) — o formato do login sem o token; documentada no Scalar com `bearerAuth`.
- Testes em `auth-me.routes.test.ts`.

## Como conferir

```sh
npx vitest run src/modules/auth
```
