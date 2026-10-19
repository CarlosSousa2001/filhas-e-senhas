# Queue System — Guia de Arquitetura e Convenções

> Documento de referência para desenvolvimento do backend.
>
> Objetivo: manter decisões arquiteturais, regras de negócio e convenções consistentes durante a implementação, inclusive ao utilizar IA para gerar ou alterar código.

---

## 1. Visão geral

O projeto é um sistema SaaS multi-tenant para gerenciamento de filas e senhas de atendimento.

Exemplos de clientes:

- clínicas;
- laboratórios;
- escritórios;
- recepções;
- empresas com múltiplos setores;
- ambientes com guichês ou pontos de atendimento.

Cada empresa é uma `Organization` isolada. Dentro dela, cada filial (`Branch`) tem seus próprios usuários, departamentos, guichês e senhas.

Estrutura conceitual:

```text
Organization
├── License                  (uma por organização, cobre todas as filiais)
├── Users de organização     (OWNER, ADMIN)
├── AuditLogs
└── Branches (filiais)
    ├── Users de filial      (BRANCH_ADMIN, MANAGER, ATTENDANT, VIEWER)
    ├── Departments
    ├── ServicePoints
    ├── OperatorSessions
    ├── Tickets
    ├── TicketHistory
    └── PublicDevices
```

---

# 2. Stack definida

Backend:

```text
Node.js
TypeScript
Fastify
PostgreSQL
Drizzle ORM
Drizzle Kit
Zod
JWT
Vitest
Docker
OpenAPI (@fastify/swagger) + Scalar
```

Arquitetura:

```text
Monólito modular
```

Não utilizar microserviços neste momento.

O objetivo é manter uma única API organizada por módulos de negócio.

## Decisões técnicas da V1

```text
Pacotes        npm
Repositório    apenas o backend (frontend Next.js em repositório separado, sem monorepo)
Schema         Drizzle (TypeScript) é a fonte de verdade; migrations geradas pelo drizzle-kit
Senha          argon2; mínimo de 8 e máximo de 128 caracteres
JWT            @fastify/jwt, HS256, segredo em JWT_SECRET, validade de 8h; sem refresh token na V1
Rate limit     @fastify/rate-limit, store em memória (instância única)
Testes         integração com Postgres real (Docker) + unitários para funções puras
Banco de teste mesmo container, banco separado (senhas_test), limpo antes de cada execução
Migrations     drizzle-kit generate; aplicar com npm run db:migrate (manual, nunca ao subir a API)
Seed           npm run db:seed: organização de exemplo com OWNER, ADMIN e ATTENDANT
Docker         docker compose apenas com Postgres (MVP); a API roda localmente
Frontend       Next.js como BFF; sessão em cookie HttpOnly guardando o JWT (mesma validade de 8h)
Acesso         domínio único app.senhas.com; slug da organização só no link de login dos funcionários
Timestamps     updated_at atualizado pela aplicação (Drizzle $onUpdate), sem trigger no banco
Rotas          sem prefixo /api/v1 (só o Next.js chama a API); GET /health para checagem
Documentação   OpenAPI gerado dos schemas Zod (@fastify/swagger + fastify-type-provider-zod); UI Scalar em /docs
```

Frontend e sessão:

```text
Navegador
  │  cookie de sessão HttpOnly, Secure, SameSite=Lax
  │  (o JavaScript da página não acessa o token)
  ▼
Next.js (servidor: Server Actions / Route Handlers)
  │  lê a sessão → pega o JWT
  │  Authorization: Bearer <jwt>
  ▼
API Fastify
```

- o navegador nunca chama o Fastify diretamente; só o servidor do Next.js chama a API;
- o JWT fica guardado dentro da sessão do Next.js (cookie criptografado);
- o Fastify continua recebendo `Authorization: Bearer`;
- não é necessário CORS no Fastify;
- o IP real do cliente (para rate limit) chega em `X-Forwarded-For`, aceito apenas quando a requisição vem do servidor do Next.js (`trustProxy` restrito);
- domínio único para todas as empresas: `app.senhas.com`;
- o slug da organização aparece apenas no link de login dos funcionários (`app.senhas.com/clinica-sorriso/login`); o Next.js lê o slug do caminho da URL e o envia como `organizationSlug` no login.
- logout: o Next.js apaga o cookie da sessão; o backend não tem endpoint de logout. Para derrubar todas as sessões de um usuário, usa-se `password_changed_at` (seção de senha).

JWT:

- o `authMiddleware` valida o token **e** busca o usuário no banco por id;
- usuário desativado/excluído → `403 UserInactiveException`, mesmo com token válido;
- token emitido (`iat`) antes de `users.password_changed_at` → `401 UnauthorizedException`;
- organização desativada/excluída → `403 OrganizationInactiveException`;
- licença inválida → `403 LicenseInactiveException` em todas as rotas autenticadas (o login e `GET /auth/me` continuam funcionando);
- a role usada na autorização é a atual do banco (o token carrega a role apenas como informação).

Repository:

- um objeto `<feature>Repository` com os métodos de persistência (ex.: `organizationRepository.create`, `departmentRepository.findByBranch`); o objeto permite simular falhas do banco nos testes com `vi.spyOn`. O exemplo da seção 44 usa funções soltas apenas por simplicidade.

Role tipada:

```ts
export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "BRANCH_ADMIN"
  | "MANAGER"
  | "ATTENDANT"
  | "VIEWER";
```

Usar `UserRole` (não `string`) no JWT, em `AuthenticatedUser` e nos Requests.

O mesmo vale para os demais enums do banco:

```ts
export type TicketStatus =
  | "WAITING"
  | "IN_SERVICE"
  | "FINISHED"
  | "NO_SHOW"
  | "CANCELLED"
  | "EXPIRED";

export type LicenseStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
```

Idem para `TicketEventType`, `OperatorSessionStatus`, `OperatorSessionEndReason`, `DeviceType`, `DeviceStatus`.

Isolamento nas tabelas sem `organization_id`/`branch_id` (`department_service_points`, `user_department_access`, `operator_sessions`, `ticket_history`):

- o service valida que todos os registros envolvidos pertencem à organização **e à filial** autenticadas antes de gravar.

Paginação:

- toda listagem usa `PaginatedResponse<T>`, mesmo com poucos itens (ex.: `GET /departments`).

Rate limit das rotas públicas (configurável por variável de ambiente):

```text
POST /auth/login      60 / minuto por IP
                      10 / minuto por conta (slug + username, ou email)
POST /organizations   30 / hora por IP
GET  /organizations/by-slug/:slug   120 / minuto por IP
```

Ao exceder: `429 RateLimitExceededException`, no formato `ApiErrorResponse`.

Os limites por IP são propositalmente confortáveis: vários funcionários de uma mesma clínica saem pelo mesmo IP. O limite por conta protege contra adivinhação de senha de um usuário específico.

Limites de departamentos e guichês: contagem simples antes de inserir, sem lock. Ultrapassar o limite em 1 por concorrência é aceito na V1.

---

# 3. Estrutura inicial do projeto

```text
filhas-e-senhas/
├── AGENTS.md / CLAUDE.md              regras para os agentes de IA (apontam para docs/)
├── docs/                              documentação do projeto
├── drizzle/                           migrations geradas pelo drizzle-kit (não editar à mão)
│
├── src/
│   ├── server.ts                      ponto de entrada: sobe o servidor (porta 3333)
│   ├── app.ts                         monta o Fastify: plugins, error handler, docs, rotas
│   ├── env.ts                         lê e valida as variáveis de ambiente com Zod
│   │
│   ├── modules/                       um módulo por assunto do negócio
│   │   ├── organization/
│   │   ├── auth/
│   │   ├── branch/                    (V1: só o necessário para a Matriz)
│   │   ├── license/
│   │   ├── user/
│   │   ├── department/
│   │   ├── service-point/
│   │   ├── operator-session/
│   │   ├── ticket/
│   │   └── health/
│   │
│   └── shared/                        só o que é usado por vários módulos
│       ├── auth/                      authMiddleware, requireBranch, requireRole, JWT
│       ├── database/
│       │   ├── client.ts              conexão com o Postgres
│       │   ├── schema/                tabelas do Drizzle (uma por arquivo) + index.ts
│       │   ├── not-deleted.ts         helper do filtro deleted_at IS NULL
│       │   ├── unique-violation.ts    traduz erro de unicidade do Postgres em 409
│       │   └── seed.ts                npm run db:seed
│       ├── errors/                    AppError, error handler global, exceções comuns
│       ├── http/                      Swagger/Scalar, paginação, logger
│       ├── utils/                     funções puras (document, phone, slug, username, random-code, date)
│       ├── constants/                 APP_TIMEZONE, RESERVED_SLUGS, limites, versão dos termos
│       └── types/                     PaginatedResponse, ApiErrorResponse, UserRole, TicketStatus…
│
├── test/                              apoio aos testes de integração
│   ├── setup.ts                       banco senhas_test, limpeza antes de rodar
│   └── helpers.ts                     sobe a API em teste, cria organização/login de exemplo
│
├── docker-compose.yml                 Postgres com os bancos senhas e senhas_test
├── drizzle.config.ts
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── eslint.config.js / .prettierrc
```

Cada módulo segue aproximadamente (exemplo `ticket`):

```text
ticket/
├── ticket.types.ts           TicketEntity (privada), Ticket, TicketResponse, Requests
├── ticket.schema.ts          schemas Zod: validam, filtram a saída e geram o Scalar
├── ticket.dto.ts             converte Ticket → TicketResponse
├── ticket.repository.ts      consultas ao banco (Drizzle); devolve Ticket
├── ticket.service.ts         regras de negócio; lança exceções
├── ticket.controller.ts      fronteira HTTP
├── ticket.routes.ts          rotas, schemas, middlewares
├── ticket.errors.ts          exceções do módulo
├── generate-ticket-code.ts   regra de negócio própria do módulo
└── ticket.routes.test.ts     testes de integração do módulo
```

Decisões:

- tabelas do Drizzle ficam juntas em `shared/database/schema/` (as tabelas se referenciam e o drizzle-kit gera migrations a partir de um lugar só); módulos importam só as tabelas de que precisam;
- testes unitários ao lado da função (`slug.test.ts`); testes de integração no módulo (`*.routes.test.ts`); `test/` guarda só configuração e helpers;
- exceções específicas em `<modulo>.errors.ts`; em `shared/errors` ficam a base (`AppError`) e as comuns;
- `app.ts` separado de `server.ts`, para os testes subirem a API sem abrir porta.

Não criar camadas apenas por formalidade.

Cada arquivo deve existir porque possui uma responsabilidade clara.

---

# 4. Responsabilidade das camadas

Fluxo padrão:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
```

## Route

Responsável por:

- declarar endpoint;
- definir método HTTP;
- conectar schema;
- conectar controller;
- aplicar autenticação/autorização quando necessário.

Não deve conter regra de negócio.

---

## Controller

Responsável por:

- receber parâmetros HTTP;
- chamar o service;
- transformar o resultado em DTO/Response;
- definir status HTTP quando necessário.

O controller é a fronteira HTTP da feature.

---

## Service

Responsável por:

- regras de negócio;
- validações de domínio;
- orquestração de operações;
- lançamento de exceções de negócio.

Não deve depender de detalhes HTTP.

---

## Repository

Responsável exclusivamente por persistência.

Exemplos:

- `findById`;
- `findByOrganization`;
- `create`;
- `update`;
- `findOldestWaitingTicket`.

Repository retorna entidades/modelos do domínio.

Repository **não retorna DTO HTTP**.

---

# 5. Regra importante sobre tipos entre features

Um módulo não deve depender do `Response` HTTP de outro módulo.

Evitar:

```ts
import type { DepartmentResponse }
  from "../department/department.types";

export type TicketResponse = {
  id: string;
  department: DepartmentResponse;
};
```

Preferir:

```ts
export type TicketResponse = {
  id: string;
  code: string;
  department: {
    id: string;
    name: string;
    prefix: string;
  };
};
```

Mesmo que exista alguma duplicação.

## Regra

> DTO pertence ao endpoint que o devolve.

Uma alteração no `DepartmentResponse` não deve quebrar automaticamente `TicketResponse`.

---

# 6. Convenção de Entity, Request e Response

## Entity

Interfaces representam contratos internos.

Interfaces não são exportadas.

Exemplo:

```ts
interface TicketEntity {
  id: string;
  organizationId: string;
  branchId: string;
  departmentId: string;
  code: string;
  status: TicketStatus;
}
```

Quem está fora do arquivo nunca importa `TicketEntity`. Importa um `type` público derivado dela.

---

## Contrato interno do módulo

Quando repository e service (arquivos diferentes) precisam compartilhar o contrato, exportar um `type` com o nome da feature, derivado da interface privada:

```ts
// ticket.types.ts

interface TicketEntity {
  id: string;
  organizationId: string;
  branchId: string;
  departmentId: string;
  code: string;
  status: TicketStatus;
}

export type Ticket = TicketEntity;

export type TicketResponse = TicketEntity;
```

Papéis:

```text
TicketEntity     → contrato base, privado ao arquivo (interface)
Ticket           → contrato interno exportável entre arquivos do módulo
TicketResponse   → contrato HTTP
```

`Ticket` é usado por repository e service do próprio módulo. Outros módulos não importam `Ticket`, assim como não importam `TicketResponse` (ver seção 5).

---

## Drizzle x contratos do domínio

Não usar `typeof tickets.$inferSelect` como contrato da aplicação. Isso acoplaria service e controller ao Drizzle.

A inferência do Drizzle pode ser usada **dentro do repository**. O repository converte a linha do banco para o contrato do domínio antes de retornar:

```ts
type TicketRow = typeof tickets.$inferSelect; // privado ao repository

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    departmentId: row.departmentId,
    code: row.code,
    status: row.status,
  };
}
```

```text
Database row (Drizzle)  → só no repository
Ticket                  → repository ↔ service
TicketResponse          → controller ↔ HTTP
```

---

## Response único

Padrão:

```text
<Feature>Response
```

Exemplo:

```ts
export type TicketResponse = TicketEntity;
```

---

## Response de lista

Padrão:

```text
<Feature>ResponseList
```

Exemplo:

```ts
export type TicketResponseList =
  PaginatedResponse<TicketResponse>;
```

---

## Request genérico

Quando criação e atualização utilizam o mesmo contrato:

```text
<Feature>Request
```

Exemplo:

```ts
export type DepartmentRequest = {
  name: string;
  prefix: string;
};
```

---

## Request específico

Quando criação e atualização possuem contratos diferentes:

```text
<Feature>CreateRequest
<Feature>UpdateRequest
```

Exemplo:

```ts
export type UserCreateRequest = {
  name: string;
  username?: string;
  email?: string;
  password: string;
  role: UserRole;
};

export type UserUpdateRequest = {
  name?: string;
  role?: UserRole;
  active?: boolean;
};
```

Não utilizar nomenclaturas inconsistentes como:

```text
InputRequest
UpdateResquest
InputResquest
```

Padronizar:

```text
Entity
Request
CreateRequest
UpdateRequest
Response
ResponseList
```

---

# 7. Shared

`shared` deve conter apenas código realmente transversal.

Exemplo:

```text
shared/
├── auth/
├── database/
├── errors/
├── http/
├── utils/
├── constants/
└── types/
```

---

## shared/utils

Usar para funções:

- pequenas;
- puras;
- reutilizáveis;
- sem regra de negócio específica.

Exemplos:

```text
document.ts      (normalizeDocument / isValidDocument: só dígitos, 11 ou 14 — regex simples)
phone.ts         (normalizePhone / isValidPhone: só dígitos, 10 ou 11 — regex simples)
normalize-email.ts
sleep.ts
date.ts          (ex.: getServiceDate — data em America/Sao_Paulo)
```

Regra:

> Se a função pertence claramente a um domínio, ela permanece dentro do módulo.

Exemplo:

```text
generateRandomCode(length)
→ shared/utils/random-code.ts (A–Z e 0–9, simples, pode ser trocado depois)
```

Mas:

```text
generateTicketCode()
→ pertence ao módulo ticket
```

porque envolve regra de negócio da senha.

Não transformar `utils` em uma pasta genérica onde todo código sem lugar definido é colocado.

---

# 8. Paginação padrão

Toda listagem paginada deve utilizar o mesmo contrato.

```ts
export type PaginatedResponse<T> = {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  nextPage: number | null;
  previousPage: number | null;
};
```

Exemplo:

```ts
export type TicketResponseList =
  PaginatedResponse<TicketResponse>;
```

Resposta HTTP:

```json
{
  "data": [
    {
      "id": "7e8...",
      "code": "EX-A7K92P1"
    }
  ],
  "totalItems": 42,
  "totalPages": 5,
  "currentPage": 2,
  "pageSize": 10,
  "nextPage": 3,
  "previousPage": 1
}
```

Na última página:

```json
{
  "data": [],
  "totalItems": 42,
  "totalPages": 5,
  "currentPage": 5,
  "pageSize": 10,
  "nextPage": null,
  "previousPage": 4
}
```

Usar `data`, não `items`.

Parâmetros de paginação (query):

```text
?page=1&pageSize=20
```

- `page` padrão 1;
- `pageSize` padrão 20, máximo 100 (acima disso → `400`);
- ordem padrão: por nome nas listagens de cadastro (departamentos, guichês, usuários); por `created_at` nas listagens de senhas.

---

# 9. Estrutura padrão de erros

Toda API deve retornar erros no mesmo formato.

```ts
export type FieldError = {
  field: string;
  message: string;
};

export type ApiErrorResponse = {
  message: string;
  statusCode: number;
  exception: string;
  errors?: FieldError[];
  meta?: Record<string, unknown>;
};
```

`meta` é opcional e serve para dados que o frontend precisa para reagir ao erro (ex.: id de um registro excluído que pode ser restaurado). Nunca colocar dados sensíveis ou internos em `meta`.

---

## Erro comum

```json
{
  "message": "Departamento não encontrado",
  "statusCode": 404,
  "exception": "DepartmentNotFoundException"
}
```

---

## Erro de conflito

```json
{
  "message": "Este guichê já possui um operador ativo",
  "statusCode": 409,
  "exception": "ServicePointAlreadyOccupiedException"
}
```

---

## Erro de validação

```json
{
  "message": "Dados inválidos",
  "statusCode": 400,
  "exception": "ValidationException",
  "errors": [
    {
      "field": "name",
      "message": "Nome é obrigatório"
    },
    {
      "field": "prefix",
      "message": "Prefixo deve possuir no máximo 4 caracteres"
    }
  ]
}
```

---

# 10. Zod

Utilizar a integração do Fastify com Zod (`fastify-type-provider-zod`): o mesmo schema valida a entrada, filtra a saída e gera a documentação OpenAPI (seção 12.2). Os erros de validação seguem para o error handler global.

Exemplo conceitual:

```ts
const result = schema.safeParse(request.body);

if (!result.success) {
  // enviar para tratamento global
}
```

Os `issues` do Zod devem ser transformados no padrão da API.

```ts
function formatZodErrors(
  error: ZodError,
): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
```

O frontend não deve conhecer o formato interno do Zod.

---

# 11. AppError

Criar uma exceção base da aplicação.

Exemplo:

```ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly exception: string,
  ) {
    super(message);
  }
}
```

Exemplo de exceção específica:

```ts
export class DepartmentNotFoundException
  extends AppError {
  constructor() {
    super(
      "Departamento não encontrado",
      404,
      "DepartmentNotFoundException",
    );
  }
}
```

No service:

```ts
if (!department) {
  throw new DepartmentNotFoundException();
}
```

---

# 12. Error Handler global

Fastify deve possuir um único tratamento global de erros.

Fluxo:

```text
Service
   ↓
throw AppError
   ↓
Fastify Error Handler
   ↓
ApiErrorResponse
   ↓
Frontend
```

O error handler deve tratar pelo menos:

```text
AppError
ZodError
erros inesperados
```

Erros inesperados:

```json
{
  "message": "Erro interno do servidor",
  "statusCode": 500,
  "exception": "InternalServerError"
}
```

Nunca devolver ao frontend:

- stack trace;
- query SQL;
- credenciais;
- nomes internos sensíveis;
- erro bruto do PostgreSQL;
- erro bruto do ORM;
- erro bruto de JWT.

---

## 12.1 Convenções gerais da API

### Valores gerados × valores informados

O sistema gera alguns valores únicos: slug, username e código da senha.

```text
valor GERADO que colide com outro (unique violation)
→ refazer a transação inteira com um novo valor, até 5 tentativas

valor INFORMADO pelo usuário que colide
→ 409 correspondente
```

No PostgreSQL, uma violação de unicidade invalida a transação inteira; por isso o retry refaz a transação, não apenas o insert.

### Ids

Todo id recebido em params ou body é validado como UUID pelo Zod. Id inválido → `400 ValidationException` (nunca deixar o PostgreSQL gerar erro `500`).

### Tamanhos máximos

Os limites do Zod são iguais aos do banco:

```text
nome da organização     150
nome de pessoa          150
e-mail                  200
nome de departamento    100
nome de guichê          100
nome de filial          100
senha                   8 a 128
```

### Logs

O logger do Fastify oculta (`redact`):

```text
password
passwordConfirmation
currentPassword
newPassword
headers.authorization
```

Nunca registrar senha, hash de senha ou token.

### Formato das respostas

- campos em camelCase;
- datas e horários em ISO 8601 UTC (`2026-03-10T02:30:00.000Z`);
- `serviceDate` como `YYYY-MM-DD`;
- CPF/CNPJ e telefone devolvidos apenas com dígitos;
- a API devolve dados crus: **formatação para exibição (máscaras, fuso, datas por extenso) é responsabilidade do frontend**;
- mensagens de erro em português; nomes de exceções (`exception`) em inglês.

---

## 12.2 Documentação da API (OpenAPI + Scalar)

A API é documentada em OpenAPI, gerado **a partir dos próprios schemas Zod** das rotas. A interface de leitura é o **Scalar**.

```text
@fastify/swagger                 gera o OpenAPI
fastify-type-provider-zod        usa os schemas Zod para validar e para documentar
@scalar/fastify-api-reference    interface visual

GET /docs                        interface Scalar
GET /docs/openapi.json           especificação OpenAPI
```

Regras:

- toda rota declara em `schema`: `body`, `params`, `querystring` e `response` com os schemas Zod do módulo — o mesmo schema que valida é o que documenta (nunca escrever documentação à mão separada do código);
- cada rota tem `tags` (o módulo: `Organizations`, `Auth`, `Departments`, `Tickets`…), `summary` e `description` curtos, em português;
- as respostas de erro relevantes da rota são documentadas com o schema `ApiErrorResponse` (ex.: `400`, `401`, `403`, `404`, `409`);
- rotas autenticadas declaram `security: [{ bearerAuth: [] }]`; o OpenAPI define o esquema `bearerAuth` (JWT);
- o schema de `response` também **filtra a saída**: campos que não estão no schema (ex.: `password_hash`) nunca chegam ao cliente;
- a documentação é ligada por variável de ambiente (`DOCS_ENABLED`): ligada em desenvolvimento, desligada em produção por padrão (a API é chamada apenas pelo servidor do Next.js);
- uma rota só está pronta quando aparece corretamente no Scalar (request, respostas e erros).

---

# 13. Multi-tenant (Organization e Branch)

"Multi-tenant" é o nome do padrão arquitetural. No domínio e no código, as entidades se chamam `Organization` e `Branch`.

Nomenclatura obrigatória:

```text
Organization       (entidade / módulo)
organizations      (tabela)
organization_id    (coluna)
organizationId     (TypeScript / JWT)

Branch             (entidade / módulo)   — "Filial" na tela
branches           (tabela)
branch_id          (coluna)
branchId           (TypeScript / JWT)
```

Não usar `tenant`, `tenantId` ou `tenant_id`.

Escopo das tabelas:

```text
organização → licenses, branches, users (OWNER/ADMIN), audit_logs
filial      → users (demais roles), departments, service_points, tickets, public_devices
```

Tabelas de filial guardam `organization_id` **e** `branch_id`. A redundância é intencional: toda consulta filtra pelos dois.

Regra fundamental:

> Nunca confiar em `organizationId` ou `branchId` enviados pelo frontend para definir o escopo da operação.

Depois da autenticação:

```ts
request.user = {
  userId,
  organizationId,
  branchId,
  role,
};
```

```ts
export type AuthenticatedUser = {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
};
```

A aplicação usa `request.user.organizationId` e `request.user.branchId` como fonte do escopo.

Exemplo:

```ts
await findDepartmentsByBranch(
  request.user.organizationId,
  request.user.branchId,
);
```

Rotas de filial usam `requireBranch` além do `authMiddleware` (ver seção 13.6).

---

## 13.1 Identificação de usuários

```text
OWNER       → email obrigatório, único globalmente entre OWNERs
funcionário → username, único dentro da organização; email opcional

OWNER, ADMIN                              → branch_id nulo
BRANCH_ADMIN, MANAGER, ATTENDANT, VIEWER  → branch_id obrigatório
```

Constraints no banco:

```sql
UNIQUE (organization_id, username)

CREATE UNIQUE INDEX uq_users_owner_email
ON users (email)
WHERE role = 'OWNER';

CHECK (role <> 'OWNER' OR email IS NOT NULL)

CHECK (
  (role IN ('OWNER', 'ADMIN') AND branch_id IS NULL)
  OR (role NOT IN ('OWNER', 'ADMIN') AND branch_id IS NOT NULL)
)
```

```sql
-- Um único OWNER por organização
CREATE UNIQUE INDEX uq_users_single_owner
ON users (organization_id)
WHERE role = 'OWNER';

-- Email de funcionário: único na organização quando preenchido
UNIQUE (organization_id, email)
```

Todo usuário possui `username`, inclusive o OWNER.

Username pode ser alterado por OWNER (qualquer usuário) ou ADMIN (qualquer usuário, exceto o OWNER).

Username gerado: primeiro nome sem acento, minúsculo + `.` + 4 dígitos (`gabriel.4821`). Se o nome não gerar nenhum caractere válido, usar `usuario` como base.

E-mail, username e slug são normalizados (trim + minúsculas) antes de gravar e antes de buscar.

---

## 13.2 Login

Um único endpoint, com body validado por união Zod:

```text
POST /auth/login
```

```text
{ email, password }
→ busca User com role OWNER pelo email
→ organization_id do usuário

{ organizationSlug, username, password }
→ busca Organization pelo slug
→ busca User por (organization_id, username)
```

O `organizationSlug` do login serve apenas para localizar o usuário. Depois do login, o escopo vem sempre do JWT.

**O slug é usado apenas no login.** Nenhuma rota de negócio recebe slug (`GET /departments`, nunca `GET /:slug/departments`).

Fluxo do slug:

```text
cadastro gera o slug → OWNER recebe o link app.senhas.com/<slug>/login
→ funcionário abre o link → Next.js lê o slug do caminho (app/[slug]/login)
→ envia { organizationSlug, username, password } → backend acha a empresa e depois o usuário
```

`GET /organizations/by-slug/:slug` (pública) devolve apenas `{ name }` para a tela de login mostrar o nome da empresa; slug inexistente, organização inativa ou excluída → `404 OrganizationNotFoundException`.

O dono entra em `app.senhas.com/login` com e-mail e senha, sem slug.

`GET /auth/me` (autenticada) devolve o mesmo formato do login sem o token: `user`, `organization` (com slug), `branch`, `license`. Continua respondendo com licença inválida.


Erros:

```text
slug / email / username inexistente ou senha errada
→ 401 InvalidCredentialsException ("Credenciais inválidas")

senha correta + usuário inativo ou excluído
→ 403 UserInactiveException

senha correta + organização inativa
→ 403 OrganizationInactiveException

senha correta + filial do usuário inativa
→ 403 BranchInactiveException
```

Licença inválida não impede o login. O response do login traz `license: { status, expiresAt, valid }` para o frontend avisar o usuário.

Nunca revelar se foi o slug, o email/username ou a senha que falhou.

- usuário não encontrado: comparar a senha com um hash fictício mesmo assim (tempo de resposta constante);
- schemas Zod estritos: campos extras rejeitados; `email` + `organizationSlug` juntos é inválido.

O payload do JWT é o mesmo nos dois fluxos:

```ts
{
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
}
```

Detalhes funcionais: `queue-system-context.md`, seção 5.

---

## 13.4 Senha

- mínimo 8, máximo 128 caracteres (o máximo evita custo excessivo no argon2);
- `PATCH /auth/password` `{ currentPassword, newPassword }`: o próprio usuário troca a senha;
- `PATCH /users/:userId/password` `{ newPassword }`: OWNER redefine de qualquer usuário; ADMIN de qualquer um, exceto o OWNER; BRANCH_ADMIN de MANAGER, ATTENDANT e VIEWER da sua filial;
- OWNER que esqueceu a senha: suporte manual na V1;
- toda troca/redefinição atualiza `users.password_changed_at`; o middleware recusa tokens emitidos antes disso (derruba sessões antigas e permite "sair de todos os dispositivos").

---

## 13.3 Exclusão lógica e restauração

Exclusão = preencher `deleted_at`. Nunca apagar a linha.

Exceção: **vínculos** (guichê ↔ departamento, usuário ↔ departamento) não têm exclusão lógica. Remover um vínculo apaga a linha de verdade. Já excluir um usuário, departamento ou guichê **não** remove os vínculos dele, para que voltem na restauração.

Constraints de unicidade **incluem** registros excluídos, de propósito:

```text
departments  UNIQUE (branch_id, prefix)
users        UNIQUE (organization_id, username)
users        UNIQUE (organization_id, email)
organizations UNIQUE (slug), UNIQUE (document)
users (OWNER) email único global
```

Não usar índice parcial `WHERE deleted_at IS NULL` nessas constraints.

Registros excluídos nas consultas:

- toda consulta de repository filtra `deleted_at IS NULL` por padrão, usando um helper único (`notDeleted(tabela)`), para ninguém esquecer;
- consultas que enxergam excluídos precisam ser explícitas e são só três:
  1. restauração (buscar o registro excluído);
  2. verificação de conflito na criação ("existe um `EX` excluído?");
  3. histórico (uma senha antiga continua mostrando o nome do departamento excluído).

```ts
db.select()
  .from(departments)
  .where(and(eq(departments.branchId, branchId), notDeleted(departments)));
```

Sem esse filtro, um departamento excluído apareceria no balcão, um usuário excluído faria login e excluídos contariam nos limites.

Violação de unicidade no banco (ex.: dois cadastros simultâneos): o repository traduz o erro do PostgreSQL, pelo nome da constraint, para o `409` correspondente. Nunca deixar virar `500`.

Na criação, o service verifica o conflito antes de inserir e diferencia:

```text
conflito com registro ativo    → 409 <Feature>...AlreadyExistsException
conflito com registro excluído → 409 Deleted<Feature>ExistsException + meta com o id
```

Exemplo:

```json
{
  "message": "Já existe um departamento excluído com este prefixo. Deseja restaurá-lo?",
  "statusCode": 409,
  "exception": "DeletedDepartmentExistsException",
  "meta": {
    "deletedId": "5b1c..."
  }
}
```

Restauração:

```text
POST /branches/:branchId/restore
POST /departments/:departmentId/restore
POST /users/:userId/restore
POST /service-points/:servicePointId/restore
```

Tudo que é excluído pode ser restaurado (filial, departamento, usuário, guichê). `Branch` e `ServicePoint` não têm valor único (nome livre).

- limpa `deleted_at`, volta `active = true`, mantém dados e vínculos;
- usuário restaurado recebe senha nova, definida por quem restaura;
- departamento restaurado volta a contar no limite (`DepartmentLimitReachedException`);
- OWNER e ADMIN restauram qualquer usuário (o OWNER nunca é excluído);
- username gerado automaticamente que colide com excluído: gerar outro, sem perguntar;
- organização excluída não é restaurada pela aplicação na V1 (suporte manual).

Detalhes funcionais: `queue-system-context.md`, seção 16.1.

---

## 13.6 Filial no token, troca de filial e abas

> **Futuro (multi-filial):** não implementar na V1. Na V1, `requireBranch` só garante `branchId` não nulo. Toda organização tem uma única filial, e o token sempre vem com ela.

Claim `branchId`:

```text
usuário de filial → fixo = users.branch_id
OWNER / ADMIN     → filial selecionada, ou null
```

Seleção de filial (OWNER/ADMIN):

```text
login
→ OWNER/ADMIN recebem token com branchId = null
  (se a organização tiver uma única filial ativa, ela já vem selecionada)
↓
frontend lista as filiais (GET /branches)
↓
POST /auth/branch   { branchId }
→ backend valida: filial pertence à organização do token, ativa e não excluída
→ devolve novo JWT com branchId = filial escolhida
↓
Next.js atualiza o cookie de sessão
↓
trocar de filial = chamar POST /auth/branch de novo
```

- `POST /auth/branch` só para OWNER/ADMIN; demais → `403 ForbiddenException`;
- filial de outra organização, inexistente, inativa ou excluída → `404 BranchNotFoundException`;
- organização com uma única filial ativa: o login já devolve o token com ela selecionada.

Middleware (`authMiddleware`):

- usuário de filial: `token.branchId` deve ser igual a `users.branch_id`; se diferente (usuário transferido) → `401 UnauthorizedException`;
- filial do token inativa ou excluída → `403 BranchInactiveException`.

`requireBranch` (preHandler das rotas de filial):

```text
X-Expected-Branch-Id: <filial que a tela está mostrando>
```

```text
header == token.branchId → segue
header ≠ token.branchId  → 409 BranchContextChangedException
header ausente           → 400 ExpectedBranchRequiredException
```

- `branchId` nulo → `400 BranchNotSelectedException`;
- o header `X-Expected-Branch-Id` **nunca define escopo**; só barra telas desatualizadas (várias abas compartilham o mesmo cookie de sessão);
- dispositivos diferentes têm sessões próprias e podem estar em filiais diferentes.

Rotas de organização (`/branches`, licença, criar ADMIN) não usam `requireBranch`. Quando referenciam uma filial como recurso (`PATCH /branches/:id`, transferir usuário), o id vem na URL e é sempre validado contra `organization_id` do token.

Detalhes funcionais: `queue-system-context.md`, seções 4.1, 5.7, 5.8 e 7.1.

---

# 14. Organization

Ao criar uma conta nova, a aplicação deve criar automaticamente:

```text
Organization
License ACTIVE (30 dias)
Branch "Matriz"
User OWNER (sem filial)
Department padrão (na Matriz)
```

Essas operações devem acontecer na mesma transação.

Fluxo:

```text
POST /organizations
      ↓
create organization
      ↓
create ACTIVE license (30 dias)
      ↓
create branch "Matriz"
      ↓
create OWNER (branch_id nulo)
      ↓
create default department (na Matriz)
      ↓
COMMIT
```

Se qualquer etapa falhar:

```text
ROLLBACK
```

Não pode existir organização parcialmente criada.

Campos da organização:

```text
id
name
slug                único globalmente, nunca reaproveitado (vai no link de login dos funcionários)
document            CPF/CNPJ obrigatório, apenas dígitos, único
contact_email       e-mail principal (cobrança e comunicação)
contact_phone       obrigatório, apenas dígitos
terms_accepted_at   quando os termos de uso foram aceitos
terms_version       qual versão dos termos foi aceita
active
created_at
updated_at
deleted_at
```

Cadastro (`POST /organizations`), body plano com todos os campos obrigatórios:

```text
organizationName, document, ownerName, phone, email,
password, passwordConfirmation, acceptedTerms
```

- `email` preenche `organizations.contact_email` e `users.email` do OWNER;
- `document` e `phone` passam por funções simples de `shared/utils` (normalizar para dígitos + regex de tamanho);
- `passwordConfirmation` deve ser igual a `password`; `acceptedTerms` deve ser `true` (senão `400` no campo);
- versão atual dos termos em constante (`CURRENT_TERMS_VERSION`);
- CPF/CNPJ já existente → `409 OrganizationDocumentAlreadyExistsException`;
- response `201` com `organization`, `owner` (inclui `username`), `branch` e `license`; **sem token**.

Slug:

Geração automática (o cadastro não tem campo de slug):

```text
1. nome da organização → minúsculas, sem acentos
2. tudo que não for letra ou número vira hífen; hífens repetidos viram um; sem hífen nas pontas
   "Clínica Sorriso" → clinica-sorriso
3. cortar em 60 caracteres
4. se ficar vazio (ex.: nome só com símbolos) → organizacao
5. se tiver menos de 3 caracteres, for reservado ou já existir
   → acrescentar "-" + 4 dígitos aleatórios (clinica-sorriso-4821) e verificar de novo
```

Regras:

- formato: `^[a-z0-9]+(-[a-z0-9]+)*$` (minúsculas, números e hífen), de 3 a 60 caracteres;
- único globalmente, inclusive entre organizações excluídas; nunca reaproveitado;
- não pode ser alterado na V1;
- slugs reservados ficam numa constante única (`RESERVED_SLUGS`, em `shared/constants`): são os nomes das páginas de primeiro nível do frontend, para o link de uma empresa nunca colidir com uma página do sistema. Ampliar conforme o frontend ganhar páginas: `login`, `cadastro`, `admin`, `api`, `app`, `suporte`, `ajuda`, `termos`, `privacidade`, `conta`, `configuracoes`, `funcionario`, `recuperar-senha`;
- desenvolvimento local: `localhost:3000/clinica-sorriso/login`.

Conflito de slug por cadastro simultâneo: refazer a transação com novo sufixo (até 5 tentativas).

`active` da organização só é alterado pelo suporte na V1; nenhuma role da aplicação desativa a organização.

Futuro (fora do escopo atual): verificação de e-mail do OWNER antes de ativar a organização. Até lá, o suporte libera manualmente e-mails usados indevidamente.

E-mail do OWNER já usado por outro OWNER: `409 OwnerEmailAlreadyExistsException`.

---

# 14.1 Branch (Filial)

> **Escopo da V1:** o banco já está preparado para várias filiais, mas na V1 **cada organização tem uma única filial** (a Matriz, criada junto com a organização). Não implementar agora: criar/editar/listar filiais, seleção de filial (`POST /auth/branch`), `X-Expected-Branch-Id`, transferência de usuário entre filiais e uso da role `BRANCH_ADMIN`. As regras abaixo ficam documentadas para quando a multi-filial for implementada.

```text
branches
- id
- organization_id
- name
- active
- created_at
- updated_at
- deleted_at
```

- cada filial tem seus próprios usuários, departamentos, guichês e senhas, isolados das demais filiais;
- a licença pertence à organização e cobre todas as filiais;
- sem limite de filiais na V1;
- ao criar a organização, nasce automaticamente a filial padrão **"Matriz"**;
- toda filial nasce com o departamento padrão (`Atendimento`, prefixo `AT`);
- OWNER e ADMIN criam, editam, desativam, excluem e restauram filiais;
- nome da filial é livre;
- filial desativada ou excluída: os usuários dela não executam nada (middleware) e OWNER/ADMIN não conseguem selecioná-la;
- cliente com uma única filial não percebe diferença: OWNER/ADMIN já entram com a Matriz selecionada.

Funcionário que trabalha em duas filiais: na V1 um usuário de filial pertence a **uma** filial. As opções são:

- transferir o usuário (OWNER ou ADMIN alteram a filial dele); ou
- criar uma segunda conta na outra filial.

Ao transferir:

- os acessos a departamentos da filial antiga são removidos;
- a `OperatorSession` ativa, se houver, é encerrada (`ADMIN_ACTION`);
- o token antigo deixa de valer (o middleware compara a filial do token com a do banco) e o usuário precisa fazer login de novo.

---

# 15. Licença inicial

A primeira implementação da licença será simples.

Exemplo:

```text
ACTIVE
EXPIRED
CANCELLED
```

Ao criar organização:

```text
status     = ACTIVE
started_at = agora
expires_at = agora + 30 dias
```

Licença válida = `status = ACTIVE` **e** `expires_at > agora`.

Uma licença `ACTIVE` com `expires_at` vencido é tratada como expirada, sem depender de job.

Duração padrão em constante: `LICENSE_DEFAULT_DURATION_DAYS = 30`.

Não implementar cobrança ou integração financeira inicialmente.

Cada organização possui exatamente uma licença (`UNIQUE (organization_id)`), que cobre todas as filiais.

Caso a licença não seja válida (`EXPIRED`, `CANCELLED` ou `expires_at` vencido):

- o login continua funcionando; o response do login informa a situação da licença, para o frontend avisar o usuário;
- **todas** as demais requisições autenticadas são negadas pelo `authMiddleware`:

```json
{
  "message": "A licença da organização não está ativa. Entre em contato com o suporte.",
  "statusCode": 403,
  "exception": "LicenseInactiveException"
}
```

- renovação: o cliente entra em contato com o suporte, que estende `expires_at` (ou altera o status) manualmente na V1;
- regras financeiras serão tratadas futuramente.

---

# 16. Roles

Roles definidas:

```text
OWNER          organização (todas as filiais)
ADMIN          organização (todas as filiais)
BRANCH_ADMIN   filial
MANAGER        filial
ATTENDANT      filial
VIEWER         filial
```

OWNER e ADMIN não pertencem a nenhuma filial (`branch_id` nulo). As demais roles pertencem a exatamente uma filial e só enxergam essa filial.

---

## OWNER

Dono da organização. Único por organização (criador da conta).

Pode **tudo**, em todas as filiais:

- administrar organização;
- criar, editar, desativar, excluir e restaurar filiais;
- criar usuários de qualquer role, exceto outro OWNER;
- atribuir e alterar roles;
- alterar username e redefinir senha de qualquer usuário;
- transferir usuários entre filiais;
- criar, desativar, excluir e restaurar qualquer recurso (usuários, departamentos, guichês);
- visualizar todos os departamentos de todas as filiais;
- administrar licença;
- executar todas as operações administrativas e operacionais.

Restrições do OWNER:

- não pode alterar a própria role (não se rebaixa);
- não pode se desativar nem se excluir;
- ninguém mais pode alterar a role, desativar ou excluir o OWNER.

---

## ADMIN

Administrador da rede: atua em todas as filiais, abaixo do OWNER.

Pode:

- criar, editar, desativar, excluir e restaurar filiais;
- criar usuários com role BRANCH_ADMIN, MANAGER, ATTENDANT ou VIEWER, em qualquer filial (nunca ADMIN ou OWNER);
- alterar role apenas entre BRANCH_ADMIN, MANAGER, ATTENDANT e VIEWER (não promove ninguém a ADMIN);
- alterar username e redefinir senha de qualquer usuário, exceto do OWNER;
- transferir usuários entre filiais;
- criar, desativar, excluir e restaurar qualquer recurso (usuários, departamentos, guichês), exceto o OWNER;
- visualizar todos os departamentos de todas as filiais;
- administrar operação.

---

## BRANCH_ADMIN

> Futuro: só faz sentido com várias filiais. Existe no banco, mas não é criado na V1.

Administrador de uma filial. Atua **apenas na própria filial**.

Pode:

- criar usuários com role MANAGER, ATTENDANT ou VIEWER (nunca BRANCH_ADMIN, ADMIN ou OWNER);
- alterar role apenas entre MANAGER, ATTENDANT e VIEWER;
- alterar username, redefinir senha, desativar, excluir e restaurar usuários MANAGER, ATTENDANT e VIEWER;
- criar, editar, desativar, excluir e restaurar departamentos e guichês;
- liberar acesso de usuários aos departamentos;
- visualizar todos os departamentos da filial;
- atender e operar como MANAGER.

Não pode:

- criar ou editar filiais;
- transferir usuários entre filiais;
- administrar licença;
- alterar, desativar ou excluir outro BRANCH_ADMIN, ADMIN ou OWNER.

---

## MANAGER

É também um atendente, com poderes operacionais adicionais, na sua filial.

Pode:

- atender;
- acessar departamentos permitidos;
- ocupar guichê;
- liberar outro usuário de um guichê;
- administrar operação dos departamentos permitidos.

---

## ATTENDANT

Pode, na sua filial:

- visualizar departamentos permitidos;
- entrar em guichê disponível;
- chamar senha;
- rechamar senha;
- finalizar atendimento;
- marcar ausência;
- liberar guichê ocupado por outro usuário;
- executar ações básicas de atendimento.

---

## VIEWER

Somente leitura, na sua filial.

Pode:

- visualizar os departamentos permitidos e suas filas.

Não pode:

- atender, chamar, rechamar ou finalizar senhas;
- gerar senha;
- ocupar guichê;
- criar ou alterar qualquer recurso.

---

## Quem cria quem

```text
OWNER        → ADMIN, BRANCH_ADMIN, MANAGER, ATTENDANT, VIEWER
ADMIN        → BRANCH_ADMIN, MANAGER, ATTENDANT, VIEWER   (qualquer filial)
BRANCH_ADMIN → MANAGER, ATTENDANT, VIEWER                 (própria filial)
MANAGER      → não cria usuários
ATTENDANT    → não cria usuários
VIEWER       → não cria usuários
```

Ninguém cria ou promove alguém ao próprio nível ou acima.

Existe exatamente um OWNER por organização. Não é possível criar um segundo OWNER.

Regra geral: nenhum usuário pode desativar ou excluir a si mesmo.

## Visibilidade de departamentos

```text
OWNER, ADMIN                → todos os departamentos (da filial selecionada; podem selecionar qualquer filial)
BRANCH_ADMIN                → todos os departamentos da sua filial
MANAGER, ATTENDANT, VIEWER  → apenas os liberados em user_department_access
```

Departamentos inativos aparecem apenas para OWNER, ADMIN e BRANCH_ADMIN (para poderem reativar). As demais roles veem só os ativos.

---

# 17. Departments

Cada filial possui departamentos.

Exemplo:

```text
Consulta
Exames
Cirurgia
Coleta
```

Cada departamento possui um prefixo de no máximo 4 caracteres.

Exemplo:

```text
Departamento: Exames
Prefixo: EX
```

O prefixo deve ser único dentro da **filial** (`UNIQUE (branch_id, prefix)`). Filiais diferentes podem usar o mesmo prefixo.

Regras do prefixo:

- normalizado para maiúsculas antes de gravar (`ex` → `EX`);
- apenas letras A–Z e números, de 1 a 4 caracteres (`^[A-Z0-9]{1,4}$`);
- **não pode ser editado** depois de criado (o nome pode).

Limite inicial:

```text
5 departamentos por filial
```

Departamentos inativos (`active = false`) contam no limite.

Departamentos excluídos (`deleted_at` preenchido) não contam.

```text
desativar → some da fila, pode ser reativado, conta no limite
excluir   → some das listagens, não conta no limite, pode ser restaurado (seção 13.3)
```

---

# 18. Department padrão

Toda filial nasce com um departamento inicial (inclusive a Matriz, criada junto com a organização).

Exemplo:

```text
Nome:    Atendimento
Prefixo: AT
```

---

# 19. Service Point

`ServicePoint` representa:

```text
guichê
balcão
mesa
sala
caixa
```

Pertence a uma filial.

Não pertence permanentemente a um usuário.

Regra fundamental:

```text
User ≠ ServicePoint
```

Evitar:

```text
ServicePoint.userId
```

como vínculo permanente.

---

# 20. Department x ServicePoint

O modelo de dados suporta relação N:N:

```text
Department
    N
    ↕
    N
ServicePoint
```

Tabela intermediária:

```text
department_service_points
```

Mesmo que a primeira versão do frontend trabalhe de forma mais simples.

Departamento e guichê associados precisam ser da mesma filial.

Exemplo:

```text
Departamento Exames
├── Guichê 1
├── Guichê 2
└── Guichê 3
```

No futuro um mesmo guichê poderá atender vários departamentos.

Limite inicial:

```text
10 guichês por departamento
```

Nome do guichê é livre (pode repetir). Guichês inativos contam no limite; excluídos não.

---

# 21. User x Department

Usuários possuem acesso aos departamentos.

Relação:

```text
User
  N
  ↕
  N
Department
```

Tabela:

```text
user_department_access
```

Exemplo:

```text
Gabriel

Departamentos:
- Engenharia
- Financeiro
```

Gabriel só visualiza os departamentos aos quais possui acesso.

`user_department_access` é exclusivamente operacional: define quais departamentos o usuário pode visualizar/atender.

Não usar essa tabela para validar geração de senha (ver seção 24.2).

OWNER e ADMIN (qualquer filial) e BRANCH_ADMIN (sua filial) visualizam todos os departamentos sem precisar dela.

Usuário e departamento vinculados precisam ser da mesma filial.

---

# 22. OperatorSession

O usuário não é proprietário de um guichê.

Quando começa o atendimento:

```text
User
  ↓
OperatorSession
  ↓
ServicePoint
```

Exemplo:

```text
Gabriel
  ↓
OperatorSession ACTIVE
  ↓
Guichê 3
```

Regras:

```text
1 usuário
→ máximo 1 sessão ACTIVE
```

```text
1 guichê
→ máximo 1 operador ACTIVE
```

Essas regras devem ser protegidas também pelo banco.

Desativar ou excluir um usuário encerra a sessão ACTIVE dele (`end_reason = ADMIN_ACTION`, `ended_by_user_id` = quem desativou). Fase 2.

---

# 23. Liberação de guichê por outro atendente

A aplicação não deve ficar engessada por hierarquia.

Se Gabriel foi embora sem liberar o Guichê 3, outro usuário pode liberar esse guichê.

Qualquer usuário da filial do guichê pode liberá-lo (exceto VIEWER, que é somente leitura). OWNER e ADMIN podem em qualquer filial. Não é exigido acesso ao departamento do guichê.

Exemplo:

```text
Gabriel → Guichê 3 → ACTIVE

Carlos:
[ Liberar Guichê 3 ]
```

Após confirmação:

```text
OperatorSession Gabriel
ACTIVE → CLOSED
```

Registrar:

```text
ended_at
ended_by_user_id
end_reason
```

Motivos possíveis:

```text
USER_LEFT
FORCED_BY_USER
SERVICE_POINT_DISABLED
ADMIN_ACTION
```

Exemplo:

```text
ended_by_user_id = Carlos
end_reason = FORCED_BY_USER
```

Também criar `audit_log`.

Exemplo:

```text
Carlos removeu Gabriel do Guichê 3.
```

A regra de autorização fica no backend: qualquer role da filial do guichê, exceto VIEWER; OWNER e ADMIN em qualquer filial.

---

# 24. Tickets

A senha não utiliza sequência numérica.

Formato:

```text
PREFIXO + "-" + 7 caracteres aleatórios
```

Exemplo:

```text
EX-A7K92P1
```

Prefixo:

```text
EX
```

Parte aleatória:

```text
A7K92P1
```

A senha é válida apenas no dia em que foi criada.

## 24.0 Geração do código

A parte aleatória vem de uma função utilitária simples, que pode ser trocada depois:

```text
shared/utils/random-code.ts
generateRandomCode(length)          → caracteres A–Z e 0–9 (crypto)

modules/ticket
generateTicketCode(prefix)          → prefix + "-" + generateRandomCode(7)
```

O alfabeto e o tamanho podem mudar no futuro sem afetar o restante do módulo.

## 24.1 Fuso horário e service_date

Na V1 o sistema inteiro usa um único fuso: `America/Sao_Paulo`. Não existe timezone por organização.

O "dia" da senha é definido por esse fuso. Vale para `service_date`, expiração, relatórios diários e encerramento do dia.

Regras:

- o fuso fica em uma constante única: `shared/constants` → `APP_TIMEZONE = "America/Sao_Paulo"`;
- a data é calculada por uma função em `shared/utils/date.ts` (ex.: `getServiceDate(now)`), que recebe o instante e retorna `YYYY-MM-DD` nesse fuso;
- `service_date` é gravado explicitamente pela aplicação; a coluna não tem `DEFAULT CURRENT_DATE`;
- não usar `CURRENT_DATE`, `now()::date` nem depender do fuso da sessão do PostgreSQL para decidir o dia;
- timestamps continuam `TIMESTAMPTZ`;
- `service_date` e `created_at` do ticket vêm do **mesmo instante**, lido do relógio da aplicação (não usar o `DEFAULT now()` do banco para o ticket), para não divergirem perto da meia-noite;
- funções que dependem do "agora" recebem a data/instante como parâmetro (ou relógio injetável), para os testes conseguirem simular a virada do dia.

## 24.2 Geração de senha (balcão)

Cenário da V1: atendente no balcão, logada, gera a senha para o cliente. Não existe rota pública de geração nem totem.

```text
GET  /tickets/departments   → departamentos ativos da filial do token { id, name, prefix }
POST /tickets               → { departmentId }
```

Regras:

- rota de filial: `authMiddleware` + `requireBranch`; organização e filial vêm do token;
- qualquer role pode gerar, exceto VIEWER (`403 ForbiddenException`);
- não consulta `user_department_access`: o balcão gera senha para qualquer departamento ativo da filial;
- buscar o departamento por `id`, `branch_id` **e** `organization_id`; inexistente, de outra filial/organização, inativo ou excluído → `404 DepartmentNotFoundException`;
- colisão de código no mesmo dia (`UNIQUE (branch_id, code, service_date)`): gerar novo código e tentar novamente;
- departamento sem guichê associado pode receber senhas;
- registrar `TicketHistory` `CREATED` com `actor_user_id = request.user.userId`.

Futuro: o totem (`TICKET_GENERATOR`) gerará senhas com credencial própria de dispositivo.

## 24.3 Atendimento e painel (MVP)

Detalhes funcionais: `queue-system-context.md`, seções 48.1 e 48.2.

- `OperatorSession`: entrar (`POST /operator-sessions`), sair (`POST /operator-sessions/current/close`), liberar à força (`POST /service-points/:id/release`, gera `AuditLog`; senha em atendimento daquela sessão vira `NO_SHOW`);
- chamar exige sessão ativa; no máximo uma senha `IN_SERVICE` por atendente;
- `POST /tickets/call-next`: senha `WAITING` mais antiga do dia entre os departamentos acessíveis, `ORDER BY created_at, id`, `FOR UPDATE SKIP LOCKED`;
- `POST /tickets/:id/call`: chamada manual a partir de `GET /tickets/waiting`; `UPDATE ... WHERE status = 'WAITING'`; 0 linhas → `409 TicketNotWaitingException`;
- senha em atendimento + nova chamada sem `confirmNoShowCurrent: true` → `409 CurrentTicketInServiceException`; com confirmação → atual `NO_SHOW`;
- `recall`, `finish`, `no-show`: apenas a senha em atendimento da própria sessão;
- `cancel`: qualquer role exceto VIEWER, `reason` opcional;
- toda mudança de status registra `TicketHistory` na mesma transação;
- `GET /tickets/display`: VIEWER (TV) consulta por polling; atual = último `CALLED`/`RECALLED` do dia na filial.

Testes obrigatórios de concorrência:

- duas chamadas simultâneas de `call-next` → senhas diferentes;
- duas chamadas simultâneas de `call` para a mesma senha → uma `200`, outra `409`.

---

# 25. Status de Ticket

Status definidos:

```text
WAITING
IN_SERVICE
FINISHED
NO_SHOW
CANCELLED
EXPIRED
```

Fluxo principal:

```text
WAITING
   ↓
IN_SERVICE
   ↓
FINISHED
```

Ao chamar uma senha:

```text
WAITING → IN_SERVICE
```

Não utilizar um status separado `CALLED` na V1.

---

# 26. NO_SHOW

Se o cliente não comparecer:

```text
IN_SERVICE → NO_SHOW
```

Ao tentar chamar outra senha enquanto existe uma em atendimento, o frontend deve confirmar.

Exemplo:

```text
A senha atual ainda não foi atendida.
Deseja chamar outra?
```

Se confirmar:

```text
senha atual → NO_SHOW
próxima → IN_SERVICE
```

---

# 27. CANCELLED

Uma senha pode ser invalidada manualmente.

Possíveis transições:

```text
WAITING → CANCELLED
IN_SERVICE → CANCELLED
```

Registrar motivo quando aplicável.

Desativar ou excluir um departamento (fase 2): as senhas `WAITING` desse departamento passam para `CANCELLED`, com motivo registrado (`DEPARTMENT_DISABLED` ou `DEPARTMENT_DELETED`) e evento `CANCELLED` no histórico.

---

# 28. EXPIRED

A senha só vale no dia em que foi criada.

O encerramento do dia segue o fuso `America/Sao_Paulo` (ver seção 24.1).

Ao encerrar o dia:

```text
WAITING → EXPIRED
IN_SERVICE → EXPIRED
```

Senhas já finalizadas ou encerradas não devem ser alteradas.

Na prática (fase 2):

- um job roda à meia-noite de `America/Sao_Paulo` e marca como `EXPIRED` as senhas `WAITING` / `IN_SERVICE` com `service_date` anterior a hoje, registrando o evento `EXPIRED` no histórico;
- as consultas da fila sempre filtram `service_date = hoje`, então mesmo que o job atrase, uma senha de ontem nunca é chamada.

---

# 29. Rechamada

O atendente pode rechamar uma senha que ainda não foi finalizada.

A tela mostrará aproximadamente as últimas 6 a 10 senhas chamadas pelo atendente.

Exemplo:

```text
EX-A7K92P1   EM ATENDIMENTO
EX-K29M4Q8   FINALIZADA
EX-R8H2KL9   NÃO COMPARECEU
```

Rechamar não muda status:

```text
IN_SERVICE
   ↓
RECALLED
   ↓
IN_SERVICE
```

`RECALLED` é evento, não status.

---

# 30. Status x Evento

Status representa a situação atual.

Evento representa algo que aconteceu.

Exemplo:

```text
status atual:
IN_SERVICE
```

Histórico:

```text
CREATED
CALLED
RECALLED
RECALLED
```

Eventos iniciais:

```text
CREATED
CALLED
RECALLED
FINISHED
CANCELLED
NO_SHOW
EXPIRED
```

---

# 31. Ordenação da fila

A próxima senha é sempre a senha mais antiga em `WAITING`.

Conceitualmente:

```sql
WHERE department_id = :departmentId
  AND status = 'WAITING'
  AND service_date = :today
ORDER BY created_at ASC, id ASC
```

`id` desempata senhas criadas no mesmo instante.

Não haverá prioridade na primeira versão.

---

# 32. Concorrência

Dois guichês podem pedir a próxima senha praticamente ao mesmo tempo (tratado no MVP).

Eles nunca podem receber a mesma senha.

Isso é problema de concorrência, não apenas idempotência.

Exemplo esperado:

```text
Guichê 1 → Ticket A
Guichê 2 → Ticket B
```

No MVP: transação e locking no PostgreSQL (seção 24.3).

Exemplo conceitual futuro:

```sql
SELECT ...
FOR UPDATE SKIP LOCKED
```

---

# 33. Idempotência

Idempotência trata requisições repetidas da mesma operação.

Exemplo:

```text
Request ABC
Request ABC novamente
```

A aplicação não deve chamar duas senhas devido ao mesmo comando enviado duas vezes.

Concorrência e idempotência são problemas diferentes.

---

# 34. TicketHistory

Registrar eventos da senha.

Exemplos:

```text
CREATED
CALLED
RECALLED
FINISHED
CANCELLED
NO_SHOW
EXPIRED
```

Pode guardar:

```text
actor_user_id
metadata
created_at
```

---

# 35. AuditLog

Separado de `TicketHistory`.

`TicketHistory`:

```text
acontecimentos da senha
```

`AuditLog`:

```text
ações administrativas ou operacionais relevantes
```

Exemplos:

```text
Carlos removeu Gabriel do Guichê 3

ADMIN excluiu Departamento Engenharia

OWNER alterou role de usuário
```

---

# 36. Public Devices

Totens e TVs não utilizam sessão de usuário humano.

Conceito:

```text
Usuário humano
→ sessão de autenticação

Totem / TV
→ credencial de dispositivo
```

Tipos iniciais:

```text
TICKET_GENERATOR
QUEUE_DISPLAY
```

---

# 37. TICKET_GENERATOR

Totem utilizado para gerar senha.

Pode:

```text
listar departamentos autorizados
gerar ticket
```

Não pode:

```text
administrar usuários
administrar departamentos
alterar roles
administrar licença
```

---

# 38. QUEUE_DISPLAY

TV/painel utilizado para exibir chamadas.

Pode:

```text
visualizar fila
receber atualizações em tempo real
```

Não deve gerar tickets nem executar operações administrativas.

---

# 39. Ativação de dispositivo

OWNER ou ADMIN cria:

```text
PublicDevice
status = PENDING_ACTIVATION
```

Depois gera código temporário:

```text
K7P9-X2
```

Código:

- uso único;
- curta duração;
- limitado a tentativas razoáveis.

No dispositivo:

```text
/device/activate
```

O código é informado.

Backend valida e gera credencial exclusiva do dispositivo.

---

# 40. Credencial do dispositivo

Não utilizar credencial de usuário.

O dispositivo possui sua própria credencial.

Armazenar preferencialmente em:

```text
HttpOnly Cookie
Secure
SameSite
```

No banco armazenar apenas hash da credencial quando aplicável.

A credencial identifica:

```text
PublicDevice
   ↓
Organization
   ↓
Type
   ↓
Status
   ↓
Departments autorizados
```

Nunca confiar em `organizationId` enviado pelo dispositivo.

---

# 41. Revogação de dispositivo

OWNER ou ADMIN pode revogar.

```text
ACTIVE → REVOKED
```

O backend deve validar o status do dispositivo.

Mesmo que o navegador ainda tenha a credencial:

```text
status = REVOKED
→ rejeitar operação
```

---

# 42. Primeira fase de implementação

Não implementar tudo de uma vez.

Primeira fase:

```text
1. Criar Organization (POST /organizations) ← primeiro entregável
   Organization + License 30 dias + Branch "Matriz" + OWNER + Department padrão, numa transação
2. Login (OWNER por email, funcionário por slug + username) + JWT + authMiddleware + requireBranch
3. Troca da própria senha e redefinição por OWNER/ADMIN
4. Criar/Listar/Editar/Desativar Departments
5. Criar/Editar/Desativar ServicePoint
6. Associar ServicePoint ao Department
7. Criar/Listar/Editar/Desativar User (username gerado, email opcional, sempre na Matriz)
8. Dar acesso do User ao Department
9. Geração de senha no balcão (usuário logado): listar departamentos + gerar Ticket + cancelar
10. Sessão no balcão (entrar, sair, liberar)
11. Chamar senha: próxima (mais antiga) e específica (da lista), com concorrência
12. Rechamar, finalizar, não compareceu, minhas últimas chamadas
13. Painel da TV (usuário VIEWER, polling)
```

Na V1 cada organização tem uma única filial (Matriz). O banco já tem `branches` e `branch_id`, mas a lógica de várias filiais fica para depois.

Edição na fase 1: `PATCH /users/:userId` (`name`, `role`, `username`, `active`), `PATCH /departments/:id` (`name`, `active`; prefixo imutável → `400`), `PATCH /service-points/:id` (`name`, `active`), `GET /users`. Apenas OWNER e ADMIN. Excluir e restaurar ficam para a fase 2. Regras detalhadas: `queue-system-context.md`, seção 47.

Fluxo inicial:

```text
POST /organizations
   ↓
Organization
License (30 dias)
Branch "Matriz"
OWNER (sem filial)
Department padrão (na Matriz)
```

Depois:

```text
GET   /organizations/by-slug/:slug
POST  /auth/login
GET   /auth/me
PATCH /auth/password

POST  /departments
GET   /departments
PATCH /departments/:id

POST  /service-points
PATCH /service-points/:id
POST  /departments/:departmentId/service-points

POST  /users
GET   /users
PATCH /users/:userId
POST  /users/:userId/departments
PATCH /users/:userId/password

GET   /tickets/departments
POST  /tickets
POST  /tickets/:id/cancel

POST  /operator-sessions
POST  /operator-sessions/current/close
POST  /service-points/:id/release

GET   /tickets/waiting
POST  /tickets/call-next
POST  /tickets/:id/call
POST  /tickets/:id/recall
POST  /tickets/:id/finish
POST  /tickets/:id/no-show
GET   /tickets/my-calls
GET   /tickets/display
```

---

# 43. Segunda fase

Deixar para depois:

```text
idempotência completa
WebSocket / tempo real
Totem (TICKET_GENERATOR)
dispositivo QUEUE_DISPLAY (no MVP a TV usa um usuário VIEWER)
auditoria completa (no MVP, apenas a liberação forçada de balcão)
expiração automática no fim do dia
verificação de e-mail do OWNER
cancelar senhas ao desativar/excluir departamento
criar/editar/listar filiais (POST/GET /branches)
seleção de filial (POST /auth/branch) e X-Expected-Branch-Id
transferência de usuário entre filiais
uso da role BRANCH_ADMIN
usuário de filial com acesso a várias filiais
ADMIN regional (apenas filiais escolhidas)
fuso horário por filial
```

---

# 44. Exemplo vertical simples — Department

## Entity

```ts
interface DepartmentEntity {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  prefix: string;
  active: boolean;
}

export type Department = DepartmentEntity;
```

## Request

```ts
export type DepartmentRequest = {
  name: string;
  prefix: string;
};
```

## Response

```ts
export type DepartmentResponse = DepartmentEntity;
```

## Response de lista

```ts
export type DepartmentResponseList =
  PaginatedResponse<DepartmentResponse>;
```

## Schema

```ts
import { z } from "zod";

export const departmentSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório"),

  prefix: z
    .string()
    .min(1, "Prefixo é obrigatório")
    .max(4, "Prefixo deve possuir no máximo 4 caracteres"),
});
```

## Repository

```ts
export async function findDepartmentsByBranch(
  organizationId: string,
  branchId: string,
): Promise<Department[]> {
  // banco (Drizzle) → toDepartment(row)
}
```

## Service

```ts
export async function listDepartments(
  organizationId: string,
  branchId: string,
): Promise<Department[]> {
  return findDepartmentsByBranch(organizationId, branchId);
}
```

## Controller

```ts
export async function listDepartmentsController(
  request,
  reply,
) {
  const result = await listDepartments(
    request.user.organizationId,
    request.user.branchId, // garantido não nulo pelo requireBranch
  );

  return reply.send(result);
}
```

Regra importante:

```text
organizationId e branchId vêm da autenticação.
```

Nunca:

```text
GET /departments?organizationId=...
GET /departments?branchId=...
```

para definir livremente qual organização ou filial será consultada.

---

# 45. Exemplo de exceção

```ts
export class DepartmentNotFoundException
  extends AppError {
  constructor() {
    super(
      "Departamento não encontrado",
      404,
      "DepartmentNotFoundException",
    );
  }
}
```

Uso:

```ts
const department =
  await departmentRepository.findById(id);

if (!department) {
  throw new DepartmentNotFoundException();
}
```

Resposta:

```json
{
  "message": "Departamento não encontrado",
  "statusCode": 404,
  "exception": "DepartmentNotFoundException"
}
```

---

# 46. Regras para IA ao gerar código

Ao utilizar IA neste projeto, seguir obrigatoriamente:

1. Não criar microserviços.
2. Manter monólito modular.
3. Não acoplar DTOs de diferentes módulos.
4. Interfaces internas usam sufixo `Entity`.
5. Interfaces não são exportadas; exportar `type <Feature> = <Feature>Entity` para uso entre arquivos do módulo.
6. Tipos públicos usam `type`.
7. Resposta única usa `<Feature>Response`.
8. Listagem usa `<Feature>ResponseList`.
9. Requests usam `Request`, `CreateRequest` ou `UpdateRequest`.
10. Listagens paginadas usam `PaginatedResponse<T>`.
11. Campo da coleção paginada chama-se `data`.
12. Repository não retorna DTO HTTP.
13. Service não conhece Fastify `request` ou `reply`.
14. Controller é responsável pela fronteira HTTP.
15. `organizationId` e `branchId` nunca são confiados a partir do body/query/params do frontend.
16. Usar a organização e a filial autenticadas (`request.user.organizationId`, `request.user.branchId`).
17. Erros de negócio devem utilizar `AppError`.
18. Toda resposta de erro segue `ApiErrorResponse`.
19. Zod deve ser convertido para `FieldError[]`.
20. Não retornar erro bruto do PostgreSQL/ORM/JWT ao frontend.
21. Não criar vínculo permanente `User -> ServicePoint`.
22. Vínculo temporário ocorre por `OperatorSession`.
23. Um usuário possui no máximo uma sessão ativa.
24. Um guichê possui no máximo um operador ativo.
25. Qualquer usuário da filial do guichê, exceto VIEWER, pode liberá-lo; OWNER e ADMIN em qualquer filial.
26. Toda remoção forçada deve gerar auditoria.
27. Ticket usa prefixo + 7 caracteres aleatórios.
28. Ticket é válido apenas no dia da criação.
29. Próxima senha = mais antiga em `WAITING`.
30. `RECALLED` é evento e não status.
31. Status atuais de ticket:
    - `WAITING`
    - `IN_SERVICE`
    - `FINISHED`
    - `NO_SHOW`
    - `CANCELLED`
    - `EXPIRED`
32. Concorrência e idempotência não são a mesma coisa.
33. Totem/TV nunca usa credencial de usuário humano.
34. Dispositivos públicos possuem credencial própria.
35. Evitar adicionar complexidade não solicitada.
36. Preferir soluções simples, explícitas e testáveis.
37. Usar `Organization` / `organization_id` / `organizationId`; nunca `tenant`.
38. E-mail do OWNER é único globalmente e obrigatório.
39. Username é único dentro da organização, não globalmente.
40. E-mail de funcionário é opcional e não é usado para login.
41. Login do OWNER: `email + senha`.
42. Login de funcionário: `organizationSlug + username + senha`.
43. Falha de login sempre retorna `InvalidCredentialsException`, sem revelar qual dado falhou.
44. O `organizationSlug` do login só localiza o usuário; o escopo depois do login vem do JWT.
45. Tipos inferidos do Drizzle (`$inferSelect`) ficam dentro do repository; o repository retorna o contrato do domínio.
46. Fuso único da V1: `America/Sao_Paulo` (`APP_TIMEZONE`); sem timezone por organização.
47. `service_date` é calculado pela aplicação nesse fuso e gravado explicitamente; nunca `CURRENT_DATE`.
48. Gerar senha exige usuário logado (balcão); qualquer role exceto VIEWER; sem `user_department_access`.
49. Em `POST /tickets` organização e filial vêm do token; departamento buscado por `id` + `branch_id` + `organization_id`.
50. `user_department_access` é apenas operacional (visualizar/atender).
51. Um único OWNER por organização; OWNER pode tudo, exceto criar outro OWNER.
52. ADMIN cria BRANCH_ADMIN, MANAGER, ATTENDANT e VIEWER; BRANCH_ADMIN cria MANAGER, ATTENDANT e VIEWER na própria filial.
53. OWNER e ADMIN veem todos os departamentos (qualquer filial); BRANCH_ADMIN todos da sua filial; demais roles só os liberados.
54. VIEWER é somente leitura.
55. Uma licença por organização, cobrindo todas as filiais; licença inválida bloqueia todas as rotas autenticadas (exceto login).
56. Rotas públicas (login, cadastro de organização) têm rate limit por IP; login também por conta.
57. Usar `UserRole`, não `string`, para roles.
58. Código aleatório da senha vem de `generateRandomCode` (shared/utils).
59. Exclusão é lógica (`deleted_at`); valores únicos de registros excluídos nunca são reaproveitados.
60. Conflito com registro excluído retorna `409 Deleted<Feature>ExistsException` com `meta.deletedId`, para o frontend oferecer restauração.
61. Restaurar (`POST /<recurso>/:id/restore`) reativa o registro antigo; nunca criar duplicata.
62. OWNER não altera a própria role, não se desativa e não se exclui; ninguém altera/desativa/exclui o OWNER.
63. ADMIN nunca cria nem promove alguém a ADMIN ou OWNER.
64. OWNER e ADMIN podem criar, desativar, excluir e restaurar qualquer recurso (exceto o OWNER).
65. Nenhum usuário desativa ou exclui a si mesmo.
66. `authMiddleware` consulta o usuário no banco: inativo/excluído não executa nada; role vem do banco.
67. Licença nasce com 30 dias; válida = `ACTIVE` e `expires_at > agora`.
68. Rate limits são confortáveis; servem só contra abuso grosseiro.
69. Limites de quantidade sem lock na V1.
70. Ticket: `service_date` e `created_at` do mesmo instante da aplicação.
71. Fila ordena por `created_at, id` e filtra `service_date = hoje`.
72. Login com tempo constante (hash fictício) e schemas Zod estritos.
73. Slug da organização é imutável na V1.
74. Licença inválida: login funciona, todas as outras rotas autenticadas retornam `403 LicenseInactiveException`.
75. Renovação de licença e desativação de organização são feitas pelo suporte na V1.
76. Senha: 8 a 128 caracteres; `PATCH /auth/password` (própria) e `PATCH /users/:id/password` (OWNER/ADMIN).
77. Prefixo do departamento é imutável depois de criado.
78. Nome do guichê é livre; tudo que é excluído pode ser restaurado.
79. Desativar/excluir usuário encerra a OperatorSession ativa dele.
80. Enums do banco têm type próprio (`UserRole`, `TicketStatus`, `LicenseStatus`...), nunca `string`.
81. Organization → Branch → (usuários de filial, departamentos, guichês, senhas). Tudo de filial é isolado por filial.
82. Tabelas de filial guardam `organization_id` e `branch_id`; consultas filtram pelos dois.
83. OWNER e ADMIN têm `branch_id` nulo; demais roles têm `branch_id` obrigatório (CHECK no banco).
84. Ninguém cria ou promove alguém ao próprio nível ou acima.
85. JWT carrega `branchId`; OWNER/ADMIN selecionam a filial com `POST /auth/branch`.
86. Rotas de filial usam `requireBranch`: `branchId` não nulo e `X-Expected-Branch-Id` igual ao do token (409 se divergir).
87. `X-Expected-Branch-Id` nunca define escopo.
88. Usuário de filial: `token.branchId` deve bater com `users.branch_id` (transferência invalida o token).
89. Prefixo único por filial; limite de 5 departamentos por filial; ticket único por `(branch_id, code, service_date)`.
90. Departamento↔guichê e usuário↔departamento só dentro da mesma filial.
91. Toda filial nasce com o departamento padrão; a organização nasce com a filial "Matriz".
92. Frontend Next.js (BFF): token na sessão em cookie HttpOnly, nunca em `localStorage`; só o servidor do Next chama a API.
93. V1: cada organização tem uma única filial (Matriz). Não implementar CRUD de filiais, `POST /auth/branch`, `X-Expected-Branch-Id`, transferência nem `BRANCH_ADMIN`; o banco já fica preparado.
94. Na V1 o login sempre devolve o token com a Matriz, inclusive para OWNER/ADMIN.
95. Domínio único (`app.senhas.com`). O slug da organização é gerado automaticamente do nome e aparece só no link de login dos funcionários (`/<slug>/login`).
96. Slugs reservados (páginas do frontend) ficam em `RESERVED_SLUGS` (shared/constants).
97. Cadastro: body plano com todos os campos obrigatórios; `email` vira login do OWNER e contato da organização; sem token na resposta.
98. CPF/CNPJ e telefone: normalizar para dígitos e validar com regex simples (shared/utils).
99. Termos de uso: gravar `terms_accepted_at` e `terms_version`.
100. Repository filtra `deleted_at IS NULL` por padrão (`notDeleted`); exceções explícitas: restauração, conflito, histórico.
101. Violação de unicidade do PostgreSQL vira o `409` correspondente, nunca `500`.
102. Sem prefixo de versão nas rotas; `GET /health` disponível.
103. O slug é usado apenas no login; nenhuma rota de negócio recebe slug — escopo sempre pelo token.
104. Valor gerado que colide (slug, username, código da senha): refazer a transação inteira, até 5 tentativas. Valor informado que colide: `409`.
105. Ids em params/body validados como UUID pelo Zod; inválido → `400`.
106. Limites de tamanho do Zod iguais aos do banco.
107. Logger com `redact` de senhas e do header `authorization`; nunca logar senha, hash ou token.
108. `GET /auth/me` devolve o formato do login sem token; funciona mesmo com licença inválida.
109. Paginação: `page` (padrão 1) e `pageSize` (padrão 20, máximo 100).
110. `GET /organizations/by-slug/:slug`: organização inexistente, inativa ou excluída → `404`.
111. Respostas em camelCase, datas ISO 8601 UTC, dados crus; formatação é do frontend. Mensagens em português, exceptions em inglês.
112. Migrations manuais (`npm run db:migrate`); testes em banco separado (`senhas_test`); `npm run db:seed` para dados de exemplo.
113. `users.password_changed_at`: troca/redefinição de senha invalida tokens emitidos antes (`iat`).
114. Logout é só apagar a sessão no Next.js; sem endpoint no backend.
115. Vínculos (guichê↔departamento, usuário↔departamento) são apagados de verdade; entidades usam exclusão lógica.
116. Chaves estrangeiras usadas em consultas têm índice.
117. Fase 1 inclui edição/desativação (`PATCH`) de usuários, departamentos e guichês e `GET /users`; excluir/restaurar na fase 2.
118. MVP inclui sessão no balcão, chamada de senha (próxima e específica), rechamar, finalizar, não compareceu, cancelar e painel.
119. Chamar exige sessão ativa no balcão; no máximo uma senha `IN_SERVICE` por atendente.
120. Atendente chama apenas dos departamentos liberados para ela (OWNER/ADMIN: todos da filial).
121. `call-next` usa `FOR UPDATE SKIP LOCKED`; chamada específica usa `UPDATE ... WHERE status = 'WAITING'`.
122. Painel da TV no MVP: usuário VIEWER + `GET /tickets/display` por polling; sem dispositivo nem WebSocket.
123. Toda mudança de status de senha grava `TicketHistory` na mesma transação.
124. Documentação OpenAPI gerada dos schemas Zod (`fastify-type-provider-zod` + `@fastify/swagger`); UI Scalar em `/docs`.
125. Toda rota declara `schema` (body, params, querystring, response), `tags`, `summary` e erros (`ApiErrorResponse`); rotas autenticadas declaram `bearerAuth`.
126. Nunca escrever documentação de rota separada do código; o schema que valida é o que documenta.
127. `/docs` controlado por `DOCS_ENABLED` (ligado em dev, desligado em produção por padrão).
128. Uma rota só está pronta quando aparece corretamente no Scalar.

---

# 47. Princípio geral

O projeto deve priorizar:

```text
clareza
+
baixo acoplamento
+
regras explícitas
+
consistência
+
facilidade de evolução
```

Evitar:

```text
overengineering
microserviços prematuros
abstrações genéricas sem necessidade
shared gigantesco
utils como pasta de descarte
DTO compartilhado entre features sem necessidade
regra de negócio dentro de controller
regra de negócio dentro de repository
```

Quando houver dúvida entre uma solução simples e uma solução altamente genérica:

> escolher a solução simples enquanto os requisitos atuais não exigirem a complexidade adicional.
