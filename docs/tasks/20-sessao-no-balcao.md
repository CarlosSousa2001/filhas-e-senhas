# Tarefa 20 — Sessão no balcão

- **Marco:** M4 — Atendimento
- **Status:** ⬜
- **Objetivo:** atendente entra, sai e libera balcão.
- **Entrega:** `POST /operator-sessions`, `POST /operator-sessions/current/close`, `POST /service-points/:id/release` (com `AuditLog`).
- **Como conferir:** testes de balcão ocupado, usuário já em sessão, liberação forçada (incluindo a senha em atendimento virando não compareceu).
- **Depende de:** 15, 16.
- **Tamanho:** média.
- **Decisão:** ao liberar à força um balcão que tem uma senha em atendimento, essa senha vira **não compareceu** (`NO_SHOW`), na mesma transação que encerra a sessão.
