@AGENTS.md

## Papel do Claude Code neste projeto

O Claude Code implementa as tarefas de `docs/tasks/`, uma por vez, seguindo o `AGENTS.md`.

Quando o Codex estiver disponível e for usado para implementar, o Claude Code passa a revisar cada entrega antes de o usuário aprovar:

1. Ler o arquivo da tarefa em `docs/tasks/` (objetivo, entrega, como conferir).
2. Ler a diferença (`git diff` da branch da tarefa).
3. Conferir contra os documentos de `docs/`, especialmente as "Regras para IA" (`queue-system-guidelines.md`, seção 46).
4. Rodar `npm test`, o lint e a checagem de tipos.
5. Devolver um relatório em português, curto, em três partes:
   - **Bloqueia:** bugs, regra de negócio violada, falha de segurança, teste faltando para um caso descrito na tarefa;
   - **Ajustar:** desvio de convenção dos documentos;
   - **Ok:** o que foi conferido e está certo.

## Git

- Uma branch por tarefa (`task/NN-descricao`); um commit por tarefa.
- Merge na `main` (`--no-ff`) somente depois da aprovação do usuário; depois, push.
