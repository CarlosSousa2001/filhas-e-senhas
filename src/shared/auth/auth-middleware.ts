import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { ForbiddenException, UnauthorizedException } from '../errors/common-exceptions.js';
import type { UserRole } from '../types/user-role.js';
import {
  BranchInactiveException,
  BranchNotSelectedException,
  LicenseInactiveException,
  OrganizationInactiveException,
  UserInactiveException,
} from './auth.errors.js';
import { authContextRepository } from './auth-context.repository.js';
import type { DecodedJwt } from './jwt.js';

type AuthenticateOptions = {
  /** Usado apenas por rotas que precisam responder mesmo com a licença vencida (ex.: GET /auth/me). */
  allowInvalidLicense?: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyToken(request: FastifyRequest): Promise<DecodedJwt> {
  try {
    const decoded = await request.jwtVerify<DecodedJwt>();
    if (!UUID_PATTERN.test(decoded.userId) || typeof decoded.iat !== 'number') {
      throw new Error('Payload inválido');
    }
    return decoded;
  } catch {
    // Token ausente, malformado, com assinatura inválida ou expirado: nunca revelar o motivo.
    throw new UnauthorizedException();
  }
}

/**
 * Valida o token e carrega o usuário do banco a cada requisição (seção 7 do contexto).
 * Preenche `request.user` com a organização e a filial do token e a role atual do banco.
 */
export function authenticate(options: AuthenticateOptions = {}): preHandlerAsyncHookHandler {
  return async function authMiddleware(request) {
    const token = await verifyToken(request);

    const context = await authContextRepository.findByUserId(token.userId);
    if (!context || context.user.organizationId !== token.organizationId) {
      throw new UnauthorizedException();
    }
    const { user, organization, license } = context;

    // Troca/redefinição de senha invalida os tokens emitidos antes dela.
    if (Math.floor(user.passwordChangedAt.getTime() / 1000) > token.iat) {
      throw new UnauthorizedException();
    }

    if (!user.active || user.deletedAt !== null) {
      throw new UserInactiveException();
    }

    if (!organization.active || organization.deletedAt !== null) {
      throw new OrganizationInactiveException();
    }

    const licenseValid =
      license !== null && license.status === 'ACTIVE' && license.expiresAt.getTime() > Date.now();
    if (!licenseValid && !options.allowInvalidLicense) {
      throw new LicenseInactiveException();
    }

    // Usuário de filial: o token precisa ser da filial atual dele (transferência invalida o token).
    if (user.branchId !== null && token.branchId !== user.branchId) {
      throw new UnauthorizedException();
    }

    if (token.branchId !== null) {
      const branch = await authContextRepository.findBranchById(token.branchId);
      if (!branch || branch.organizationId !== token.organizationId) {
        throw new UnauthorizedException();
      }
      if (!branch.active || branch.deletedAt !== null) {
        throw new BranchInactiveException();
      }
    }

    request.user = {
      userId: user.id,
      organizationId: user.organizationId,
      branchId: token.branchId,
      role: user.role,
    };
  };
}

/** Middleware padrão das rotas autenticadas. */
export const authMiddleware = authenticate();

/** Rotas de filial: exigem filial no token (na V1, sempre a Matriz). */
export const requireBranch: preHandlerAsyncHookHandler = async (request) => {
  if (request.user.branchId === null) {
    throw new BranchNotSelectedException();
  }
};

/** Permite a rota apenas para as roles informadas (role atual do banco). */
export function requireRole(...roles: UserRole[]): preHandlerAsyncHookHandler {
  return async (request) => {
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException();
    }
  };
}
