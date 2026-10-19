# Tarefa 17 — Dados de exemplo (seed)

- **Marco:** M2 — Configuração da clínica
- **Status:** ✅
- **Objetivo:** `npm run db:seed` com o cenário do Carlos pronto.
- **Entrega:** organização Nen Protocol System com Carlos (OWNER), 3 departamentos, 2 balcões, 2 atendentes e o usuário da TV.
- **Como conferir:** rodar o seed e fazer login com os usuários criados.
- **Depende de:** 16.
- **Tamanho:** pequena.

## Implementação

- `src/shared/database/seed.ts` + script `npm run db:seed`, usando os próprios services (todas as regras valem).
- Cria a Nen Protocol System: dono Carlos (`carlos@nen.dev`), departamentos Técnico (TEC), Financeiro (FIN) e Reparos (REP) além do padrão Atendimento (AT), Balcão 1 e Balcão 2 associados aos 3 departamentos, atendentes `ana.balcao1` e `bruno.balcao2` e o VIEWER `tv.salao`, todos com acesso aos 3 departamentos.
- Senha de todos: `senha-dev-123` (apenas desenvolvimento). Idempotente; não roda em produção. Ao final imprime as credenciais e o link de login dos funcionários.

## Como conferir

```sh
npm run db:seed
```
