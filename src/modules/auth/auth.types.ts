import type { z } from 'zod';
import type { UserRole } from '../../shared/types/user-role.js';
import type { LicenseStatus } from '../../shared/types/license-status.js';
import type {
  authChangePasswordSchema,
  authLoginSchema,
  authMeResponseSchema,
  authResponseSchema,
} from './auth.schema.js';

interface AuthUserEntity {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  deletedAt: Date | null;
}
interface AuthOrganizationEntity {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  deletedAt: Date | null;
}
interface AuthEntity {
  user: Pick<AuthUserEntity, 'id' | 'name' | 'username' | 'role'>;
  organization: Pick<AuthOrganizationEntity, 'id' | 'name' | 'slug'>;
  branch: { id: string; name: string };
  license: { status: LicenseStatus; expiresAt: Date; valid: boolean };
}
export type AuthUser = AuthUserEntity;
export type AuthOrganization = AuthOrganizationEntity;
export type Auth = AuthEntity;
export type AuthLoginRequest = z.infer<typeof authLoginSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthMe = Omit<AuthEntity, 'branch'> & { branch: AuthEntity['branch'] | null };
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
export type AuthChangePasswordRequest = z.infer<typeof authChangePasswordSchema>;
