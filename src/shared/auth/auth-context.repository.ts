import { eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { branches, licenses, organizations, users } from '../database/schema/index.js';
import type { LicenseStatus } from '../types/license-status.js';
import type { UserRole } from '../types/user-role.js';

interface AuthContextEntity {
  user: {
    id: string;
    organizationId: string;
    branchId: string | null;
    role: UserRole;
    active: boolean;
    deletedAt: Date | null;
    passwordChangedAt: Date;
  };
  organization: { active: boolean; deletedAt: Date | null };
  license: { status: LicenseStatus; expiresAt: Date } | null;
}

interface AuthBranchEntity {
  id: string;
  organizationId: string;
  active: boolean;
  deletedAt: Date | null;
}

export type AuthContext = AuthContextEntity;
export type AuthBranch = AuthBranchEntity;

/**
 * Consultas do authMiddleware. Incluem registros excluídos de propósito:
 * o middleware precisa distinguir "inexistente" (401) de "excluído" (403).
 */
export const authContextRepository = {
  async findByUserId(userId: string): Promise<AuthContext | null> {
    const [row] = await db
      .select({
        user: {
          id: users.id,
          organizationId: users.organizationId,
          branchId: users.branchId,
          role: users.role,
          active: users.active,
          deletedAt: users.deletedAt,
          passwordChangedAt: users.passwordChangedAt,
        },
        organization: { active: organizations.active, deletedAt: organizations.deletedAt },
        licenseStatus: licenses.status,
        licenseExpiresAt: licenses.expiresAt,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .leftJoin(licenses, eq(licenses.organizationId, users.organizationId))
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) return null;

    return {
      user: row.user,
      organization: row.organization,
      license:
        row.licenseStatus !== null && row.licenseExpiresAt !== null
          ? { status: row.licenseStatus, expiresAt: row.licenseExpiresAt }
          : null,
    };
  },

  async findBranchById(branchId: string): Promise<AuthBranch | null> {
    const [branch] = await db
      .select({
        id: branches.id,
        organizationId: branches.organizationId,
        active: branches.active,
        deletedAt: branches.deletedAt,
      })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    return branch ?? null;
  },
};
