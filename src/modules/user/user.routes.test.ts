import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, db, resetDatabase } from '../../../test/helpers.js';
import { bearer, createOrganizationWithOwner, createUserAndLogin } from '../../../test/fixtures.js';
import { verifyPassword } from '../../shared/auth/password.js';
import { userDepartmentAccess, users } from '../../shared/database/schema/index.js';

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(resetDatabase);

async function setup() {
  const org = await createOrganizationWithOwner(app);
  const base = {
    organizationId: org.organization.id,
    organizationSlug: org.organization.slug,
    branchId: org.branch.id,
  };
  const admin = await createUserAndLogin(app, { ...base, role: 'ADMIN', username: 'admin.0001' });
  const attendant = await createUserAndLogin(app, {
    ...base,
    role: 'ATTENDANT',
    username: 'gabriel.4821',
  });
  return { ...org, admin, attendant };
}

const newUser = {
  name: 'Ana Paula',
  role: 'ATTENDANT',
  password: 'senha-da-ana',
};

function createUser(token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/users', headers: bearer(token), payload });
}

function updateUser(token: string, userId: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'PATCH',
    url: `/users/${userId}`,
    headers: bearer(token),
    payload,
  });
}

function grant(token: string, userId: string, departmentId: string) {
  return app.inject({
    method: 'POST',
    url: `/users/${userId}/departments`,
    headers: bearer(token),
    payload: { departmentId },
  });
}

describe('POST /users', () => {
  it('cria atendente na filial com username gerado e senha com hash', async () => {
    const s = await setup();

    const response = await createUser(s.ownerToken, newUser);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: 'Ana Paula',
      username: expect.stringMatching(/^ana\.\d{4}$/),
      email: null,
      role: 'ATTENDANT',
      active: true,
      branchId: s.branch.id,
    });
    const [row] = await db.select().from(users).where(eq(users.id, body.id));
    expect(await verifyPassword(row!.passwordHash, 'senha-da-ana')).toBe(true);
  });

  it('o novo usuário consegue fazer login pelo slug', async () => {
    const s = await setup();
    const created = await createUser(s.ownerToken, { ...newUser, username: 'ana.paula' });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        organizationSlug: s.organization.slug,
        username: created.json().username,
        password: 'senha-da-ana',
      },
    });

    expect(login.statusCode).toBe(200);
  });

  it('ADMIN fica sem filial', async () => {
    const s = await setup();

    const response = await createUser(s.ownerToken, { ...newUser, role: 'ADMIN' });

    expect(response.statusCode).toBe(201);
    expect(response.json().branchId).toBeNull();
  });

  it('normaliza username e e-mail informados', async () => {
    const s = await setup();

    const response = await createUser(s.ownerToken, {
      ...newUser,
      username: ' Ana.Paula ',
      email: ' ANA@Example.com ',
    });

    expect(response.json()).toMatchObject({ username: 'ana.paula', email: 'ana@example.com' });
  });

  it.each([['username repetido', { username: 'gabriel.4821' }, 'UsernameAlreadyExistsException']])(
    'recusa %s',
    async (_case, extra, exception) => {
      const s = await setup();

      const response = await createUser(s.ownerToken, { ...newUser, ...extra });

      expect(response.statusCode).toBe(409);
      expect(response.json().exception).toBe(exception);
    },
  );

  it('recusa e-mail repetido na organização', async () => {
    const s = await setup();
    await createUser(s.ownerToken, { ...newUser, email: 'ana@example.com' });

    const response = await createUser(s.ownerToken, { ...newUser, email: 'ana@example.com' });

    expect(response.statusCode).toBe(409);
    expect(response.json().exception).toBe('UserEmailAlreadyExistsException');
  });

  it('oferece restaurar quando o username é de um usuário excluído', async () => {
    const s = await setup();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, s.attendant.id));

    const response = await createUser(s.ownerToken, { ...newUser, username: 'gabriel.4821' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      exception: 'DeletedUserExistsException',
      meta: { deletedId: s.attendant.id },
    });
  });

  it('permite o mesmo username em outra organização', async () => {
    await setup();
    const other = await createOrganizationWithOwner(app, '2');

    const response = await createUser(other.ownerToken, { ...newUser, username: 'gabriel.4821' });

    expect(response.statusCode).toBe(201);
  });

  it.each(['OWNER', 'BRANCH_ADMIN', 'CHEFE'])('recusa a role %s', async (role) => {
    const s = await setup();

    const response = await createUser(s.ownerToken, { ...newUser, role });

    expect(response.statusCode).toBe(400);
  });

  it('ADMIN cria atendente, mas não cria outro ADMIN', async () => {
    const s = await setup();

    expect((await createUser(s.admin.token, newUser)).statusCode).toBe(201);
    expect((await createUser(s.admin.token, { ...newUser, role: 'ADMIN' })).statusCode).toBe(403);
  });

  it('atendente não cria usuários', async () => {
    const s = await setup();

    expect((await createUser(s.attendant.token, newUser)).statusCode).toBe(403);
  });

  it('valida a senha', async () => {
    const s = await setup();

    const response = await createUser(s.ownerToken, { ...newUser, password: 'curta' });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors[0].field).toBe('password');
  });
});

describe('GET /users', () => {
  it('lista os usuários da organização (sem excluídos), ordenados por nome', async () => {
    const s = await setup();
    await createUser(s.ownerToken, newUser);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, s.attendant.id));
    await createOrganizationWithOwner(app, '2');

    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: bearer(s.ownerToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((u: { name: string }) => u.name)).toEqual([
      'admin.0001',
      'Ana Paula',
      'Carlos Sousa',
    ]);
    expect(response.json().totalItems).toBe(3);
  });

  it('atendente não lista usuários', async () => {
    const s = await setup();

    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: bearer(s.attendant.token),
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('PATCH /users/:userId', () => {
  it('altera nome, role e username', async () => {
    const s = await setup();

    const response = await updateUser(s.ownerToken, s.attendant.id, {
      name: 'Gabriel S.',
      role: 'MANAGER',
      username: 'gabriel.silva',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Gabriel S.',
      role: 'MANAGER',
      username: 'gabriel.silva',
    });
  });

  it('desativar bloqueia o usuário na hora', async () => {
    const s = await setup();

    await updateUser(s.ownerToken, s.attendant.id, { active: false });

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: bearer(s.attendant.token),
    });
    expect(me.statusCode).toBe(403);
  });

  it('promover a ADMIN remove a filial; rebaixar devolve a filial do token', async () => {
    const s = await setup();

    const promoted = await updateUser(s.ownerToken, s.attendant.id, { role: 'ADMIN' });
    expect(promoted.json()).toMatchObject({ role: 'ADMIN', branchId: null });

    const demoted = await updateUser(s.ownerToken, s.attendant.id, { role: 'VIEWER' });
    expect(demoted.json()).toMatchObject({ role: 'VIEWER', branchId: s.branch.id });
  });

  it('a role do OWNER não muda', async () => {
    const s = await setup();

    const response = await updateUser(s.ownerToken, s.owner.id, { role: 'ADMIN' });

    expect(response.statusCode).toBe(403);
  });

  it('ninguém desativa a si mesmo nem o OWNER', async () => {
    const s = await setup();

    expect((await updateUser(s.ownerToken, s.owner.id, { active: false })).statusCode).toBe(403);
    expect((await updateUser(s.admin.token, s.admin.id, { active: false })).statusCode).toBe(403);
  });

  it('ADMIN não altera o OWNER', async () => {
    const s = await setup();

    const response = await updateUser(s.admin.token, s.owner.id, { name: 'Outro nome' });

    expect(response.statusCode).toBe(403);
  });

  it('ADMIN não promove ninguém a ADMIN nem altera a role de outro ADMIN', async () => {
    const s = await setup();
    const otherAdmin = await createUser(s.ownerToken, { ...newUser, role: 'ADMIN' });

    expect((await updateUser(s.admin.token, s.attendant.id, { role: 'ADMIN' })).statusCode).toBe(
      403,
    );
    expect(
      (await updateUser(s.admin.token, otherAdmin.json().id, { role: 'MANAGER' })).statusCode,
    ).toBe(403);
    expect((await updateUser(s.admin.token, s.attendant.id, { role: 'MANAGER' })).statusCode).toBe(
      200,
    );
  });

  it('recusa username já usado', async () => {
    const s = await setup();

    const response = await updateUser(s.ownerToken, s.attendant.id, { username: 'admin.0001' });

    expect(response.statusCode).toBe(409);
    expect(response.json().exception).toBe('UsernameAlreadyExistsException');
  });

  it('não encontra usuário de outra organização', async () => {
    const s = await setup();
    const other = await createOrganizationWithOwner(app, '2');

    const response = await updateUser(s.ownerToken, other.owner.id, { name: 'X' });

    expect(response.statusCode).toBe(404);
  });

  it('exige ao menos um campo', async () => {
    const s = await setup();

    expect((await updateUser(s.ownerToken, s.attendant.id, {})).statusCode).toBe(400);
  });
});

describe('POST /users/:userId/departments', () => {
  async function withDepartment() {
    const s = await setup();
    const department = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(s.ownerToken),
      payload: { name: 'Técnico', prefix: 'TEC' },
    });
    return { ...s, departmentId: department.json().id as string };
  }

  it('libera o departamento para o atendente', async () => {
    const s = await withDepartment();

    const response = await grant(s.ownerToken, s.attendant.id, s.departmentId);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      userId: s.attendant.id,
      department: { id: s.departmentId, name: 'Técnico', prefix: 'TEC' },
    });
    const list = await app.inject({
      method: 'GET',
      url: '/departments',
      headers: bearer(s.attendant.token),
    });
    expect(list.json().data.map((d: { prefix: string }) => d.prefix)).toEqual(['TEC']);
  });

  it('recusa acesso repetido', async () => {
    const s = await withDepartment();
    await grant(s.ownerToken, s.attendant.id, s.departmentId);

    const response = await grant(s.ownerToken, s.attendant.id, s.departmentId);

    expect(response.statusCode).toBe(409);
    expect(response.json().exception).toBe('UserDepartmentAccessAlreadyExistsException');
  });

  it('OWNER e ADMIN não precisam de acesso a departamentos', async () => {
    const s = await withDepartment();

    const response = await grant(s.ownerToken, s.admin.id, s.departmentId);

    expect(response.statusCode).toBe(400);
    expect(response.json().exception).toBe('OrganizationUserDepartmentAccessException');
  });

  it('não libera departamento de outra organização', async () => {
    const s = await withDepartment();
    const other = await createOrganizationWithOwner(app, '2');
    const foreign = await app.inject({
      method: 'POST',
      url: '/departments',
      headers: bearer(other.ownerToken),
      payload: { name: 'Outro', prefix: 'OUT' },
    });

    const response = await grant(s.ownerToken, s.attendant.id, foreign.json().id);

    expect(response.statusCode).toBe(404);
    expect(response.json().exception).toBe('DepartmentNotFoundException');
    expect(await db.select().from(userDepartmentAccess)).toHaveLength(0);
  });

  it('atendente não libera acessos', async () => {
    const s = await withDepartment();

    expect((await grant(s.attendant.token, s.attendant.id, s.departmentId)).statusCode).toBe(403);
  });
});
