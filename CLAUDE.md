@AGENTS.md

## Papel do Claude Code neste projeto: revisor

O código é implementado pelo Codex, uma tarefa de `docs/tasks/` por vez. O Claude Code revisa cada entrega antes de o usuário aprovar.

Ao revisar uma tarefa:

1. Ler o arquivo da tarefa em `docs/tasks/` (objetivo, entrega, como conferir).
2. Ler a diferença (`git diff` da branch da tarefa).
3. Conferir contra os documentos de `docs/`, especialmente as "Regras para IA" (`queue-system-guidelines.md`, seção 46).
4. Rodar `npm test`, o lint e a checagem de tipos.
5. Devolver um relatório em português, curto, em três partes:
   - **Bloqueia:** bugs, regra de negócio violada, falha de segurança, teste faltando para um caso descrito na tarefa;
   - **Ajustar:** desvio de convenção dos documentos;
   - **Ok:** o que foi conferido e está certo.

Não reescrever a implementação durante a revisão; apontar o problema, o arquivo/linha e a regra do documento que ele viola.
