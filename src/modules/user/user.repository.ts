import { and, eq } from 'drizzle-orm';
import { db } from '../../shared/database/client.js';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { users } from '../../shared/database/schema/index.js';
import type { User } from './user.types.js';

export const userRepository = {
  async findInOrganization(organizationId: string, userId: string): Promise<User | null> {
    const [user] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        branchId: users.branchId,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId), notDeleted(users)))
      .limit(1);
    return user ?? null;
  },

  async updatePassword(userId: string, passwordHash: string, changedAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash, passwordChangedAt: changedAt })
      .where(eq(users.id, userId));
  },
};
