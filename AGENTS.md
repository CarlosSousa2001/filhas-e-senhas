# AGENTS.md

Backend de um SaaS multi-tenant de filas e senhas de atendimento (Node.js + TypeScript + Fastify + PostgreSQL/Drizzle + Zod + JWT + Vitest).

## Fonte de verdade

Antes de escrever ou revisar código, ler:

- `docs/queue-system-context.md` — o que o sistema faz (domínio e regras de negócio)
- `docs/queue-system-guidelines.md` — como construir (arquitetura, convenções e **"Regras para IA"**, seção 46)
- `docs/schema-example-db` — modelo do banco (referência para o schema do Drizzle)
- `docs/tasks/` — tarefas do MVP, uma por arquivo, em ordem, com "como conferir" (índice e status em `docs/tasks/README.md`)

Se o código e os documentos divergirem, os documentos vencem. Não reabrir decisões já registradas; se algo não estiver definido, perguntar em vez de inventar.

## Forma de trabalho

- **Uma tarefa de `docs/tasks/` por vez**, na ordem. Não adiantar trabalho de tarefas seguintes.
- Ao terminar, atualizar o status no arquivo da tarefa e em `docs/tasks/README.md` e descrever o que mudou e como conferir.
- Respostas e mensagens para o usuário em **português**; código, nomes de arquivos e identificadores em inglês.
- Preferir a solução mais simples que atenda à tarefa; nada de abstração genérica sem necessidade.

## Definição de pronto

Uma tarefa só está pronta quando:

1. `npm test` passa (testes da tarefa incluídos);
2. `npm run lint` e a checagem de tipos passam;
3. toda rota criada aparece corretamente no Scalar (`/docs`) com request, respostas e erros;
4. o "como conferir" do arquivo da tarefa funciona.

## Regras que mais causam erro

- Organização e filial vêm **sempre do token** (`request.user.organizationId` / `branchId`), nunca de body, query ou params.
- Toda consulta filtra `deleted_at IS NULL` com `notDeleted(...)`, exceto restauração, conflito e histórico.
- Toda rota declara `schema` Zod (body, params, querystring, response), `tags` e erros (`ApiErrorResponse`).
- Erros de negócio usam `AppError`; nunca devolver erro bruto do PostgreSQL, ORM ou JWT.
- Violação de unicidade vira `409`; valor gerado que colide → refazer a transação (até 5 tentativas).
- Toda mudança de status de senha grava `TicketHistory` na mesma transação.
- Nunca logar senha, hash ou token.
