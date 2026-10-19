# Tarefa 14 — Departamentos

- **Marco:** M2 — Configuração da clínica
- **Status:** 🔄
- **Objetivo:** criar, listar, editar e desativar departamentos.
- **Entrega:** `POST/GET /departments`, `PATCH /departments/:id`; prefixo único na filial e imutável; limite de 5; visibilidade por role.
- **Como conferir:** criar Técnico (TEC), Financeiro (FIN), Reparos (REP); testes de prefixo repetido, limite e permissões.
- **Depende de:** 10.
- **Tamanho:** média.

## Implementação

- Módulo `department`: `POST /departments`, `GET /departments` (paginado) e `PATCH /departments/:id`.
- Criar/editar: OWNER e ADMIN (e BRANCH_ADMIN, quando existir). Prefixo normalizado para maiúsculas, `^[A-Z0-9]{1,4}$`, único na filial e imutável (enviar `prefix` no PATCH → 400).
- Conflitos: prefixo ativo → `409 DepartmentPrefixAlreadyExistsException`; prefixo de excluído → `409 DeletedDepartmentExistsException` com `meta.deletedId`; limite de 5 por filial (inativos contam, excluídos não) → `409 DepartmentLimitReachedException`.
- Listagem: OWNER/ADMIN veem todos (inclusive inativos); demais roles só os ativos liberados para elas. Ordem por nome.
- Paginação compartilhada em `src/shared/http/pagination.ts` (`?page&pageSize`, padrão 20, máximo 100).

## Como conferir

```sh
npx vitest run src/modules/department src/shared/http/pagination.test.ts
```
