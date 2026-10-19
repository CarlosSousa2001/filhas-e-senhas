import type { z } from 'zod';
import type { UserRole } from '../../shared/types/user-role.js';
import type {
  userCreateSchema,
  userDepartmentAccessResponseSchema,
  userDepartmentAccessSchema,
  userIdParamsSchema,
  userResetPasswordSchema,
  userResponseSchema,
  userUpdateSchema,
} from './user.schema.js';

interface UserEntity {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  active: boolean;
}

export type User = UserEntity;
export type UserCreateRequest = z.infer<typeof userCreateSchema>;
export type UserUpdateRequest = z.infer<typeof userUpdateSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UserResetPasswordRequest = z.infer<typeof userResetPasswordSchema>;
export type UserDepartmentAccessRequest = z.infer<typeof userDepartmentAccessSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserDepartmentAccessResponse = z.infer<typeof userDepartmentAccessResponseSchema>;
