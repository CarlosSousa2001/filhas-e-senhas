# Queue System — Contexto da Aplicação

> Documento de contexto funcional e técnico do projeto.
>
> Este arquivo explica **o que estamos construindo**, **como o domínio funciona**, **quais regras já foram definidas** e **qual é o escopo inicial da implementação**.
>
> As convenções de código, nomenclatura, responses, errors e arquitetura detalhada ficam no documento:
>
> `queue-system-guidelines.md`

---

# 1. Objetivo do produto

O projeto é um sistema SaaS multi-tenant para gerenciamento de filas e senhas de atendimento.

A aplicação deve permitir que diferentes empresas utilizem o mesmo sistema sem compartilhar dados entre si.

Exemplos de clientes:

- clínicas;
- laboratórios;
- escritórios;
- recepções;
- empresas com setores internos;
- ambientes com balcões;
- ambientes com múltiplos guichês.

Cada empresa representa uma `Organization`.

> "Multi-tenant" continua sendo o nome do padrão arquitetural. No domínio e no código, a entidade se chama `Organization` e a coluna `organization_id`. Não usar `tenant`, `tenantId` ou `tenant_id`.

---

# 2. Estrutura principal do domínio

Visão conceitual:

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

Cada organização possui seus próprios dados.

Dentro da organização, cada filial (`Branch`) possui seus próprios usuários, departamentos, guichês e senhas, isolados das demais filiais.

Nenhum usuário deve conseguir acessar recursos pertencentes a outra organização.

---

# 3. Stack definida

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
OpenAPI (@fastify/swagger) + Scalar (documentação da API em /docs)
```

Arquitetura:

```text
Monólito modular
```

Não utilizar microserviços neste momento.

---

# 4. Organization

`Organization` representa a empresa/organização cliente do sistema e é o ponto de partida de todo o domínio.

Campos:

```text
organizations
- id
- name
- slug
- document
- contact_email
- contact_phone
- terms_accepted_at
- terms_version
- active
- created_at
- updated_at
- deleted_at
```

Exemplo:

```text
name:              Clínica Sorriso
slug:              clinica-sorriso
document:          12345678000190
contact_email:     camila@gmail.com
contact_phone:     11987654321
terms_accepted_at: 2026-03-09T14:00:00Z
terms_version:     2026-03
```

Regras:

- `document` (CPF/CNPJ) é obrigatório, gravado apenas com dígitos e único entre organizações (inclusive excluídas);
- `contact_email` é o e-mail principal da organização: cobrança e comunicação;
- `contact_phone` é obrigatório, gravado apenas com dígitos;
- `terms_accepted_at` e `terms_version` registram o aceite dos termos de uso no cadastro (comprovante);
- organização com `active = false` ou `deleted_at` preenchido não permite login;
- na V1 nenhuma role desativa a organização: isso é feito apenas pelo suporte, mediante contato do cliente.

## Slug (link de login dos funcionários)

Todas as empresas usam o mesmo domínio: `app.senhas.com`.

O slug é um código em texto da organização, gerado do nome:

```text
Clínica Sorriso   → clinica-sorriso
Laboratório Vida  → laboratorio-vida
```

Por que existe: o username dos funcionários é único apenas dentro da organização (dois `gabriel.4821` podem existir em empresas diferentes). Com apenas username e senha, o backend não saberia de qual empresa é o login. O slug, que vai no link de login dos funcionários, diz qual é a empresa.

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

Onde o slug é usado:

```text
link de login dos funcionários (app.senhas.com/clinica-sorriso/login)   sim
POST /auth/login do funcionário                                         sim
GET /organizations/by-slug/:slug (nome da empresa na tela de login)     sim
login do dono (e-mail)                                                  não
todas as outras rotas                                                   não — usam o token
```

Isolamento entre organizações:

```text
Clínica Sorriso
├── usuários
├── departamentos
├── guichês
└── tickets

Laboratório Vida
├── usuários
├── departamentos
├── guichês
└── tickets
```

Os dados nunca podem se misturar.

Cada usuário pertence a exatamente uma organização.

---

# 4.1 Branch (Filial)

> **Escopo da V1:** o banco já está preparado para várias filiais, mas na V1 **cada organização tem uma única filial** (a Matriz, criada junto com a organização). Não implementar agora: criar/editar/listar filiais, seleção de filial (`POST /auth/branch`), `X-Expected-Branch-Id`, transferência de usuário entre filiais e uso da role `BRANCH_ADMIN`. As regras abaixo ficam documentadas para quando a multi-filial for implementada.

Uma organização pode ter várias filiais (unidades físicas).

Exemplo: a Clínica No Bem compra o sistema e tem 6 filiais. Todas ficam dentro da mesma organização, com um único OWNER e uma única licença.

Campos:

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

Regras:

- cada filial tem seus próprios usuários, departamentos, guichês e senhas, isolados das demais filiais;
- a licença pertence à organização e cobre todas as filiais;
- sem limite de filiais na V1;
- ao criar a organização, nasce automaticamente a filial padrão **"Matriz"**;
- toda filial nasce com o departamento padrão (`Atendimento`, prefixo `AT`);
- OWNER e ADMIN criam, editam, desativam, excluem e restauram filiais;
- nome da filial é livre;
- filial desativada ou excluída: os usuários dela não executam nada (middleware) e OWNER/ADMIN não conseguem selecioná-la;
- cliente com uma única filial não percebe diferença: OWNER/ADMIN já entram com a Matriz selecionada.

Usuários de organização × usuários de filial:

```text
OWNER, ADMIN                                → branch_id nulo, atuam em todas as filiais
BRANCH_ADMIN, MANAGER, ATTENDANT, VIEWER    → branch_id obrigatório, só a própria filial
```

Funcionário que trabalha em duas filiais: na V1 um usuário de filial pertence a **uma** filial. As opções são:

- transferir o usuário (OWNER ou ADMIN alteram a filial dele); ou
- criar uma segunda conta na outra filial.

Ao transferir:

- os acessos a departamentos da filial antiga são removidos;
- a `OperatorSession` ativa, se houver, é encerrada (`ADMIN_ACTION`);
- o token antigo deixa de valer (o middleware compara a filial do token com a do banco) e o usuário precisa fazer login de novo.

Nomenclatura: `Branch` / `branches` / `branch_id` / `branchId` no código; "Filial" na tela.

Futuro (fora da V1): usuário de filial com acesso a várias filiais; ADMIN regional (apenas filiais escolhidas); fuso horário por filial.

---

# 5. Identificação de usuários e login

## 5.1 OWNER

O usuário que cria a conta e compra a licença é o `OWNER`.

O e-mail do OWNER é **único globalmente** no sistema.

Exemplo:

```text
name:         Camila
email:        camila@gmail.com
username:     camila.3910
role:         OWNER
organization: Clínica Sorriso
```

Como o e-mail é único, o backend descobre a organização diretamente:

```text
email
↓
User OWNER
↓
organization_id
```

Consequência: um mesmo e-mail não pode ser OWNER de duas organizações.

---

## 5.2 Funcionários

ADMIN, BRANCH_ADMIN, MANAGER, ATTENDANT e VIEWER não dependem de e-mail.

Ao criar um funcionário, o sistema gera (ou aceita) um `username`.

Exemplo:

```text
name:     Gabriel Silva
username: gabriel.4821
password: ******
email:    (opcional)
```

Regras do username:

- único **dentro da organização** (não por filial e não globalmente); assim o login continua `slug da organização + username`, e a filial vem do próprio usuário;
- apenas letras minúsculas, números, `.` e `_`;
- quando não informado, é gerado a partir do primeiro nome + `.` + 4 dígitos aleatórios
  (sem acentos, minúsculo: `Gabriel Silva → gabriel.4821`);
- se o nome não gerar nenhum caractere válido (ex.: só símbolos), usar `usuario` como base (`usuario.4821`);
- se o username gerado já existir na organização, gerar outro;
- se o username informado já existir na organização: `409 UsernameAlreadyExistsException`;
- o username pode ser alterado depois por OWNER (de qualquer usuário) ou ADMIN (de qualquer usuário, exceto o OWNER), mantendo a unicidade na organização.

O OWNER também recebe um username, para poder entrar pelo login da organização se quiser.

E-mail de funcionário é opcional e não é usado para login. Quando informado, é único dentro da organização.

Assim podemos ter, sem conflito:

```text
Clínica Sorriso   → username: gabriel.4821
Laboratório Vida  → username: gabriel.4821
```

---

## 5.3 Fluxos de login

Funcionários não fazem login apenas com `username + senha`, porque o mesmo username pode existir em duas organizações.

O login dos funcionários usa o link da empresa, no domínio único do sistema:

```text
app.senhas.com/clinica-sorriso/login
```

Como o slug chega até o login:

```text
1. Cadastro: o backend gera o slug a partir do nome ("Clínica Sorriso" → clinica-sorriso)
2. A tela de sucesso do cadastro mostra ao OWNER o link dos funcionários:
   app.senhas.com/clinica-sorriso/login
3. O OWNER cria o funcionário e passa para ele: link + username + senha
4. O funcionário abre o link (ou o favorito salvo)
5. O Next.js lê o slug do caminho da URL (rota app/[slug]/login)
   — o funcionário NÃO digita o slug, digita apenas username e senha
6. O frontend envia { organizationSlug, username, password } para POST /auth/login
```

Tela de login do funcionário:

- mostra o nome da empresa no topo, obtido por `GET /organizations/by-slug/:slug` (rota pública, retorna apenas `{ name }`);
- slug inexistente (link digitado errado), organização inativa ou excluída → `404 OrganizationNotFoundException`; a tela mostra "Empresa não encontrada";
- funcionário que abre apenas `app.senhas.com` → a página "Login do funcionário" pede o **código da empresa** (o slug) e redireciona para `app.senhas.com/<slug>/login`; o Next.js pode lembrar a última empresa usada naquele navegador.

O **dono** não usa o link: entra em `app.senhas.com/login` com e-mail e senha (o e-mail do OWNER é único no sistema).

**O slug é usado apenas no login.** Depois dele, todas as rotas (departamentos, guichês, senhas, usuários…) usam somente o token, que carrega `organizationId` e `branchId`. Nenhuma rota de negócio recebe slug:

```text
GET /departments                     ✔
GET /clinica-sorriso/departments     ✘ não existe
```

Isso também é segurança: se as consultas usassem o slug da URL, bastaria trocá-lo para tentar ver outra empresa. Como a empresa vem do token assinado, isso é impossível.

### OWNER

```text
email + senha
↓
User OWNER com esse email
↓
organization_id
↓
valida senha
↓
JWT
```

### Funcionário

```text
organizationSlug + username + senha
↓
Organization pelo slug
↓
User daquela organization com esse username
↓
valida senha
↓
filial do usuário (branch_id), quando houver
↓
JWT
```

Consulta conceitual:

```sql
SELECT *
FROM users
WHERE organization_id = :organizationId
  AND username = :username;
```

---

## 5.4 Endpoint de login

Um único endpoint atende os dois fluxos:

```text
POST /auth/login
```

O body é validado por Zod como uma união de dois formatos.

OWNER:

```json
{
  "email": "camila@gmail.com",
  "password": "******"
}
```

Funcionário:

```json
{
  "organizationSlug": "clinica-sorriso",
  "username": "gabriel.4821",
  "password": "******"
}
```

Regras:

- se o body tiver `organizationSlug`, usar o fluxo de funcionário (qualquer role da organização, inclusive OWNER);
- se o body tiver `email`, usar o fluxo de OWNER (busca apenas `role = OWNER`);
- e-mail, slug e username são normalizados (trim + minúsculas) antes da busca;
- os dois formatos de body são schemas Zod estritos: campos extras são rejeitados (um body com `email` e `organizationSlug` juntos é inválido);
- quando o usuário não é encontrado, ainda assim comparar a senha com um hash fictício, para que o tempo de resposta não revele se o e-mail/username existe;
- organização inexistente, usuário inexistente ou senha errada retornam o mesmo erro, sem revelar qual dado falhou:

```json
{
  "message": "Credenciais inválidas",
  "statusCode": 401,
  "exception": "InvalidCredentialsException"
}
```

- senha correta, mas usuário inativo ou excluído: `403 UserInactiveException`;
- senha correta, mas organização inativa: `403 OrganizationInactiveException`;
- senha correta, mas filial do usuário inativa ou excluída: `403 BranchInactiveException`;
- licença inválida **não** impede o login (ver seção 11).

Response:

```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "2eaf...",
    "name": "Gabriel Silva",
    "username": "gabriel.4821",
    "role": "ATTENDANT"
  },
  "organization": {
    "id": "9ac1...",
    "name": "Clínica Sorriso",
    "slug": "clinica-sorriso"
  },
  "branch": {
    "id": "b71d...",
    "name": "Matriz"
  },
  "license": {
    "status": "ACTIVE",
    "expiresAt": "2026-04-09T02:30:00.000Z",
    "valid": true
  }
}
```

Com `license.valid = false`, o frontend avisa que a licença não está ativa e que é preciso contatar o suporte.

`branch` é a filial do usuário. Para OWNER/ADMIN vem `null`, exceto quando a organização tem uma única filial ativa (nesse caso ela já vem selecionada). Com `null`, o frontend mostra a lista de filiais para escolha (seção 5.7).

Na V1 toda organização tem uma única filial, então o login **sempre** devolve a Matriz, inclusive para OWNER/ADMIN.

## Usuário logado: `GET /auth/me`

Rota autenticada que devolve o mesmo formato da resposta do login, **sem** o `accessToken`:

```text
GET /auth/me
→ { user, organization (com slug), branch, license }
```

Usada pelo frontend ao recarregar a página e para mostrar ao OWNER o link de login dos funcionários (`app.senhas.com/<slug>/login`) sempre que precisar.

Com licença inválida, `GET /auth/me` continua respondendo (assim como o login), para o frontend mostrar o aviso de licença.

O `slug` volta na resposta para o frontend montar o link de login dos funcionários (por exemplo, para o OWNER copiar e enviar à equipe).

---

## 5.5 JWT

Depois da autenticação, o token carrega:

```ts
{
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
}
```

Usuário de filial:

```json
{
  "userId": "2eaf...",
  "organizationId": "9ac1...",
  "branchId": "b71d...",
  "role": "ATTENDANT"
}
```

OWNER/ADMIN antes de selecionar filial:

```json
{
  "userId": "7c10...",
  "organizationId": "9ac1...",
  "branchId": null,
  "role": "OWNER"
}
```

Regras:

- usuário de filial: `branchId` é a filial dele, fixa;
- OWNER/ADMIN: `branchId` é a filial selecionada (seção 5.7) ou `null`; na V1 é sempre a Matriz;
- o token fica guardado na sessão do Next.js, em cookie HttpOnly (seção 7.1), nunca em `localStorage`.

---

## 5.6 Senha

Regras:

- mínimo de 8 e máximo de 128 caracteres;
- armazenada apenas como hash (argon2).

Troca da própria senha (qualquer usuário):

```text
PATCH /auth/password
{ currentPassword, newPassword }
```

- `currentPassword` incorreta: `400 InvalidCurrentPasswordException`.

Redefinição da senha de outro usuário:

```text
PATCH /users/:userId/password
{ newPassword }
```

- OWNER redefine de qualquer usuário;
- ADMIN redefine de qualquer usuário, exceto o OWNER;
- BRANCH_ADMIN redefine de MANAGER, ATTENDANT e VIEWER da sua filial.

Troca ou redefinição de senha derruba as sessões antigas:

- `users.password_changed_at` é atualizado sempre que a senha muda (troca própria ou redefinição por OWNER/ADMIN);
- o `authMiddleware` recusa tokens emitidos (`iat`) antes de `password_changed_at` → `401 UnauthorizedException`;
- assim, se uma senha vazar e for redefinida, o token roubado deixa de funcionar na hora;
- o mesmo mecanismo permite "sair de todos os dispositivos" de um usuário.

OWNER que esqueceu a senha: contato com o suporte na V1. Recuperação por e-mail fica para o futuro.

---

## 5.7 Filial selecionada (OWNER e ADMIN)

> **Futuro (multi-filial):** não implementar na V1. Na V1 toda organização tem uma única filial, e o token sempre vem com ela.

Usuários de filial nunca escolhem filial: ela vem fixa no token.

OWNER e ADMIN atuam em todas as filiais e precisam escolher em qual estão operando. A filial escolhida vira um claim do JWT:

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

Regras:

- só OWNER e ADMIN usam `POST /auth/branch`; demais roles → `403 ForbiddenException`;
- filial de outra organização, inexistente, inativa ou excluída → `404 BranchNotFoundException`;
- rotas de filial (departamentos, guichês, usuários de filial, senhas) chamadas com `branchId = null` → `400 BranchNotSelectedException`;
- rotas de organização (filiais, licença, usuários ADMIN) não exigem filial selecionada;
- cada navegador/dispositivo tem sua própria sessão: o OWNER pode estar na Filial 1 no notebook e na Filial 2 no celular.

---

## 5.8 Abas desatualizadas

> **Futuro (multi-filial):** não implementar na V1. Na V1 toda organização tem uma única filial, e o token sempre vem com ela.

O cookie de sessão é compartilhado por todas as abas do navegador. Se o OWNER troca para a Filial 2 na aba A, a aba B ainda **mostra** a Filial 1, mas já enviaria requisições com a sessão da Filial 2.

Para isso ser impossível, toda requisição de rota de filial envia a filial que a tela está mostrando:

```text
X-Expected-Branch-Id: <filial que a tela está mostrando>
```

```text
header == token.branchId → segue
header ≠ token.branchId  → 409 BranchContextChangedException
header ausente           → 400 ExpectedBranchRequiredException
```

Ao receber `409`, o frontend recarrega a tela na filial atual.

O header **não define** o escopo da operação (quem define é sempre o token). Ele apenas impede que uma tela desatualizada execute uma ação. Um valor falso só faz a requisição ser recusada.

---

# 6. Regra principal: organização e filial

O frontend não escolhe livremente a organização nem a filial da operação.

Evitar:

```text
GET /departments?organizationId=123
GET /departments?branchId=456
```

A aplicação deve utilizar:

```ts
request.user.organizationId
request.user.branchId
```

como fonte da organização e da filial autenticadas.

Exemplo:

```ts
const departments =
  await departmentRepository.findByBranch(
    request.user.organizationId,
    request.user.branchId,
  );
```

Regra:

> Nunca confiar em `organizationId` ou `branchId` enviados por body, query ou params para definir o escopo da operação.

Casos especiais:

- login de funcionário: o `organizationSlug` apenas indica **em qual organização procurar o username**; o escopo das operações seguintes vem sempre do JWT. Nenhuma outra rota de negócio recebe slug;
- `POST /auth/branch`: o `branchId` do body só vira claim depois de validado contra a organização do token (seção 5.7);
- `X-Expected-Branch-Id`: apenas conferência, nunca define escopo (seção 5.8);
- quando OWNER/ADMIN referenciam uma filial como **recurso** (editar, desativar filial, transferir usuário), o id vem na URL e é sempre validado contra a organização do token.

---

# 7. Middleware de autenticação

Essa estrutura deve existir desde o início do projeto.

Fluxo:

```text
Request
  ↓
auth middleware / Fastify hook
  ↓
lê Bearer Token
  ↓
valida JWT
  ↓
extrai:
userId
organizationId
branchId
  ↓
busca User no banco (por id)
  ↓
token emitido depois da última troca de senha?
  ↓
usuário ativo e não excluído?
  ↓
organização ativa?
  ↓
licença válida?
  ↓
usuário de filial: branchId do token == users.branch_id?
  ↓
filial do token (se houver) existe, é da organização e está ativa?
  ↓
request.user (role atual do banco)
  ↓
[rotas de filial] requireBranch:
branchId não nulo
(+ X-Expected-Branch-Id, quando houver multi-filial)
  ↓
controller
```

Estrutura:

```ts
export type AuthenticatedUser = {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
};
```

Rotas protegidas usam o middleware reutilizável. Rotas de filial usam também `requireBranch`:

```ts
fastify.get(
  "/departments",
  {
    preHandler: [authMiddleware, requireBranch],
  },
  listDepartmentsController,
);
```

Verificações:

- toda rota autenticada consulta o usuário no banco (busca por chave primária, barata);
- usuário desativado ou excluído não executa nada, mesmo com token válido;
- a `role` usada na autorização é a **atual do banco**, não a do token; mudança de role vale na hora;
- licença inválida bloqueia **todas** as rotas autenticadas; apenas o login e `GET /auth/me` continuam funcionando.

Erros:

```text
token ausente, inválido ou expirado              → 401 UnauthorizedException
filial do token ≠ filial do usuário (transferido) → 401 UnauthorizedException (novo login)
token emitido antes da última troca de senha     → 401 UnauthorizedException (novo login)
usuário inativo ou excluído                       → 403 UserInactiveException
organização inativa ou excluída                   → 403 OrganizationInactiveException
licença inválida                                  → 403 LicenseInactiveException
filial inativa ou excluída                        → 403 BranchInactiveException
rota de filial sem filial selecionada             → 400 BranchNotSelectedException
X-Expected-Branch-Id ausente                      → 400 ExpectedBranchRequiredException  (futuro)
X-Expected-Branch-Id diferente do token           → 409 BranchContextChangedException    (futuro)
```

Exemplo:

```json
{
  "message": "Não autenticado",
  "statusCode": 401,
  "exception": "UnauthorizedException"
}
```

---

## 7.1 Frontend (Next.js) e sessão

O frontend é Next.js e trabalha com sessão em cookie. O token **nunca** fica em `localStorage`.

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

---

# 8. Rotas públicas

Nem todas as rotas utilizarão autenticação de usuário.

Rotas públicas da V1:

```text
POST /auth/login        (OWNER: email | funcionário: organizationSlug + username)
POST /organizations
GET  /organizations/by-slug/:slug   (nome da empresa na tela de login do funcionário)
```

Futuro (totem/TV):

```text
/device/activate
```

Gerar senha **não** é rota pública: exige usuário logado da organização (ver seção 48).

Rate limit das rotas públicas:

```text
POST /auth/login      60 requisições / minuto por IP
                      10 requisições / minuto por conta (slug + username, ou email)
POST /organizations   30 requisições / hora por IP
GET  /organizations/by-slug/:slug   120 requisições / minuto por IP
```

Os valores são configuráveis por variável de ambiente.

Como o navegador fala com o Next.js (seção 7.1), o IP real do cliente chega ao Fastify em `X-Forwarded-For`, aceito apenas do servidor do Next.js.

Os limites por IP são propositalmente confortáveis: vários funcionários de uma mesma clínica saem pelo mesmo IP. O limite por conta protege contra tentativa de adivinhar a senha de um usuário específico.

Ao exceder:

```json
{
  "message": "Muitas requisições. Tente novamente em instantes.",
  "statusCode": 429,
  "exception": "RateLimitExceededException"
}
```

---

# 9. Criação de organização (cadastro)

A tela de registro tem um formulário com **todos os campos obrigatórios**:

```text
Nome da organização
CPF/CNPJ
Nome do usuário dono (OWNER)
Telefone de contato
E-mail principal (login do OWNER + cobrança e comunicação)
Senha
Confirmação de senha
[x] Aceito os termos de uso
```

A partir desse cadastro é criada toda a base mínima da empresa.

Request:

```text
POST /organizations
```

```json
{
  "organizationName": "Clínica Sorriso",
  "document": "12.345.678/0001-90",
  "ownerName": "Camila Souza",
  "phone": "(11) 98765-4321",
  "email": "camila@gmail.com",
  "password": "******",
  "passwordConfirmation": "******",
  "acceptedTerms": true
}
```

Fluxo (uma única transação):

```text
POST /organizations
      ↓
create Organization
(slug gerado, document, contact_email, contact_phone, aceite dos termos)
      ↓
create License ACTIVE (30 dias)
      ↓
create Branch "Matriz"
      ↓
create User OWNER (sem filial, email, username gerado, senha argon2)
      ↓
create Department padrão "Atendimento" / AT (na Matriz)
      ↓
COMMIT
```

Se alguma operação falhar:

```text
ROLLBACK
```

Não permitir organização parcialmente criada.

Para onde vai cada campo:

```text
organizationName       → organizations.name (e base do slug)
document               → organizations.document (só dígitos)
phone                  → organizations.contact_phone (só dígitos)
email                  → organizations.contact_email E users.email do OWNER
ownerName              → users.name do OWNER (e base do username)
password               → users.password_hash do OWNER
acceptedTerms          → organizations.terms_accepted_at = agora
                         organizations.terms_version = versão atual dos termos
```

O mesmo e-mail preenche o login do OWNER e o contato da organização. No banco eles ficam separados, para o contato poder mudar no futuro sem alterar o login.

Validações (`400 ValidationException` com `FieldError[]`):

- todos os campos são obrigatórios;
- `document`: aceito com ou sem máscara; normalizado para dígitos; 11 (CPF) ou 14 (CNPJ) dígitos — regex simples em `shared/utils`;
- `phone`: aceito com ou sem máscara; normalizado para dígitos; 10 ou 11 dígitos — regex simples em `shared/utils`;
- `email`: formato válido, normalizado (trim + minúsculas);
- `password`: 8 a 128 caracteres;
- `passwordConfirmation` diferente de `password` → erro no campo `passwordConfirmation` ("As senhas não conferem");
- `acceptedTerms` diferente de `true` → erro no campo `acceptedTerms` ("É necessário aceitar os termos de uso").

Conflitos:

- CPF/CNPJ já cadastrado (inclusive em organização excluída) → `409 OrganizationDocumentAlreadyExistsException`;
- e-mail já usado por outro OWNER → `409 OwnerEmailAlreadyExistsException`.

Slug: sempre gerado automaticamente (seção 4). Se dois cadastros simultâneos gerarem o mesmo slug, o que perder a corrida tem a transação refeita com um novo sufixo (até 5 tentativas), em vez de retornar erro.

Response `201`:

```json
{
  "organization": {
    "id": "9ac1...",
    "name": "Clínica Sorriso",
    "slug": "clinica-sorriso"
  },
  "owner": {
    "id": "7c10...",
    "name": "Camila Souza",
    "email": "camila@gmail.com",
    "username": "camila.3910"
  },
  "branch": {
    "id": "b71d...",
    "name": "Matriz"
  },
  "license": {
    "status": "ACTIVE",
    "expiresAt": "2026-04-08T14:00:00.000Z"
  }
}
```

O cadastro **não** devolve token. Depois dele, o frontend mostra ao OWNER o link de login dos funcionários (`app.senhas.com/clinica-sorriso/login`) e o leva para o login do dono (`app.senhas.com/login`).

- **mapeado para o futuro (fora do escopo atual):** verificar o e-mail do OWNER (link de confirmação) antes de ativar a organização. Sem isso, alguém pode cadastrar uma organização com o e-mail de outra pessoa e bloqueá-lo. Até lá, o suporte pode liberar manualmente um e-mail usado indevidamente.

---

# 10. OWNER inicial

O usuário que cria a conta será automaticamente:

```text
OWNER
```

Ele representa o usuário raiz daquela organização.

O OWNER possui acesso administrativo total à própria empresa.

O e-mail do OWNER é obrigatório e único globalmente (ver seção 5.1).

O OWNER não pertence a nenhuma filial (`branch_id` nulo): atua em todas.

---

# 11. License

Toda organização possui exatamente uma licença, que cobre todas as filiais.

Status iniciais:

```text
ACTIVE
EXPIRED
CANCELLED
```

Ao criar uma organização:

```text
License.status     = ACTIVE
License.started_at = agora
License.expires_at = agora + 30 dias
```

Toda licença nasce valendo **30 dias**. Depois disso, ela deixa de valer.

Licença válida:

```text
status = ACTIVE
E expires_at > agora
```

Uma licença `ACTIVE` com `expires_at` no passado é tratada como expirada, mesmo que nenhum job tenha alterado o status ainda.

A primeira versão não terá integração de pagamento.

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

# 12. Roles

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

# 13. Department

Department representa uma área ou fila de atendimento.

Cada departamento pertence a uma filial.

Exemplos:

```text
Consulta
Exames
Cirurgia
Coleta
Engenharia
Financeiro
```

Cada departamento possui:

```text
id
organizationId
branchId
name
prefix
active
```

---

# 14. Prefixo do departamento

Cada departamento possui um prefixo de no máximo 4 caracteres.

Exemplo:

```text
Departamento: Exames
Prefixo: EX
```

Outro exemplo:

```text
Departamento: Cirurgia
Prefixo: CIR
```

O prefixo deve ser único dentro da **filial**. Filiais diferentes podem usar o mesmo prefixo (`EX` em todas).

Regras do prefixo:

- normalizado para maiúsculas antes de gravar (`ex` → `EX`);
- apenas letras A–Z e números, de 1 a 4 caracteres (`^[A-Z0-9]{1,4}$`);
- **não pode ser editado** depois de criado (o nome do departamento pode).

---

# 15. Department padrão

Toda filial nasce automaticamente com um departamento padrão (inclusive a Matriz, criada junto com a organização).

Exemplo:

```text
Nome:    Atendimento
Prefixo: AT
```

---

# 16. Limite inicial de departamentos

Limite inicial:

```text
5 departamentos por filial
```

Esse limite poderá mudar futuramente.

Departamentos inativos (`active = false`) contam no limite.

Departamentos excluídos (`deleted_at` preenchido) não contam.

```text
desativar → some da fila, pode ser reativado, conta no limite
excluir   → some das listagens, não conta no limite, pode ser restaurado (seção 16.1)
```

Na V1 a verificação do limite é uma contagem simples antes de inserir, sem lock. Em caso de duas criações simultâneas, o limite pode ser ultrapassado em 1; isso é aceito.

---

# 16.1 Exclusão lógica e restauração

Excluir não apaga a linha do banco: apenas preenche `deleted_at`. Tickets, histórico e auditoria continuam apontando para o registro.

Exceção: **vínculos** (guichê ↔ departamento, usuário ↔ departamento) não têm exclusão lógica. Remover um vínculo apaga a linha de verdade. Já excluir um usuário, departamento ou guichê **não** remove os vínculos dele, para que voltem na restauração.

Valores únicos **nunca são reaproveitados**, nem de registros excluídos. Em vez de criar um registro novo com o mesmo valor, o sistema oferece **restaurar** o registro excluído.

Vale para:

```text
Department  → prefix (dentro da filial)
User        → username, email (dentro da organização)
```

`ServicePoint` não tem valor único (o nome é livre, pode repetir), mas também pode ser excluído e restaurado.

**Tudo que é excluído pode ser restaurado** (filial, departamento, usuário, guichê).

## Fluxo na criação

```text
criar Department com prefixo EX
↓
existe Department ativo com EX?
→ 409 DepartmentPrefixAlreadyExistsException

existe Department EXCLUÍDO com EX?
→ 409 DeletedDepartmentExistsException
   (com o id do departamento excluído)
↓
frontend pergunta:
"Já existe um departamento excluído com este prefixo. Deseja restaurá-lo?"
↓
se confirmar:
POST /departments/:id/restore
```

O mesmo vale para usuário (username ou email de funcionário excluído → `DeletedUserExistsException`).

Exceção: username **gerado automaticamente** que colida com um usuário excluído é simplesmente gerado de novo, sem perguntar nada.

## Restaurar

```text
POST /branches/:branchId/restore
POST /departments/:departmentId/restore
POST /users/:userId/restore
POST /service-points/:servicePointId/restore
```

Restaurar:

- limpa `deleted_at` e volta `active = true`;
- mantém os dados anteriores (nome, prefixo, role, username);
- usuário restaurado recebe uma **senha nova**, definida por quem restaura (`{ password }` no body);
- mantém os vínculos anteriores (guichês associados, acessos a departamentos), pois a exclusão não os remove;
- se algo precisar mudar, editar depois da restauração.

Regras:

- departamento: restaurar faz ele voltar a contar no limite de 5; se o limite estiver cheio → `409 DepartmentLimitReachedException`;
- usuário: OWNER e ADMIN restauram qualquer usuário (o OWNER nunca é excluído);
- restaurar registro que não está excluído → `409`;
- restauração gera `AuditLog` (quando auditoria estiver implementada).

## Organização

Organização excluída não pode ser restaurada pela aplicação na V1 (não existe usuário com acesso a ela).

- `slug`, `document` e e-mail do OWNER de organização excluída continuam reservados;
- novo cadastro com o mesmo CPF/CNPJ ou e-mail de OWNER → `409` (`OrganizationDocumentAlreadyExistsException`, `OwnerEmailAlreadyExistsException`); o slug é sempre gerado e simplesmente recebe sufixo;
- restauração de organização é feita manualmente pelo suporte na V1.

---

# 17. ServicePoint

`ServicePoint` representa o ponto de atendimento.

Cada guichê pertence a uma filial.

Pode significar:

```text
guichê
balcão
mesa
sala
caixa
```

Exemplos:

```text
Guichê 1
Guichê 2
Guichê 3
```

---

# 18. ServicePoint não pertence ao usuário

Regra fundamental:

```text
User ≠ ServicePoint
```

Evitar vínculo permanente:

```text
ServicePoint.userId
```

Um usuário apenas ocupa temporariamente um guichê.

---

# 19. Department x ServicePoint

O modelo suporta relação N:N:

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

Exemplo:

```text
Departamento Cirurgia
├── Guichê 1
├── Guichê 2
└── Guichê 3
```

Futuramente:

```text
Guichê 1
├── Consulta
├── Exames
└── Coleta
```

O banco já deve permitir essa evolução mesmo que o frontend inicial seja mais simples.

Departamento e guichê associados precisam ser da **mesma filial** (validado pela aplicação).

---

# 20. Limite inicial de guichês

Limite inicial:

```text
10 guichês por departamento
```

O nome do guichê é livre (pode repetir).

Contagem do limite segue a regra dos departamentos: guichês inativos contam, excluídos não contam.

Com 5 departamentos:

```text
máximo inicial teórico:
50 guichês por filial
```

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

Departamentos permitidos:
- Engenharia
- Financeiro
```

Gabriel só deve visualizar departamentos permitidos para ele.

OWNER, ADMIN e BRANCH_ADMIN não precisam dessa tabela: visualizam todos os departamentos (OWNER/ADMIN de qualquer filial; BRANCH_ADMIN da sua).

Usuário e departamento vinculados precisam ser da **mesma filial**.

Essa tabela é exclusivamente operacional (quais departamentos o atendente pode visualizar/atender). Ela **não** é usada para validar geração de senha: a atendente do balcão gera senha para qualquer departamento ativo da filial (ver seção 48).

---

# 22. OperatorSession

OperatorSession representa a ocupação temporária de um guichê.

Fluxo:

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

---

# 23. Regras da OperatorSession

Um usuário só pode operar um guichê por vez.

```text
1 User
→ máximo 1 OperatorSession ACTIVE
```

Um guichê só pode possuir um operador por vez.

```text
1 ServicePoint
→ máximo 1 OperatorSession ACTIVE
```

Essas regras devem ser protegidas pelo backend e pelo banco.

Desativar ou excluir um usuário encerra a `OperatorSession` ACTIVE dele, se houver:

```text
ACTIVE → CLOSED
end_reason       = ADMIN_ACTION
ended_by_user_id = quem desativou/excluiu
```

Assim o guichê não fica preso a um usuário que não pode mais operar (implementação na fase 2).

---

# 24. Liberação de guichê por outro usuário

A aplicação deve evitar regras operacionais excessivamente rígidas.

Se Gabriel sair sem liberar o Guichê 3:

```text
Gabriel
→ Guichê 3
→ ACTIVE
```

Qualquer usuário da filial do guichê pode liberá-lo (exceto VIEWER, que é somente leitura). OWNER e ADMIN podem em qualquer filial. Não é exigido acesso ao departamento do guichê.

Exemplo:

```text
Carlos
→ Liberar Guichê 3
```

A sessão anterior passa para:

```text
ACTIVE → CLOSED
```

Registrar:

```text
ended_at
ended_by_user_id
end_reason
```

Motivos iniciais:

```text
USER_LEFT
FORCED_BY_USER
SERVICE_POINT_DISABLED
ADMIN_ACTION
```

---

# 25. Auditoria da liberação

Toda remoção forçada precisa ficar registrada.

Exemplo:

```text
Carlos removeu Gabriel do Guichê 3.
```

Essa ação deve gerar `AuditLog`.

O sistema privilegia:

```text
liberdade operacional
+
rastreabilidade
```

em vez de bloquear tudo por hierarquia.

---

# 26. Ticket

Ticket representa a senha de atendimento.

A senha não utiliza sequência numérica.

Formato:

```text
PREFIXO + "-" + 7 caracteres aleatórios
```

Exemplo:

```text
EX-A7K92P1
```

Onde:

```text
EX
→ prefixo do departamento

A7K92P1
→ código aleatório
```

## Geração do código

A parte aleatória vem de uma função utilitária simples, que pode ser trocada depois:

```text
shared/utils/random-code.ts
generateRandomCode(length)          → caracteres A–Z e 0–9 (crypto)

modules/ticket
generateTicketCode(prefix)          → prefix + "-" + generateRandomCode(7)
```

O alfabeto e o tamanho podem mudar no futuro sem afetar o restante do módulo.

---

# 27. Validade do Ticket

A senha é válida somente no dia em que foi criada.

Após o encerramento do dia, senhas ainda abertas devem ser expiradas.

## 27.1 Fuso horário

Na V1 o sistema inteiro trabalha com um único fuso:

```text
America/Sao_Paulo
```

Não existe timezone por organização na V1.

O "dia" de uma senha é definido por esse fuso. Isso vale para:

```text
service_date
expiração das senhas
relatórios diários
encerramento do dia
```

Regras:

- a aplicação calcula a data no fuso `America/Sao_Paulo` e grava `service_date` explicitamente;
- não depender de `CURRENT_DATE` nem do fuso da sessão do PostgreSQL;
- timestamps (`created_at`, `called_at` etc.) continuam como `TIMESTAMPTZ`, ou seja, um instante absoluto;
- o fuso é uma constante única da aplicação, para que o timezone por organização possa ser adicionado no futuro sem caçar datas espalhadas pelo código.

Exemplo:

```text
instante:      2026-03-10T02:30:00Z
São Paulo:     2026-03-09 23:30
service_date:  2026-03-09
```

---

# 28. Status do Ticket

Status definidos:

```text
WAITING
IN_SERVICE
FINISHED
NO_SHOW
CANCELLED
EXPIRED
```

---

# 29. Fluxo principal do Ticket

```text
WAITING
   ↓
IN_SERVICE
   ↓
FINISHED
```

Ao chamar a próxima senha:

```text
WAITING → IN_SERVICE
```

Não haverá status separado `CALLED` na V1.

---

# 30. NO_SHOW

Se a pessoa não comparecer:

```text
IN_SERVICE → NO_SHOW
```

Ao tentar chamar outra senha com uma senha atual em atendimento:

```text
A senha atual ainda não foi atendida.
Deseja chamar outra?
```

Se confirmar:

```text
senha atual → NO_SHOW
nova senha → IN_SERVICE
```

---

# 31. CANCELLED

Uma senha pode ser invalidada manualmente.

Possíveis transições:

```text
WAITING → CANCELLED
IN_SERVICE → CANCELLED
```

Desativar ou excluir um departamento (fase 2): as senhas `WAITING` desse departamento passam para `CANCELLED`, com motivo registrado (`DEPARTMENT_DISABLED` ou `DEPARTMENT_DELETED`) e evento `CANCELLED` no histórico.

---

# 32. EXPIRED

No encerramento do dia:

```text
WAITING → EXPIRED
IN_SERVICE → EXPIRED
```

Senhas encerradas anteriormente permanecem com seus estados originais.

Na prática (fase 2):

- um job roda à meia-noite de `America/Sao_Paulo` e marca como `EXPIRED` as senhas `WAITING` / `IN_SERVICE` com `service_date` anterior a hoje, registrando o evento `EXPIRED` no histórico;
- as consultas da fila sempre filtram `service_date = hoje`, então mesmo que o job atrase, uma senha de ontem nunca é chamada.

---

# 33. Rechamada

O atendente poderá rechamar uma senha.

A tela do atendente mostrará aproximadamente as últimas 6 a 10 senhas chamadas por ele.

Exemplo:

```text
EX-A7K92P1   EM ATENDIMENTO
EX-K29M4Q8   FINALIZADA
EX-R8H2KL9   NÃO COMPARECEU
```

Rechamar não altera status.

```text
IN_SERVICE
   ↓
RECALLED
   ↓
IN_SERVICE
```

`RECALLED` é evento, não status.

---

# 34. Status x Evento

Status:

```text
situação atual da senha
```

Evento:

```text
acontecimento registrado no histórico
```

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

# 35. Ordenação da fila

"Chamar a próxima" sempre pega a mais antiga em `WAITING`, entre os departamentos que a atendente pode atender.

A atendente também pode chamar uma senha específica da lista de senhas aguardando (seção 48.1).

Conceitualmente:

```sql
WHERE department_id IN (:departamentosDaAtendente)
  AND status = 'WAITING'
  AND service_date = :today
ORDER BY created_at ASC, id ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

`id` desempata senhas criadas no mesmo instante.

Não haverá prioridade na primeira versão.

---

# 36. Concorrência

Dois guichês podem pedir a próxima senha ao mesmo tempo.

Eles não podem receber o mesmo Ticket.

Exemplo esperado:

```text
Guichê 1 → Ticket A
Guichê 2 → Ticket B
```

Isso é tratado **no MVP** com transação e locking no PostgreSQL (seção 48.1):

Exemplo conceitual:

```sql
FOR UPDATE SKIP LOCKED
```

---

# 37. Idempotência

Idempotência é diferente de concorrência.

Exemplo:

```text
mesma request enviada duas vezes
```

A aplicação deve evitar executar a mesma ação duas vezes.

Concorrência:

```text
duas operações diferentes competindo pelo mesmo recurso
```

Idempotência:

```text
mesma operação repetida
```

---

# 38. TicketHistory

Registrar linha do tempo da senha.

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

---

# 39. AuditLog

AuditLog registra ações administrativas e operacionais relevantes.

Exemplos:

```text
Carlos removeu Gabriel do Guichê 3

ADMIN excluiu Departamento Engenharia

OWNER alterou a role de um usuário
```

`TicketHistory` e `AuditLog` possuem responsabilidades diferentes.

---

# 40. PublicDevice

Totens e TVs são dispositivos públicos registrados.

Eles não utilizam credencial de usuários humanos.

Tipos iniciais:

```text
TICKET_GENERATOR
QUEUE_DISPLAY
```

---

# 41. TICKET_GENERATOR

Responsável por gerar senhas.

Pode:

```text
listar departamentos autorizados
gerar Ticket
```

Não possui acesso administrativo.

---

# 42. QUEUE_DISPLAY

Responsável por exibir senhas chamadas.

Pode:

```text
visualizar chamadas
receber atualizações em tempo real
```

Não deve gerar senha ou administrar recursos.

No MVP, o painel da TV é um navegador logado com um usuário VIEWER, consultando `GET /tickets/display` (seção 48.2). O dispositivo `QUEUE_DISPLAY` fica para o futuro.

---

# 43. Ativação de dispositivos

OWNER ou ADMIN cria um dispositivo:

```text
PublicDevice
status = PENDING_ACTIVATION
```

Depois gera código temporário.

Exemplo:

```text
K7P9-X2
```

O dispositivo acessa:

```text
/device/activate
```

Informa o código.

O backend:

```text
valida código
↓
identifica dispositivo
↓
gera credencial própria
↓
status = ACTIVE
```

---

# 44. Credencial do dispositivo

Dispositivo possui sua própria credencial.

Não utilizar JWT de OWNER, ADMIN, MANAGER ou ATTENDANT.

Fluxo:

```text
Device Credential
   ↓
PublicDevice
   ↓
Organization
   ↓
Type
   ↓
Status
   ↓
Departments
```

---

# 45. Revogação de dispositivo

OWNER ou ADMIN pode revogar:

```text
ACTIVE → REVOKED
```

Mesmo que o navegador ainda possua a credencial, o backend deve rejeitar operações se o dispositivo estiver revogado.

---

# 46. Escopo da primeira fase

A primeira fase deve implementar apenas a base necessária para validar o domínio e a arquitetura.

Ordem inicial:

```text
1. Estrutura base Fastify
2. PostgreSQL (docker compose) + Drizzle — schema completo, já com branches
3. criação de Organization (POST /organizations)        ← primeiro entregável
   Organization + License 30 dias + Branch "Matriz" + OWNER + Department padrão,
   tudo na mesma transação
4. JWT + authMiddleware + requireBranch
5. login (OWNER por email, funcionário por slug + username); token sempre com a Matriz; GET /auth/me
6. troca e redefinição de senha
7. criar/listar/editar/desativar Departments
8. criar/editar/desativar ServicePoint
9. associar ServicePoint ao Department
10. criar/listar/editar/desativar User (username gerado, email opcional, sempre na Matriz)
11. dar acesso do User ao Department
12. geração de senha no balcão (usuário logado): listar departamentos + gerar Ticket + cancelar
13. sessão no balcão (entrar, sair, liberar)
14. chamar senha: próxima (mais antiga) e específica (da lista), com concorrência
15. rechamar, finalizar, não compareceu, minhas últimas chamadas
16. painel da TV (usuário VIEWER)
```

---

# 47. Endpoints iniciais esperados

Conceitualmente:

```text
POST  /organizations
GET   /organizations/by-slug/:slug   nome da empresa na tela de login do funcionário
POST  /auth/login                 (OWNER: email | funcionário: organizationSlug + username)
GET   /auth/me                    usuário logado (mesmo formato do login, sem token)
PATCH /auth/password              { currentPassword, newPassword }

-- rotas de filial (request.user.branchId = Matriz na V1)
POST  /departments
GET   /departments
PATCH /departments/:id                           { name?, active? }
POST  /service-points
PATCH /service-points/:id                        { name?, active? }
GET   /departments/:departmentId/service-points
POST  /departments/:departmentId/service-points   { servicePointId }  associa guichê
POST  /users                                      cria usuário na filial do token
GET   /users                                      lista usuários (paginado)
PATCH /users/:userId                              { name?, role?, username?, active? }
POST  /users/:userId/departments                  { departmentId }    libera acesso
PATCH /users/:userId/password                     { newPassword }     redefine senha
GET   /tickets/departments
POST  /tickets
POST  /tickets/:id/cancel                        { reason? }

POST  /operator-sessions                         { servicePointId }  entra no balcão
POST  /operator-sessions/current/close                               sai do balcão
POST  /service-points/:id/release                                    libera balcão de outra pessoa

GET   /tickets/waiting                           senhas aguardando (lista)
POST  /tickets/call-next                         { departmentId?, confirmNoShowCurrent? }
POST  /tickets/:id/call                          { confirmNoShowCurrent? }
POST  /tickets/:id/recall
POST  /tickets/:id/finish
POST  /tickets/:id/no-show
GET   /tickets/my-calls
GET   /tickets/display                           painel da TV
```

Na V1, todo usuário de filial é criado na Matriz (a filial do token). Rotas de filiais (`/branches`, `POST /auth/branch`) ficam para a multi-filial.

## Endpoints de edição e listagem (fase 1)

```text
GET   /users                     lista usuários da organização (paginado)
PATCH /users/:userId             { name?, role?, username?, active? }
PATCH /departments/:id           { name?, active? }
PATCH /service-points/:id        { name?, active? }
```

Quem pode: OWNER e ADMIN.

Regras de `PATCH /users/:userId`:

- `role`: ADMIN só altera entre MANAGER, ATTENDANT e VIEWER, e só de usuários com essas roles; OWNER altera qualquer um, mas ninguém vira OWNER e a role do OWNER não muda;
- `username`: único na organização; já existente → `409 UsernameAlreadyExistsException`; ADMIN não altera o do OWNER;
- `active = false`: ninguém desativa a si mesmo nem o OWNER; ADMIN não desativa o OWNER;
- ao virar ADMIN, o usuário deixa de ter filial (`branch_id` nulo); ao deixar de ser ADMIN, recebe a filial do token (a Matriz, na V1) — exigido pelo CHECK do banco;
- usuário desativado é bloqueado na hora pelo `authMiddleware`.

Regras de `PATCH /departments/:id`:

- `prefix` **não** pode ser alterado; enviar `prefix` → `400` (schema Zod estrito);
- desativar/reativar não muda a contagem do limite (inativos já contam).

Regras de `PATCH /service-points/:id`:

- nome livre; desativar/reativar não muda a contagem do limite (inativos já contam).

Todos buscam o registro por `id` **e** pela organização/filial do token; registro de outra organização/filial → `404`.

Excluir e restaurar (`DELETE`, `POST /:id/restore`) ficam para a fase 2.

Os nomes exatos podem ser ajustados durante implementação.

---

# 48. Endpoint inicial de Ticket

## Cenário da V1: balcão com atendente

Não existe totem na V1. A senha é gerada por uma atendente no balcão, logada no sistema:

```text
cliente chega ao balcão
↓
atendente (logada) escolhe o departamento
↓
sistema gera a senha
↓
atendente informa/entrega a senha ao cliente
```

Gerar senha **não é público**. Exige usuário autenticado, com filial (a do balcão).

Quem pode gerar:

- qualquer usuário autenticado da organização, exceto VIEWER (somente leitura);
- não depende de `user_department_access`: a atendente do balcão gera senha para **qualquer departamento ativo da filial**.

`user_department_access` serve apenas para o lado operacional (quais departamentos o atendente pode visualizar/atender).

O totem (`TICKET_GENERATOR`, com credencial própria de dispositivo) fica para o futuro.

## Tela de geração

```text
GET  /tickets/departments
→ todos os departamentos ativos e não excluídos da filial do token
→ { id, name, prefix }
→ não filtra por user_department_access

POST /tickets
→ { departmentId }
```

```json
{
  "departmentId": "5b1c..."
}
```

## Fluxo

```text
authMiddleware
(usuário ativo, organização ativa, licença válida — seção 7)
↓
requireBranch (filial no token)
↓
role diferente de VIEWER
↓
receber departmentId
↓
buscar Department por id
E branch_id = request.user.branchId
E organization_id = request.user.organizationId
↓
validar Department ativo (active = true, deleted_at nulo)
↓
obter prefixo
↓
gerar código: prefixo + "-" + 7 caracteres aleatórios
↓
now = instante atual (relógio da aplicação)
↓
service_date = data de now em America/Sao_Paulo
created_at   = now
↓
criar Ticket WAITING
↓
registrar TicketHistory CREATED (actor_user_id = request.user.userId)
```

Regras:

- organização e filial vêm do token (`request.user.organizationId`, `request.user.branchId`), nunca do body;
- departamento de outra filial ou organização, inexistente, inativo ou excluído: `404 DepartmentNotFoundException`;
- VIEWER: `403 ForbiddenException`;
- licença inválida: barrada antes, no middleware (`403 LicenseInactiveException`);
- colisão de código no mesmo dia (`UNIQUE (branch_id, code, service_date)`): gerar novo código e tentar novamente;
- departamento sem nenhum guichê associado pode receber senhas normalmente.

Exemplo:

```text
Departamento:
Exames

Prefixo:
EX

Código:
EX-A7K92P1

Status:
WAITING
```

Response conceitual:

```json
{
  "id": "7e8...",
  "code": "EX-A7K92P1",
  "status": "WAITING",
  "serviceDate": "2026-03-09",
  "createdAt": "2026-03-10T02:30:00.000Z",
  "department": {
    "id": "5b1c...",
    "name": "Exames",
    "prefix": "EX"
  }
}
```

Esse response tem formato próprio (com `department` aninhado), seguindo a regra de que o DTO pertence ao endpoint que o devolve.

---

# 48.1 Atendimento no balcão (MVP)

Cenário de referência: uma filial com 3 departamentos (Técnico, Financeiro, Reparos) e um balcão com duas atendentes, cada uma no seu computador (cada computador = um `ServicePoint`: "Balcão 1", "Balcão 2").

## Sessão no balcão (OperatorSession)

Antes de chamar senhas, a atendente informa em qual balcão está.

```text
POST /operator-sessions                { servicePointId }   entra no balcão
POST /operator-sessions/current/close                       sai do balcão
POST /service-points/:id/release                            libera balcão ocupado por outra pessoa
```

Regras:

- qualquer role, exceto VIEWER;
- guichê inexistente, de outra filial, inativo ou excluído → `404`;
- usuário já em outro balcão → `409 UserAlreadyInSessionException`;
- balcão já ocupado → `409 ServicePointAlreadyOccupiedException`;
- sair do balcão com uma senha em atendimento → `409 CurrentTicketInServiceException` (finalize, marque não compareceu ou cancele antes);
- sair: `CLOSED`, `end_reason = USER_LEFT`, `ended_by_user_id` = o próprio usuário;
- liberar balcão de outra pessoa: qualquer usuário da filial, exceto VIEWER; `end_reason = FORCED_BY_USER`; gera `AuditLog` ("Carlos liberou o Balcão 1, ocupado por Gabriel");
- liberação forçada de um balcão que tem senha em atendimento: essa senha vira `NO_SHOW` (evento `NO_SHOW` com `metadata` indicando a liberação forçada), na mesma transação que encerra a sessão;
- desativar um usuário encerra a sessão dele (`ADMIN_ACTION`).

## Quais senhas a atendente pode chamar

A atendente atende os departamentos liberados para ela (`user_department_access`):

```text
OWNER, ADMIN                → todos os departamentos ativos da filial
MANAGER, ATTENDANT          → apenas os departamentos liberados
VIEWER                      → não chama senhas
```

Se as duas atendentes tiverem acesso aos 3 departamentos, as duas chamam da fila conjunta dos 3, sempre pela regra da senha mais antiga.

## Duas formas de chamar

**1. Chamar a próxima** — o sistema escolhe a senha mais antiga:

```text
POST /tickets/call-next                { departmentId?, confirmNoShowCurrent? }
```

- busca a senha `WAITING` mais antiga, do dia, entre os departamentos que a atendente pode atender (ou só do `departmentId` informado, se ela tiver acesso a ele);
- `ORDER BY created_at, id` com `FOR UPDATE SKIP LOCKED`: duas atendentes clicando ao mesmo tempo recebem senhas diferentes;
- nenhuma senha esperando → `404 NoTicketWaitingException`.

**2. Chamar uma senha específica da lista** — a atendente vê a lista de senhas aguardando e clica em uma:

```text
GET  /tickets/waiting                  { departmentId? }    lista de senhas WAITING do dia (paginada)
POST /tickets/:id/call                 { confirmNoShowCurrent? }
```

- a lista mostra apenas senhas do dia, dos departamentos que a atendente pode atender, ordenadas por `created_at`;
- a chamada só acontece se a senha ainda estiver `WAITING` (atualização condicional); se outra atendente chamou antes, ou ela foi cancelada → `409 TicketNotWaitingException`;
- senha de departamento sem acesso → `404`.

Regras comuns às duas formas:

- exige sessão ativa no balcão → senão `409 OperatorSessionRequiredException`;
- a atendente tem no máximo **uma** senha em atendimento;
- se já houver uma senha em atendimento e `confirmNoShowCurrent` não for `true` → `409 CurrentTicketInServiceException` (com a senha atual em `meta`); o frontend pergunta "A senha atual ainda não foi atendida. Deseja chamar outra?";
- com `confirmNoShowCurrent = true`: senha atual → `NO_SHOW` (+ evento), nova senha → `IN_SERVICE`;
- ao chamar: `status = IN_SERVICE`, `called_at = agora`, `service_point_id` e `operator_session_id` preenchidos, evento `CALLED` com `actor_user_id`;
- a exigência de confirmação também protege contra clique duplo: o segundo clique recebe `409` em vez de marcar a senha recém-chamada como não compareceu.

## Ações sobre a senha em atendimento

```text
POST /tickets/:id/recall     rechamar      (status continua IN_SERVICE, evento RECALLED)
POST /tickets/:id/finish     finalizar     (IN_SERVICE → FINISHED, finished_at)
POST /tickets/:id/no-show    não compareceu (IN_SERVICE → NO_SHOW)
```

- só a senha em atendimento **da própria sessão** da atendente; outra senha → `404`;
- status diferente do esperado → `409 InvalidTicketStatusException`;
- cada ação registra o evento no `TicketHistory`.

## Cancelar

```text
POST /tickets/:id/cancel     { reason? }
```

- qualquer role, exceto VIEWER; qualquer departamento ativo da filial (mesma regra da geração no balcão);
- `WAITING → CANCELLED` ou `IN_SERVICE → CANCELLED`; outros status → `409 InvalidTicketStatusException`;
- `reason` opcional, gravado em `cancel_reason`; evento `CANCELLED` com o motivo em `metadata`.

## Últimas chamadas da atendente

```text
GET /tickets/my-calls        últimas 10 senhas chamadas pelo usuário no dia, com status atual
```

Base da lista de "rechamar" da tela da atendente.

---

# 48.2 Painel da TV (MVP)

O monitor do salão abre o navegador logado com um usuário **VIEWER** (somente leitura). No MVP não há dispositivo `QUEUE_DISPLAY`, credencial de dispositivo nem WebSocket.

```text
GET /tickets/display
→ {
    current: { code, departmentName, servicePointName, calledAt },   // última chamada ou rechamada
    recent:  [ ...últimas 5 senhas chamadas, sem repetir a atual ]
  }
```

Regras:

- dados apenas do dia e da filial do token;
- respeita os departamentos do usuário: para a TV mostrar tudo, o usuário VIEWER da TV recebe acesso aos 3 departamentos;
- "atual" = evento `CALLED` ou `RECALLED` mais recente; uma rechamada volta a aparecer como atual;
- `current = null` quando nada foi chamado no dia;
- o frontend decide de quanto em quanto tempo consulta (ex.: a cada 3 segundos) e cuida de som/voz;
- atraso máximo = intervalo de consulta do frontend; aceitável para sala de espera.

Futuro: dispositivo `QUEUE_DISPLAY` com credencial própria e atualização em tempo real (seção 42).

---

# 49. O que não implementar agora

Não implementar na primeira fase:

```text
idempotência completa (no MVP, a confirmação de "não compareceu" já evita clique duplo)
WebSocket / tempo real
Totem (TICKET_GENERATOR)
dispositivo QUEUE_DISPLAY (no MVP a TV usa um usuário VIEWER)
audit logs completos (no MVP, apenas a liberação forçada de balcão)
expiração automática no fim do dia (as consultas já filtram pelo dia)
exclusão e restauração (regra já definida na seção 16.1)
regras avançadas de licença
criar/editar/listar filiais (POST/GET /branches)
seleção de filial (POST /auth/branch) e X-Expected-Branch-Id
transferência de usuário entre filiais
uso da role BRANCH_ADMIN
usuário de filial com acesso a várias filiais
ADMIN regional (apenas filiais escolhidas)
fuso horário por filial
verificação de e-mail do OWNER (mapeada na seção 9)
cancelamento de senhas ao desativar/excluir departamento (seção 31)
pagamentos
prioridades
roteamento automático
```

Essas funcionalidades serão implementadas depois que o núcleo estiver estável.

---

# 50. Princípio de desenvolvimento

O projeto deve crescer em etapas.

Primeiro:

```text
Organization
↓
Branch
↓
Auth
↓
Department
↓
ServicePoint
↓
User
↓
Ticket generation
↓
OperatorSession
↓
Queue processing + concurrency
↓
Painel (VIEWER + polling)
```

Depois:

```text
Realtime
↓
Public devices (totem, TV)
↓
Multi-filial
```

O objetivo é validar cada camada antes de adicionar complexidade.

---

# 51. Referência complementar

Este documento explica:

```text
o que estamos construindo
```

Para regras de:

```text
arquitetura de código
nomenclatura
types
requests
responses
paginação
errors
Zod
AppError
estrutura de módulos
regras para IA
```

consultar:

```text
queue-system-guidelines.md
```

Os dois documentos devem ser considerados juntos durante o desenvolvimento.
