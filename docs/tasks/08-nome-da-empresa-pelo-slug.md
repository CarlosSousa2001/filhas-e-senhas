# Tarefa 08 — Nome da empresa pelo slug

- **Marco:** M1 — Cadastro e acesso
- **Status:** 🔄
- **Objetivo:** `GET /organizations/by-slug/:slug` para a tela de login do funcionário.
- **Entrega:** retorna `{ name }`; inexistente, inativa ou excluída → `404`.
- **Como conferir:** testes dos três casos.
- **Depende de:** 07.
- **Tamanho:** pequena.

## Implementação

- `GET /organizations/by-slug/:slug` no módulo `organization` (repository `findActiveNameBySlug`, com `notDeleted`).
- Retorna apenas `{ name }`; slug em maiúsculas é normalizado; inexistente, inativa ou excluída → `404 OrganizationNotFoundException`.
- Testes em `organization-by-slug.routes.test.ts`.

## Como conferir

```sh
npm test
curl http://localhost:3333/organizations/by-slug/<slug-da-empresa>
```
