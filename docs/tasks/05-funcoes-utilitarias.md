# Tarefa 05 — Funções utilitárias

- **Marco:** M0 — Fundação
- **Status:** 🔄
- **Objetivo:** funções puras reutilizáveis, testadas.
- **Entrega:** CPF/CNPJ e telefone (normalizar + regex), gerador de slug, gerador de username, gerador de código aleatório, data do dia em `America/Sao_Paulo`, helper `notDeleted`, constantes (`RESERVED_SLUGS`, `APP_TIMEZONE`, limites).
- **Como conferir:** testes unitários (ex.: `"Clínica Sorriso" → clinica-sorriso`; 23:30 em São Paulo continua no mesmo dia).
- **Depende de:** 01.
- **Tamanho:** média.

## Implementação

Utilitários de documento, telefone, e-mail, slug, username, código aleatório com crypto e data no fuso da aplicação; helper `notDeleted` e constantes compartilhadas. Testes unitários ao lado dos arquivos, incluindo limites e virada do dia em São Paulo.

## Como conferir

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
```
