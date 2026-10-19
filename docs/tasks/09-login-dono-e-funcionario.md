# Tarefa 09 — Login (dono e funcionário)

- **Marco:** M1 — Cadastro e acesso
- **Status:** 🔄
- **Objetivo:** `POST /auth/login` nos dois formatos.
- **Entrega:** dono por e-mail; funcionário por slug + username; token JWT (8h) com Matriz; resposta com usuário, organização, filial e licença.
- **Como conferir:** testes de sucesso nos dois formatos; credenciais erradas → `401` sem revelar o motivo; usuário/organização inativos → `403`; licença vencida não impede login.
- **Depende de:** 07.
- **Tamanho:** média.

## Implementação

`POST /auth/login` com e-mail do OWNER ou slug + username, normalização, schemas estritos e hash fictício para usuário inexistente. JWT HS256 de 8h com a Matriz, `JWT_SECRET` obrigatória (mínimo 32 caracteres), resposta com licença e erros padronizados. Documentação Scalar e testes de integração dos dois fluxos.

## Como conferir

Definir `JWT_SECRET` conforme `.env.example`. Executar `npm run lint`, `npm run typecheck`, `npm run format:check` e `npm test` (somente login: `npm test -- src/modules/auth/auth.routes.test.ts`). Com `npm run dev`, conferir `POST /auth/login` em `/docs`, incluindo os dois bodies e respostas 200/400/401/403.
