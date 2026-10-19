# Tarefa 15 — Balcões (guichês)

- **Marco:** M2 — Configuração da clínica
- **Status:** ✅
- **Objetivo:** criar, listar, editar, desativar e associar balcões a departamentos.
- **Entrega:** `POST /service-points`, `PATCH /service-points/:id`, `GET /departments/:id/service-points`, `POST /departments/:id/service-points`; limite de 10.
- **Como conferir:** criar Balcão 1 e Balcão 2 e associar aos 3 departamentos.
- **Depende de:** 14.
- **Tamanho:** média.

## Implementação

- Módulo `service-point`: `POST /service-points`, `PATCH /service-points/:id`, `GET /departments/:departmentId/service-points` (paginado) e `POST /departments/:departmentId/service-points`.
- Criar, editar e associar: OWNER e ADMIN. Nome livre (pode repetir). Guichê e departamento precisam ser da filial do token (`404` caso contrário).
- Associação repetida → `409 ServicePointAlreadyAssociatedException`; limite de 10 guichês por departamento (inativos contam, excluídos não) → `409 ServicePointLimitReachedException`. Um guichê pode atender vários departamentos.
- Listagem por departamento: OWNER/ADMIN veem todos; demais roles só os ativos dos departamentos liberados para elas.

## Como conferir

```sh
npx vitest run src/modules/service-point
```
