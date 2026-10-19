import type { z } from 'zod';
import type { UserRole } from '../../shared/types/user-role.js';
import type { userIdParamsSchema, userResetPasswordSchema } from './user.schema.js';

interface UserEntity {
  id: string;
  organizationId: string;
  branchId: string | null;
  role: UserRole;
}

export type User = UserEntity;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UserResetPasswordRequest = z.infer<typeof userResetPasswordSchema>;
