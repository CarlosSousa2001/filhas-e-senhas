# Tarefas do MVP — Backend

> Lista de tarefas pequenas, em ordem. Cada tarefa tem o seu arquivo nesta pasta, com objetivo, entrega e como conferir.
>
> Regra de trabalho: **uma tarefa por vez**. Ao terminar, mostro o resultado; você confere e aprova antes da próxima.
>
> Referências: `queue-system-context.md` (o que construir) e `queue-system-guidelines.md` (como construir).
>
> **Definição de pronto (vale para toda tarefa com endpoint):** testes passando **e** a rota aparecendo no Scalar (`/docs`) com request, respostas e erros documentados.

## Cenário de referência (Carlos)

```text
Organização: Nen Protocol System (dono: Carlos Sousa)
Filial:      Matriz
Departments: Técnico (TEC), Financeiro (FIN), Reparos (REP)
Balcões:     Balcão 1, Balcão 2 (um por computador)
Usuários:    2 atendentes + 1 usuário VIEWER para a TV do salão
```

O MVP está pronto quando este cenário funcionar de ponta a ponta pela API:

1. Carlos cadastra a organização e faz login.
2. Cria os 3 departamentos, os 2 balcões, as 2 atendentes e o usuário da TV.
3. A atendente entra no Balcão 1, gera uma senha para um cliente e pode cancelá-la.
4. As atendentes chamam senhas (a próxima ou uma da lista), rechamam, finalizam ou marcam não compareceu.
5. A TV mostra a senha chamada agora e as últimas chamadas.

## Status

| Símbolo | Significado |
|---|---|
| ⬜ | A fazer |
| 🔄 | Em andamento |
| ✅ | Feita e aprovada |
| ⏸️ | Bloqueada (aguardando decisão) |

## Visão geral

| # | Tarefa | Marco | Status |
|---|---|---|---|
| 01 | [Estrutura base do projeto](01-estrutura-base-do-projeto.md) | M0 — Fundação | ✅ |
| 02 | [Docker Compose com Postgres](02-docker-compose-com-postgres.md) | M0 — Fundação | ⬜ |
| 03 | [Schema do banco (Drizzle) + migration](03-schema-do-banco-drizzle-migration.md) | M0 — Fundação | ⬜ |
| 04 | [Tratamento de erros padrão](04-tratamento-de-erros-padrao.md) | M0 — Fundação | ⬜ |
| 05 | [Funções utilitárias](05-funcoes-utilitarias.md) | M0 — Fundação | ⬜ |
| 06 | [Infraestrutura de testes](06-infraestrutura-de-testes.md) | M0 — Fundação | ⬜ |
| 07 | [Cadastro da organização](07-cadastro-da-organizacao.md) | M1 — Cadastro e acesso | ⬜ |
| 08 | [Nome da empresa pelo slug](08-nome-da-empresa-pelo-slug.md) | M1 — Cadastro e acesso | ⬜ |
| 09 | [Login (dono e funcionário)](09-login-dono-e-funcionario.md) | M1 — Cadastro e acesso | ⬜ |
| 10 | [Proteção das rotas (middleware)](10-protecao-das-rotas-middleware.md) | M1 — Cadastro e acesso | ⬜ |
| 11 | [Usuário logado (`/auth/me`)](11-usuario-logado-auth-me.md) | M1 — Cadastro e acesso | ⬜ |
| 12 | [Troca e redefinição de senha](12-troca-e-redefinicao-de-senha.md) | M1 — Cadastro e acesso | ⬜ |
| 13 | [Limite de requisições (rate limit)](13-limite-de-requisicoes-rate-limit.md) | M1 — Cadastro e acesso | ⬜ |
| 14 | [Departamentos](14-departamentos.md) | M2 — Configuração da clínica | ⬜ |
| 15 | [Balcões (guichês)](15-balcoes-guiches.md) | M2 — Configuração da clínica | ⬜ |
| 16 | [Usuários e acesso a departamentos](16-usuarios-e-acesso-a-departamentos.md) | M2 — Configuração da clínica | ⬜ |
| 17 | [Dados de exemplo (seed)](17-dados-de-exemplo-seed.md) | M2 — Configuração da clínica | ⬜ |
| 18 | [Gerar senha no balcão](18-gerar-senha-no-balcao.md) | M3 — Senhas no balcão | ⬜ |
| 19 | [Cancelar senha](19-cancelar-senha.md) | M3 — Senhas no balcão | ⬜ |
| 20 | [Sessão no balcão](20-sessao-no-balcao.md) | M4 — Atendimento | ⬜ |
| 21 | [Chamar a próxima senha](21-chamar-a-proxima-senha.md) | M4 — Atendimento | ⬜ |
| 22 | [Lista de espera e chamada específica](22-lista-de-espera-e-chamada-especifica.md) | M4 — Atendimento | ⬜ |
| 23 | [Rechamar, finalizar, não compareceu](23-rechamar-finalizar-nao-compareceu.md) | M4 — Atendimento | ⬜ |
| 24 | [Painel da TV](24-painel-da-tv.md) | M5 — Painel da TV | ⬜ |

Ao terminar uma tarefa: atualizar o status **no arquivo da tarefa e nesta tabela**.

---

## Fora do MVP

Totem, dispositivo de TV com tempo real (WebSocket), várias filiais, exclusão e restauração, expiração automática no fim do dia, relatórios, auditoria completa, verificação de e-mail, pagamentos.
