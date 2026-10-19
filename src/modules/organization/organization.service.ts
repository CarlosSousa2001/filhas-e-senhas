import { hashPassword } from '../../shared/auth/password.js';
import {
  CURRENT_TERMS_VERSION,
  LICENSE_DEFAULT_DURATION_DAYS,
  MAX_GENERATED_VALUE_ATTEMPTS,
} from '../../shared/constants/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import { ConflictException } from '../../shared/errors/common-exceptions.js';
import {
  appendRandomSlugSuffix,
  isReservedSlug,
  isValidSlug,
  slugify,
} from '../../shared/utils/slug.js';
import { generateUsername } from '../../shared/utils/username.js';
import {
  OrganizationDocumentAlreadyExistsException,
  OwnerEmailAlreadyExistsException,
} from './organization.errors.js';
import { organizationRepository } from './organization.repository.js';
import type { Organization, OrganizationCreateRequest } from './organization.types.js';

export async function createOrganization(data: OrganizationCreateRequest): Promise<Organization> {
  if (await organizationRepository.documentExistsIncludingDeleted(data.document)) {
    throw new OrganizationDocumentAlreadyExistsException();
  }
  if (await organizationRepository.ownerEmailExistsIncludingDeleted(data.email)) {
    throw new OwnerEmailAlreadyExistsException();
  }
  const passwordHash = await hashPassword(data.password);
  const base = slugify(data.organizationName);
  let slug = base;
  for (let attempt = 0; attempt < MAX_GENERATED_VALUE_ATTEMPTS; attempt++) {
    if (
      attempt > 0 ||
      !isValidSlug(slug) ||
      isReservedSlug(slug) ||
      (await organizationRepository.slugExistsIncludingDeleted(slug))
    ) {
      slug = appendRandomSlugSuffix(base);
      if (await organizationRepository.slugExistsIncludingDeleted(slug)) continue;
    }
    const now = new Date();
    try {
      return await organizationRepository.create({
        organizationName: data.organizationName,
        ownerName: data.ownerName,
        document: data.document,
        email: data.email,
        phone: data.phone,
        slug,
        username: generateUsername(data.ownerName),
        passwordHash,
        now,
        termsVersion: CURRENT_TERMS_VERSION,
        expiresAt: new Date(now.getTime() + LICENSE_DEFAULT_DURATION_DAYS * 86_400_000),
      });
    } catch (error) {
      const constraint = getUniqueViolationConstraint(error);
      if (constraint !== 'uq_organizations_slug' && constraint !== 'uq_users_organization_username')
        throw error;
    }
  }
  throw new ConflictException();
}
