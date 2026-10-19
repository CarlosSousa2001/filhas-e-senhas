# Tarefa 16 — Usuários e acesso a departamentos

- **Marco:** M2 — Configuração da clínica
- **Status:** ⬜
- **Objetivo:** criar, listar e editar usuários; liberar acesso a departamentos.
- **Entrega:** `POST/GET /users`, `PATCH /users/:userId`, `POST /users/:userId/departments`; username gerado; regras de role e desativação.
- **Como conferir:** criar as 2 atendentes e o usuário VIEWER da TV, com acesso aos 3 departamentos; testes de permissões (ADMIN não cria ADMIN, ninguém desativa a si mesmo, etc.).
- **Depende de:** 14.
- **Tamanho:** grande.
