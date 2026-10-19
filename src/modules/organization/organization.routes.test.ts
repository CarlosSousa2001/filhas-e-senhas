import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { verifyPassword } from '../../shared/auth/password.js';
import {
  CURRENT_TERMS_VERSION,
  MAX_GENERATED_VALUE_ATTEMPTS,
} from '../../shared/constants/index.js';
import {
  organizations,
  licenses,
  branches,
  users,
  departments,
} from '../../shared/database/schema/index.js';
import type { ApiErrorResponse } from '../../shared/types/api-error-response.js';
import { organizationRepository } from './organization.repository.js';
import type { OrganizationResponse } from './organization.types.js';

const body = {
  organizationName: ' Clínica Sorriso ',
  document: '12.345.678/0001-90',
  ownerName: ' Camila Souza ',
  phone: '(11) 98765-4321',
  email: ' CAMILA@example.com ',
  password: ' senha123 ',
  passwordConfirmation: ' senha123 ',
  acceptedTerms: true,
};
let app: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(resetDatabase);
afterEach(() => {
  vi.restoreAllMocks();
});

function register(overrides: Record<string, unknown> = {}) {
  return app.inject({ method: 'POST', url: '/organizations', payload: { ...body, ...overrides } });
}

async function expectCounts(count: number) {
  for (const table of [organizations, licenses, branches, users, departments]) {
    expect(await db.select().from(table)).toHaveLength(count);
  }
}

it('cria as cinco entidades, normaliza os campos e retorna somente o contrato público', async () => {
  const before = Date.now();
  const response = await register();
  expect(response.statusCode).toBe(201);
  await expectCounts(1);
  const [organization] = await db.select().from(organizations);
  const [owner] = await db.select().from(users);
  const [branch] = await db.select().from(branches);
  const [license] = await db.select().from(licenses);
  const [department] = await db.select().from(departments);
  expect(organization).toMatchObject({
    name: 'Clínica Sorriso',
    slug: 'clinica-sorriso',
    document: '12345678000190',
    contactPhone: '11987654321',
    contactEmail: 'camila@example.com',
    termsVersion: CURRENT_TERMS_VERSION,
    active: true,
    deletedAt: null,
  });
  expect(organization!.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
  expect(organization!.termsAcceptedAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect(owner).toMatchObject({
    organizationId: organization!.id,
    branchId: null,
    name: 'Camila Souza',
    email: 'camila@example.com',
    role: 'OWNER',
    active: true,
    passwordChangedAt: organization!.termsAcceptedAt,
  });
  expect(owner!.username).toMatch(/^camila\.\d{4}$/);
  expect(owner!.passwordHash).toMatch(/^\$argon2id\$/);
  expect(await verifyPassword(owner!.passwordHash, body.password)).toBe(true);
  expect(await verifyPassword(owner!.passwordHash, 'incorreta')).toBe(false);
  expect(branch).toMatchObject({ organizationId: organization!.id, name: 'Matriz', active: true });
  expect(department).toMatchObject({
    organizationId: organization!.id,
    branchId: branch!.id,
    name: 'Atendimento',
    prefix: 'AT',
    active: true,
  });
  expect(license).toMatchObject({
    organizationId: organization!.id,
    status: 'ACTIVE',
    startedAt: organization!.termsAcceptedAt,
  });
  expect(license!.expiresAt.getTime() - license!.startedAt.getTime()).toBe(30 * 86_400_000);
  expect(response.json()).toEqual({
    organization: { id: organization!.id, name: organization!.name, slug: organization!.slug },
    owner: { id: owner!.id, name: owner!.name, email: owner!.email, username: owner!.username },
    branch: { id: branch!.id, name: 'Matriz' },
    license: { status: 'ACTIVE', expiresAt: license!.expiresAt.toISOString() },
  });
});

it('faz rollback de todas as entidades quando o último insert falha', async () => {
  await db.execute(
    sql`ALTER TABLE departments ADD CONSTRAINT test_registration_failure CHECK (name <> 'Atendimento')`,
  );
  try {
    const response = await register();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: 'Erro interno do servidor',
      statusCode: 500,
      exception: 'InternalServerError',
    });
    await expectCounts(0);
  } finally {
    await db.execute(sql`ALTER TABLE departments DROP CONSTRAINT test_registration_failure`);
  }
});

describe('validações', () => {
  it.each(Object.keys(body))('exige o campo %s', async (field) => {
    const payload: Record<string, unknown> = { ...body };
    delete payload[field];
    const response = await app.inject({ method: 'POST', url: '/organizations', payload });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorResponse>().errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    await expectCounts(0);
  });

  it.each([
    ['organizationName', ''],
    ['organizationName', '   '],
    ['organizationName', 'a'.repeat(151)],
    ['ownerName', ''],
    ['ownerName', '  '],
    ['ownerName', 'a'.repeat(151)],
    ['document', '123'],
    ['document', '1'.repeat(12)],
    ['document', '1'.repeat(15)],
    ['phone', '1'.repeat(9)],
    ['phone', '1'.repeat(12)],
    ['phone', 'abc'],
    ['email', 'inválido'],
    ['email', `${'a'.repeat(190)}@example.com`],
    ['password', '1'.repeat(7)],
    ['password', '1'.repeat(129)],
    ['passwordConfirmation', 'outrasenha'],
    ['acceptedTerms', false],
    ['acceptedTerms', 'true'],
    ...Object.keys(body).map((field): [string, null] => [field, null]),
  ])('rejeita %s inválido (%s)', async (field, value) => {
    const response = await register({ [field as string]: value });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorResponse>().exception).toBe('ValidationException');
    expect(response.json<ApiErrorResponse>().errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    await expectCounts(0);
  });

  it('retorna as mensagens exatas para confirmação e termos', async () => {
    const response = await register({ passwordConfirmation: 'outrasenha', acceptedTerms: false });
    expect(response.json<ApiErrorResponse>().errors).toContainEqual({
      field: 'acceptedTerms',
      message: 'É necessário aceitar os termos de uso',
    });
    const mismatch = await register({ passwordConfirmation: 'outrasenha' });
    expect(mismatch.json<ApiErrorResponse>().errors).toContainEqual({
      field: 'passwordConfirmation',
      message: 'As senhas não conferem',
    });
  });

  it.each(['slug', 'organizationId', 'branchId', 'owner'])(
    'rejeita campo extra %s',
    async (field) => {
      expect((await register({ [field]: 'indevido' })).statusCode).toBe(400);
    },
  );

  it.each([8, 128])('aceita senha com %i caracteres, CPF e telefone fixo', async (length) => {
    expect(
      (
        await register({
          password: 'a'.repeat(length),
          passwordConfirmation: 'a'.repeat(length),
          document: '123.456.789-01',
          phone: '1133334444',
        })
      ).statusCode,
    ).toBe(201);
  });
});

it.each([false, true])('impede documento e e-mail repetidos (excluídos: %s)', async (deleted) => {
  expect((await register()).statusCode).toBe(201);
  if (deleted) {
    await db.update(organizations).set({ deletedAt: new Date() });
    await db.update(users).set({ deletedAt: new Date() });
  }
  const document = await register({ email: 'outra@example.com', document: '12345678000190' });
  expect(document.statusCode).toBe(409);
  expect(document.json<ApiErrorResponse>().exception).toBe(
    'OrganizationDocumentAlreadyExistsException',
  );
  const email = await register({ document: '12345678901' });
  expect(email.statusCode).toBe(409);
  expect(email.json<ApiErrorResponse>().exception).toBe('OwnerEmailAlreadyExistsException');
  await expectCounts(1);
});

it.each(['document', 'email'])(
  'traduz a violação real de unicidade de %s após a pré-verificação',
  async (field) => {
    await register();
    vi.spyOn(organizationRepository, 'documentExistsIncludingDeleted').mockResolvedValue(false);
    vi.spyOn(organizationRepository, 'ownerEmailExistsIncludingDeleted').mockResolvedValue(false);
    const response = await register(
      field === 'document' ? { email: 'outra@example.com' } : { document: '12345678901' },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json<ApiErrorResponse>().exception).toBe(
      field === 'document'
        ? 'OrganizationDocumentAlreadyExistsException'
        : 'OwnerEmailAlreadyExistsException',
    );
    await expectCounts(1);
  },
);

it.each([false, true])('adiciona sufixo ao slug existente (excluído: %s)', async (deleted) => {
  const first = (await register()).json<OrganizationResponse>();
  if (deleted)
    await db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(eq(organizations.id, first.organization.id));
  const second = await register({ email: 'outra@example.com', document: '12345678901' });
  expect(second.statusCode).toBe(201);
  expect(second.json<OrganizationResponse>().organization.slug).toMatch(/^clinica-sorriso-\d{4}$/);
});

it.each([
  ['Login', /^login-\d{4}$/],
  ['AB', /^ab-\d{4}$/],
  ['!!!', /^organizacao$/],
  ['A'.repeat(150), /^a{60}$/],
])('gera slug para %s', async (name, expected) => {
  const response = await register({ organizationName: name });
  expect(response.statusCode).toBe(201);
  expect(response.json<OrganizationResponse>().organization.slug).toMatch(expected);
});

it('refaz a transação após colisão real em dois cadastros simultâneos', async () => {
  const original = organizationRepository.slugExistsIncludingDeleted;
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(organizationRepository, 'slugExistsIncludingDeleted').mockImplementation(
    async (slug) => {
      if (slug !== 'clinica-sorriso') return original(slug);
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
      return false;
    },
  );
  const create = vi.spyOn(organizationRepository, 'create');
  const responses = await Promise.all([
    register(),
    register({ email: 'outra@example.com', document: '12345678901' }),
  ]);
  expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
  const slugs = responses.map(
    (response) => response.json<OrganizationResponse>().organization.slug,
  );
  expect(new Set(slugs).size).toBe(2);
  expect(slugs).toContain('clinica-sorriso');
  expect(create).toHaveBeenCalledTimes(3);
  await expectCounts(2);
});

it('limita as tentativas quando todos os slugs estão ocupados', async () => {
  const lookup = vi
    .spyOn(organizationRepository, 'slugExistsIncludingDeleted')
    .mockResolvedValue(true);
  expect((await register()).statusCode).toBe(409);
  expect(lookup).toHaveBeenCalledTimes(MAX_GENERATED_VALUE_ATTEMPTS + 1);
  await expectCounts(0);
});

it('publica request e respostas no OpenAPI usado pelo Scalar', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
  expect(response.statusCode).toBe(200);
  const operation = response.json().paths['/organizations'].post;
  expect(operation.tags).toEqual(['Organizations']);
  expect(operation.summary).toBe('Cadastrar organização');
  expect(operation.requestBody.content['application/json'].schema.required).toEqual(
    expect.arrayContaining(Object.keys(body)),
  );
  expect(operation.requestBody.content['application/json'].schema.additionalProperties).toBe(false);
  expect(Object.keys(operation.responses)).toEqual(['201', '400', '409', '429']);
  for (const status of ['400', '409']) {
    expect(
      operation.responses[status].content['application/json'].schema.properties,
    ).toHaveProperty('exception');
  }
  const docs = await app.inject({ method: 'GET', url: '/docs' });
  expect(docs.statusCode).toBe(301);
  expect((await app.inject({ method: 'GET', url: docs.headers.location! })).statusCode).toBe(200);
});
