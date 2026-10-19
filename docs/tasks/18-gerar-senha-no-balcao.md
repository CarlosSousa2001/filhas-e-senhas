# Tarefa 18 — Gerar senha no balcão

- **Marco:** M3 — Senhas no balcão
- **Status:** 🔄
- **Objetivo:** `GET /tickets/departments` e `POST /tickets`.
- **Entrega:** senha `PREFIXO-XXXXXXX`, `WAITING`, dia de São Paulo, evento `CREATED`.
- **Como conferir:** gerar senhas para os 3 departamentos; VIEWER recebe `403`; departamento de outra organização → `404`.
- **Depende de:** 14.
- **Tamanho:** média.

## Implementação

- Módulo `ticket`: `GET /tickets/departments` (todos os departamentos ativos da filial, paginado) e `POST /tickets`.
- Qualquer role exceto VIEWER (`OPERATOR_ROLES` em `src/shared/auth/auth-middleware.ts`); não consulta `user_department_access`.
- Código `PREFIXO-XXXXXXX` (`generate-ticket-code.ts`); `service_date` (dia de São Paulo) e `created_at` do mesmo instante; senha `WAITING` + evento `CREATED` na mesma transação.
- Código repetido no mesmo dia → gera outro e refaz a transação (até 5 tentativas). Departamento inexistente, inativo, excluído ou de outra filial → `404`.

## Como conferir

```sh
npx vitest run src/modules/ticket
```
