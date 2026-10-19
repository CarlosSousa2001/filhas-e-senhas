import { and, eq } from 'drizzle-orm';
import { notDeleted } from '../../shared/database/not-deleted.js';
import { db } from '../../shared/database/client.js';
import {
  organizations,
  licenses,
  branches,
  users,
  departments,
} from '../../shared/database/schema/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import { ConflictException } from '../../shared/errors/common-exceptions.js';
import {
  OrganizationDocumentAlreadyExistsException,
  OwnerEmailAlreadyExistsException,
} from './organization.errors.js';
import type { Organization, OrganizationCreateData } from './organization.types.js';

export const organizationRepository = {
  // Verificações de conflito incluem registros excluídos: valores nunca são reaproveitados.
  async documentExistsIncludingDeleted(document: string): Promise<boolean> {
    const rows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.document, document))
      .limit(1);
    return rows.length > 0;
  },

  async ownerEmailExistsIncludingDeleted(email: string): Promise<boolean> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.role, 'OWNER')))
      .limit(1);
    return rows.length > 0;
  },

  async slugExistsIncludingDeleted(slug: string): Promise<boolean> {
    const rows = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return rows.length > 0;
  },

  async findActiveNameBySlug(slug: string): Promise<string | null> {
    const [row] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(
        and(
          eq(organizations.slug, slug),
          eq(organizations.active, true),
          notDeleted(organizations),
        ),
      )
      .limit(1);
    return row?.name ?? null;
  },

  async create(data: OrganizationCreateData): Promise<Organization> {
    try {
      return await db.transaction(async (tx) => {
        const [organization] = await tx
          .insert(organizations)
          .values({
            name: data.organizationName,
            slug: data.slug,
            document: data.document,
            contactEmail: data.email,
            contactPhone: data.phone,
            termsAcceptedAt: data.now,
            termsVersion: data.termsVersion,
          })
          .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });
        await tx.insert(licenses).values({
          organizationId: organization!.id,
          status: 'ACTIVE',
          startedAt: data.now,
          expiresAt: data.expiresAt,
        });
        const [branch] = await tx
          .insert(branches)
          .values({
            organizationId: organization!.id,
            name: 'Matriz',
          })
          .returning({ id: branches.id, name: branches.name });
        const [owner] = await tx
          .insert(users)
          .values({
            organizationId: organization!.id,
            branchId: null,
            name: data.ownerName,
            email: data.email,
            username: data.username,
            passwordHash: data.passwordHash,
            passwordChangedAt: data.now,
            role: 'OWNER',
          })
          .returning({ id: users.id, name: users.name, username: users.username });
        await tx.insert(departments).values({
          organizationId: organization!.id,
          branchId: branch!.id,
          name: 'Atendimento',
          prefix: 'AT',
        });
        return {
          organization: organization!,
          owner: { ...owner!, email: data.email },
          branch: branch!,
          license: { status: 'ACTIVE', expiresAt: data.expiresAt },
        };
      });
    } catch (error) {
      const constraint = getUniqueViolationConstraint(error);
      if (constraint === 'uq_organizations_document')
        throw new OrganizationDocumentAlreadyExistsException();
      if (constraint === 'uq_users_owner_email') throw new OwnerEmailAlreadyExistsException();
      if (constraint === 'uq_organizations_slug' || constraint === 'uq_users_organization_username')
        throw error;
      if (constraint !== undefined) throw new ConflictException();
      // O erro do Drizzle carrega os parâmetros da query (incluindo o hash da senha).
      // Repassa apenas o erro do PostgreSQL como causa, para o error handler logar sem vazar o hash.
      const databaseError =
        error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
      // eslint-disable-next-line preserve-caught-error -- a causa completa vazaria o hash da senha no log
      throw new Error('Falha ao criar a organização', { cause: databaseError });
    }
  },
};
