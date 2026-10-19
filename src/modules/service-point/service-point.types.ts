import type { z } from 'zod';
import type {
  departmentIdParamsSchema,
  servicePointAssociateSchema,
  servicePointCreateSchema,
  servicePointIdParamsSchema,
  servicePointResponseSchema,
  servicePointUpdateSchema,
} from './service-point.schema.js';

interface ServicePointEntity {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  active: boolean;
}

export type ServicePoint = ServicePointEntity;
export type ServicePointCreateRequest = z.infer<typeof servicePointCreateSchema>;
export type ServicePointUpdateRequest = z.infer<typeof servicePointUpdateSchema>;
export type ServicePointAssociateRequest = z.infer<typeof servicePointAssociateSchema>;
export type ServicePointIdParams = z.infer<typeof servicePointIdParamsSchema>;
export type DepartmentIdParams = z.infer<typeof departmentIdParamsSchema>;
export type ServicePointResponse = z.infer<typeof servicePointResponseSchema>;
