# Tarefa 12 — Troca e redefinição de senha

- **Marco:** M1 — Cadastro e acesso
- **Status:** 🔄
- **Objetivo:** `PATCH /auth/password` e `PATCH /users/:userId/password`.
- **Entrega:** troca própria (com senha atual); redefinição por OWNER/ADMIN; atualiza `password_changed_at`.
- **Como conferir:** testes; token antigo para de funcionar após a troca.
- **Depende de:** 10.
- **Tamanho:** pequena.

## Implementação

- `PATCH /auth/password` (módulo `auth`): exige a senha atual (`400 InvalidCurrentPasswordException`), aplica a política 8–128 e devolve um token novo.
- `PATCH /users/:userId/password` (novo módulo `user`): OWNER e ADMIN; ADMIN não redefine a do OWNER (`403`); usuário de outra organização ou excluído → `404`; responde `204`.
- As duas atualizam `password_changed_at`; o middleware compara com a claim `iatMs` do token (milissegundos) e derruba as sessões anteriores.
- `newPasswordSchema` compartilhado em `src/shared/auth/password.schema.ts`; fixtures de teste em `test/fixtures.ts`.

## Como conferir

```sh
npx vitest run src/modules/auth/auth-password.routes.test.ts src/modules/user
```
