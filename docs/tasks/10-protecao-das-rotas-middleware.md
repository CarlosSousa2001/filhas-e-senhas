# Tarefa 10 — Proteção das rotas (middleware)

- **Marco:** M1 — Cadastro e acesso
- **Status:** ⬜
- **Objetivo:** `authMiddleware`, `requireBranch` e verificação de role.
- **Entrega:** valida token; busca usuário no banco; bloqueia usuário/organização inativos, licença inválida e token anterior à troca de senha.
- **Como conferir:** testes com token ausente, inválido, de usuário desativado, de licença vencida, de role sem permissão.
- **Depende de:** 09.
- **Tamanho:** média.
