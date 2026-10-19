import type { UserRole } from '../types/user-role.js';

export type JwtPayload = {
  userId: string;
  organizationId: string;
  branchId: string;
  role: UserRole;
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
