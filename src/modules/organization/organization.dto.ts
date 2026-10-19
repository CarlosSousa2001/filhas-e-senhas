import type { Organization, OrganizationResponse } from './organization.types.js';

export function toOrganizationResponse(result: Organization): OrganizationResponse {
  return {
    organization: {
      id: result.organization.id,
      name: result.organization.name,
      slug: result.organization.slug,
    },
    owner: {
      id: result.owner.id,
      name: result.owner.name,
      email: result.owner.email,
      username: result.owner.username,
    },
    branch: { id: result.branch.id, name: result.branch.name },
    license: { status: result.license.status, expiresAt: result.license.expiresAt.toISOString() },
  };
}
