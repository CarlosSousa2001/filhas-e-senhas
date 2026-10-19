# Tarefa 02 — Docker Compose com Postgres

- **Marco:** M0 — Fundação
- **Status:** ✅
- **Objetivo:** banco local com um comando.
- **Entrega:** `docker-compose.yml` com Postgres criando os bancos `senhas` e `senhas_test`.
- **Como conferir:** `docker compose up -d`; conectar nos dois bancos.
- **Depende de:** 01.
- **Tamanho:** pequena.

## Implementação

- `docker-compose.yml`: somente Postgres 16, com volume persistente e healthcheck; porta exposta apenas em `127.0.0.1`, configurável por `POSTGRES_PORT` (padrão `5432`).
- `POSTGRES_DB` cria `senhas`; `docker/postgres/init.sql` cria `senhas_test` no mesmo contêiner.
- `.env.example`: URLs dos dois bancos (usuário e senha locais `postgres`).

## Como conferir

```sh
docker compose up -d
docker compose ps
docker compose exec postgres psql -U postgres -d senhas -c "SELECT current_database();"
docker compose exec postgres psql -U postgres -d senhas_test -c "SELECT current_database();"
```

O serviço deve ficar `healthy`, e as consultas devem retornar `senhas` e `senhas_test`.

O `init.sql` roda apenas quando o volume está vazio. Se o volume já existir sem `senhas_test`: `docker compose down -v` e subir de novo (apaga os dados locais).
