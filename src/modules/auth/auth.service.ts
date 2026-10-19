import { verifyPassword } from '../../shared/auth/password.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import {
  InternalServerError,
  UnauthorizedException,
} from '../../shared/errors/common-exceptions.js';
import {
  BranchInactiveException,
  OrganizationInactiveException,
  UserInactiveException,
} from '../../shared/auth/auth.errors.js';
import { InvalidCredentialsException } from './auth.errors.js';
import { authRepository } from './auth.repository.js';
import type { Auth, AuthLoginRequest, AuthMe, AuthOrganization, AuthUser } from './auth.types.js';

// Mesmo Argon2id e custo usados por hashPassword; não pertence a uma conta.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$9PCtA79U0o0l8qRrEFA2VQ$xv+z4DIAWOU5xCO9RTDd2R19a1M1unzYJRWwkW5zR0c';

export async function login(data: AuthLoginRequest): Promise<Auth> {
  let user: AuthUser | null;
  let organization: AuthOrganization | null;
  if ('email' in data) {
    user = await authRepository.findOwnerByEmailIncludingDeleted(data.email);
    organization = user
      ? await authRepository.findOrganizationByIdIncludingDeleted(user.organizationId)
      : null;
  } else {
    organization = await authRepository.findOrganizationBySlugIncludingDeleted(
      data.organizationSlug,
    );
    user = organization
      ? await authRepository.findUserIncludingDeleted(organization.id, data.username)
      : null;
  }
  const validPassword = await verifyPassword(
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    data.password,
  );
  if (!user || !organization || !validPassword) throw new InvalidCredentialsException();
  if (!user.active || user.deletedAt) throw new UserInactiveException();
  if (!organization.active || organization.deletedAt) throw new OrganizationInactiveException();

  const branch = await authRepository.findLoginBranch(organization.id, user.branchId);
  if (!branch) throw new BranchInactiveException();
  const license = await authRepository.findLicense(organization.id);
  if (!license) throw new InternalServerError();
  return {
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    branch,
    license: {
      ...license,
      valid: license.status === 'ACTIVE' && license.expiresAt.getTime() > Date.now(),
    },
  };
}

/**
 * Dados do usuário logado (GET /auth/me). O authMiddleware já validou usuário,
 * organização e filial; a licença é devolvida mesmo inválida, para o frontend avisar.
 */
export async function getCurrentUser(authUser: AuthenticatedUser): Promise<AuthMe> {
  const [user, organization, license, branch] = await Promise.all([
    authRepository.findUserById(authUser.userId),
    authRepository.findOrganizationByIdIncludingDeleted(authUser.organizationId),
    authRepository.findLicense(authUser.organizationId),
    authUser.branchId === null ? null : authRepository.findBranchById(authUser.branchId),
  ]);
  if (!user || !organization) throw new UnauthorizedException();
  if (!license) throw new InternalServerError();
  return {
    user,
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    branch,
    license: {
      ...license,
      valid: license.status === 'ACTIVE' && license.expiresAt.getTime() > Date.now(),
    },
  };
}
