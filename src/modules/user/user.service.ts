import { branchIdOf } from '../../shared/auth/auth-middleware.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import { hashPassword } from '../../shared/auth/password.js';
import { MAX_GENERATED_VALUE_ATTEMPTS } from '../../shared/constants/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import { ForbiddenException } from '../../shared/errors/common-exceptions.js';
import type { PaginationQuery } from '../../shared/http/pagination.js';
import type { UserRole } from '../../shared/types/user-role.js';
import { generateUsername } from '../../shared/utils/username.js';
import { DepartmentNotFoundException } from '../department/department.errors.js';
import {
  DeletedUserExistsException,
  OrganizationUserDepartmentAccessException,
  UserDepartmentAccessAlreadyExistsException,
  UserEmailAlreadyExistsException,
  UserNotFoundException,
  UsernameAlreadyExistsException,
} from './user.errors.js';
import { userRepository } from './user.repository.js';
import type { User, UserCreateRequest, UserUpdateRequest } from './user.types.js';

/** Roles que o ADMIN pode criar e entre as quais pode alterar (seção 12 do contexto). */
const OPERATIONAL_ROLES: readonly UserRole[] = ['MANAGER', 'ATTENDANT', 'VIEWER'];

const USERNAME_CONSTRAINT = 'uq_users_organization_username';
const EMAIL_CONSTRAINT = 'uq_users_organization_email';

async function throwUsernameConflict(organizationId: string, username: string): Promise<void> {
  const existing = await userRepository.findByUsernameIncludingDeleted(organizationId, username);
  if (existing?.deletedAt) throw new DeletedUserExistsException(existing.id);
  if (existing) throw new UsernameAlreadyExistsException();
}

async function throwEmailConflict(organizationId: string, email: string): Promise<void> {
  const existing = await userRepository.findByEmailIncludingDeleted(organizationId, email);
  if (existing?.deletedAt) throw new DeletedUserExistsException(existing.id);
  if (existing) throw new UserEmailAlreadyExistsException();
}

/** Gera um username livre na organização (inclusive entre excluídos); 6 dígitos se 4 não bastarem. */
async function generateAvailableUsername(organizationId: string, name: string): Promise<string> {
  for (const digits of [4, 6]) {
    for (let attempt = 0; attempt < MAX_GENERATED_VALUE_ATTEMPTS; attempt++) {
      const username = generateUsername(name, digits);
      if (!(await userRepository.findByUsernameIncludingDeleted(organizationId, username))) {
        return username;
      }
    }
  }
  throw new UsernameAlreadyExistsException();
}

function assertCanAssignRole(actor: AuthenticatedUser, role: UserRole): void {
  // Ninguém cria ou promove alguém ao próprio nível ou acima.
  if (actor.role === 'ADMIN' && !OPERATIONAL_ROLES.includes(role)) {
    throw new ForbiddenException();
  }
}

async function findTarget(actor: AuthenticatedUser, userId: string): Promise<User> {
  const target = await userRepository.findInOrganization(actor.organizationId, userId);
  if (!target) {
    throw new UserNotFoundException();
  }
  return target;
}

export async function createUser(actor: AuthenticatedUser, data: UserCreateRequest): Promise<User> {
  assertCanAssignRole(actor, data.role);

  const organizationId = actor.organizationId;
  // OWNER e ADMIN são da organização; as demais roles nascem na filial do token.
  const branchId = data.role === 'ADMIN' ? null : branchIdOf(actor);

  if (data.username !== undefined) await throwUsernameConflict(organizationId, data.username);
  if (data.email !== undefined) await throwEmailConflict(organizationId, data.email);

  const passwordHash = await hashPassword(data.password);

  for (let attempt = 0; attempt < MAX_GENERATED_VALUE_ATTEMPTS; attempt++) {
    const username = data.username ?? (await generateAvailableUsername(organizationId, data.name));
    try {
      return await userRepository.create({
        organizationId,
        branchId,
        name: data.name,
        username,
        email: data.email ?? null,
        role: data.role,
        passwordHash,
      });
    } catch (error) {
      const constraint = getUniqueViolationConstraint(error);
      if (constraint === EMAIL_CONSTRAINT && data.email !== undefined) {
        await throwEmailConflict(organizationId, data.email);
      }
      if (constraint === USERNAME_CONSTRAINT) {
        // Username informado: conflito real. Gerado: colisão por concorrência, tenta outro.
        if (data.username !== undefined) await throwUsernameConflict(organizationId, username);
        continue;
      }
      throw error;
    }
  }
  throw new UsernameAlreadyExistsException();
}

export async function listUsers(actor: AuthenticatedUser, pagination: PaginationQuery) {
  return userRepository.listInOrganization(actor.organizationId, pagination);
}

export async function updateUser(
  actor: AuthenticatedUser,
  userId: string,
  changes: UserUpdateRequest,
): Promise<User> {
  const target = await findTarget(actor, userId);

  // ADMIN não altera o OWNER.
  if (target.role === 'OWNER' && actor.role !== 'OWNER') {
    throw new ForbiddenException();
  }

  const roleChanged = changes.role !== undefined && changes.role !== target.role;
  if (roleChanged) {
    // A role do OWNER nunca muda; ninguém vira OWNER (o schema não aceita OWNER).
    if (target.role === 'OWNER') throw new ForbiddenException();
    // ADMIN só altera entre MANAGER, ATTENDANT e VIEWER, e só de usuários com essas roles.
    if (actor.role === 'ADMIN' && !OPERATIONAL_ROLES.includes(target.role)) {
      throw new ForbiddenException();
    }
    assertCanAssignRole(actor, changes.role!);
  }

  if (changes.active === false && (target.id === actor.userId || target.role === 'OWNER')) {
    // Ninguém desativa a si mesmo nem o OWNER.
    throw new ForbiddenException();
  }

  const usernameChanged = changes.username !== undefined && changes.username !== target.username;
  if (usernameChanged) await throwUsernameConflict(actor.organizationId, changes.username!);

  const newRole = changes.role ?? target.role;
  // CHECK do banco: ADMIN não tem filial; ao deixar de ser ADMIN recebe a filial do token.
  const branchId = newRole === 'ADMIN' ? null : (target.branchId ?? branchIdOf(actor));

  try {
    return await userRepository.update(target.id, {
      name: changes.name,
      username: usernameChanged ? changes.username : undefined,
      role: roleChanged ? changes.role : undefined,
      active: changes.active,
      branchId: roleChanged ? branchId : undefined,
    });
  } catch (error) {
    if (getUniqueViolationConstraint(error) === USERNAME_CONSTRAINT && usernameChanged) {
      await throwUsernameConflict(actor.organizationId, changes.username!);
    }
    throw error;
  }
}

/**
 * Libera o acesso de um usuário de filial a um departamento da mesma filial.
 * OWNER e ADMIN já veem todos os departamentos.
 */
export async function grantDepartmentAccess(
  actor: AuthenticatedUser,
  userId: string,
  departmentId: string,
) {
  const target = await findTarget(actor, userId);
  if (target.branchId === null) {
    throw new OrganizationUserDepartmentAccessException();
  }
  const department = await userRepository.findDepartmentInBranch(
    actor.organizationId,
    target.branchId,
    departmentId,
  );
  if (!department) {
    throw new DepartmentNotFoundException();
  }
  if (await userRepository.hasDepartmentAccess(target.id, department.id)) {
    throw new UserDepartmentAccessAlreadyExistsException();
  }
  try {
    await userRepository.grantDepartmentAccess(target.id, department.id);
  } catch (error) {
    if (getUniqueViolationConstraint(error) !== undefined) {
      throw new UserDepartmentAccessAlreadyExistsException();
    }
    throw error;
  }
  return { userId: target.id, department };
}

/**
 * Redefinição de senha por OWNER/ADMIN (seção 5.6 do contexto).
 * OWNER redefine de qualquer usuário; ADMIN de qualquer um, exceto do OWNER.
 * Atualiza password_changed_at: as sessões do usuário são derrubadas.
 */
export async function resetUserPassword(
  actor: AuthenticatedUser,
  userId: string,
  newPassword: string,
): Promise<void> {
  const target = await findTarget(actor, userId);
  if (actor.role === 'ADMIN' && target.role === 'OWNER') {
    throw new ForbiddenException();
  }
  await userRepository.updatePassword(target.id, await hashPassword(newPassword), new Date());
}
