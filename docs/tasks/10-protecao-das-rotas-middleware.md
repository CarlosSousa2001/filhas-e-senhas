# Tarefa 10 — Proteção das rotas (middleware)

- **Marco:** M1 — Cadastro e acesso
- **Status:** 🔄
- **Objetivo:** `authMiddleware`, `requireBranch` e verificação de role.
- **Entrega:** valida token; busca usuário no banco; bloqueia usuário/organização inativos, licença inválida e token anterior à troca de senha.
- **Como conferir:** testes com token ausente, inválido, de usuário desativado, de licença vencida, de role sem permissão.
- **Depende de:** 09.
- **Tamanho:** média.

## Implementação

- `src/shared/auth/auth-middleware.ts`:
  - `authMiddleware` (= `authenticate()`): valida o JWT, busca usuário + organização + licença no banco a cada requisição e preenche `request.user` com a role atual do banco;
  - `authenticate({ allowInvalidLicense: true })`: para as rotas que respondem com licença vencida (ex.: `GET /auth/me`);
  - `requireBranch`: exige filial no token (`400 BranchNotSelectedException`);
  - `requireRole(...roles)`: `403 ForbiddenException` para roles sem permissão.
- Respostas: token ausente/inválido/expirado, usuário inexistente, organização divergente, token anterior à troca de senha ou de outra filial (transferência) → `401`; usuário/organização/filial inativos → `403`; licença inválida → `403 LicenseInactiveException`.
- Exceções de autenticação movidas para `src/shared/auth/auth.errors.ts`; `createTestApp` aceita rotas temporárias de teste.

## Como conferir

```sh
npx vitest run src/shared/auth
```
