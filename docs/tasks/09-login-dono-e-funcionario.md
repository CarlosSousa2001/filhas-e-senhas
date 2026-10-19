# Tarefa 09 — Login (dono e funcionário)

- **Marco:** M1 — Cadastro e acesso
- **Status:** ⬜
- **Objetivo:** `POST /auth/login` nos dois formatos.
- **Entrega:** dono por e-mail; funcionário por slug + username; token JWT (8h) com Matriz; resposta com usuário, organização, filial e licença.
- **Como conferir:** testes de sucesso nos dois formatos; credenciais erradas → `401` sem revelar o motivo; usuário/organização inativos → `403`; licença vencida não impede login.
- **Depende de:** 07.
- **Tamanho:** média.
