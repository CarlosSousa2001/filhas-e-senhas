# Tarefa 19 — Cancelar senha

- **Marco:** M3 — Senhas no balcão
- **Status:** 🔄
- **Objetivo:** `POST /tickets/:id/cancel`.
- **Entrega:** `WAITING`/`IN_SERVICE` → `CANCELLED`, motivo opcional, evento `CANCELLED`.
- **Como conferir:** testes; cancelar senha já finalizada → `409`.
- **Depende de:** 18.
- **Tamanho:** pequena.

## Implementação

- `POST /tickets/:id/cancel` com body opcional `{ reason? }` (até 100 caracteres).
- Qualquer role exceto VIEWER, para senhas de qualquer departamento da filial do token; senha de outra organização/filial → `404 TicketNotFoundException`.
- `WAITING`/`IN_SERVICE` → `CANCELLED` por atualização condicional (duas ações simultâneas: uma vence, a outra recebe `409`); outros status → `409 InvalidTicketStatusException`.
- Grava `cancel_reason` e o evento `CANCELLED` (motivo em `metadata`) na mesma transação.

## Como conferir

```sh
npx vitest run src/modules/ticket/ticket-cancel.routes.test.ts
```
