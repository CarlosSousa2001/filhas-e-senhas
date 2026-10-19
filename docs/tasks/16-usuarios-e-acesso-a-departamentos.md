# Tarefa 16 — Usuários e acesso a departamentos

- **Marco:** M2 — Configuração da clínica
- **Status:** 🔄
- **Objetivo:** criar, listar e editar usuários; liberar acesso a departamentos.
- **Entrega:** `POST/GET /users`, `PATCH /users/:userId`, `POST /users/:userId/departments`; username gerado; regras de role e desativação.
- **Como conferir:** criar as 2 atendentes e o usuário VIEWER da TV, com acesso aos 3 departamentos; testes de permissões (ADMIN não cria ADMIN, ninguém desativa a si mesmo, etc.).
- **Depende de:** 14.
- **Tamanho:** grande.

## Implementação

- Módulo `user`: `POST /users`, `GET /users` (paginado), `PATCH /users/:userId` e `POST /users/:userId/departments` (além do `PATCH /users/:userId/password` da Tarefa 12). Todas só para OWNER e ADMIN.
- Roles atribuíveis na V1: ADMIN, MANAGER, ATTENDANT, VIEWER (OWNER é único; BRANCH_ADMIN só com multi-filial). ADMIN cria e troca apenas entre MANAGER, ATTENDANT e VIEWER, e não altera o OWNER.
- Username opcional: gerado do primeiro nome (`ana.1234`, 6 dígitos se faltar espaço) e único na organização; e-mail opcional e único na organização. Conflito com excluído → `409 DeletedUserExistsException` com `meta.deletedId`.
- ADMIN não tem filial; ao rebaixar um ADMIN, o usuário recebe a filial do token. Ninguém desativa a si mesmo nem o OWNER; desativado é bloqueado na hora.
- Acesso a departamento: só para usuários de filial, departamento da mesma filial; repetido → `409`.

## Como conferir

```sh
npx vitest run src/modules/user
```
