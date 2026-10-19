# Tarefa 04 — Tratamento de erros padrão

- **Marco:** M0 — Fundação
- **Status:** 🔄
- **Objetivo:** toda resposta de erro no formato `ApiErrorResponse`.
- **Entrega:** `AppError`, error handler global, conversão de erros do Zod (`FieldError[]`), conversão de violação de unicidade do PostgreSQL em `409`, erro inesperado em `500` sem detalhes internos, logger ocultando senhas e token.
- **Como conferir:** testes que forçam cada tipo de erro e verificam o formato da resposta.
- **Depende de:** 01.
- **Tamanho:** média.

## Implementação

Criados `AppError`, exceções comuns, tipos e schema Zod de erros, handlers globais, identificação de unicidade pela cadeia de causas e logger com ocultação de credenciais. Testes cobrem respostas, validação, erros internos, OpenAPI e logs.

## Como conferir

Executar `npm run lint`, `npm run typecheck`, `npm run format:check` e `npm test`.
