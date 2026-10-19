import type { UserRole } from '../types/user-role.js';

/** Conteúdo assinado no token (seção 5.5 do contexto). */
export type JwtPayload = {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
};

/**
 * Payload efetivamente assinado: inclui `iatMs`, o instante de emissão em milissegundos.
 * O `iat` padrão do JWT tem precisão de segundos e não basta para invalidar com exatidão
 * os tokens emitidos antes de uma troca de senha.
 */
export type SignedJwtPayload = JwtPayload & { iatMs: number };

/** Token decodificado: payload + campos padrão do JWT. */
export type DecodedJwt = SignedJwtPayload & { iat: number; exp: number };

/** Monta o payload a ser assinado (login, troca de senha). */
export function createJwtPayload(claims: JwtPayload): SignedJwtPayload {
  return { ...claims, iatMs: Date.now() };
}

/**
 * Usuário autenticado disponível em `request.user` depois do `authMiddleware`.
 * A `role` é a atual do banco, não a do token.
 */
export type AuthenticatedUser = {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SignedJwtPayload;
    user: AuthenticatedUser;
  }
}
