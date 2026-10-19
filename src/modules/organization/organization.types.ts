import type { z } from 'zod';
import type {
  organizationCreateSchema,
  organizationResponseSchema,
} from './organization.schema.js';

interface OrganizationEntity {
  organization: { id: string; name: string; slug: string };
  owner: { id: string; name: string; email: string; username: string };
  branch: { id: string; name: string };
  license: { status: 'ACTIVE'; expiresAt: Date };
}

export type Organization = OrganizationEntity;
export type OrganizationCreateRequest = z.infer<typeof organizationCreateSchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
export type OrganizationCreateData = Omit<
  OrganizationCreateRequest,
  'password' | 'passwordConfirmation' | 'acceptedTerms'
> & {
  slug: string;
  username: string;
  passwordHash: string;
  now: Date;
  expiresAt: Date;
  termsVersion: string;
};
