import type { UserRole } from '../types/user-role.js';

/** Conteúdo assinado no token (seção 5.5 do contexto). */
export type JwtPayload = {
  userId: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
};

/** Token decodificado: payload + campos padrão do JWT. */
export type DecodedJwt = JwtPayload & { iat: number; exp: number };

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
    payload: JwtPayload;
    user: AuthenticatedUser;
  }
}
