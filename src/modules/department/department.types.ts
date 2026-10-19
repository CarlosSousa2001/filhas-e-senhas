import type { z } from 'zod';
import type { PaginatedResponse } from '../../shared/http/pagination.js';
import type {
  departmentCreateSchema,
  departmentIdParamsSchema,
  departmentResponseSchema,
  departmentUpdateSchema,
} from './department.schema.js';

interface DepartmentEntity {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  prefix: string;
  active: boolean;
}

export type Department = DepartmentEntity;
export type DepartmentCreateRequest = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateRequest = z.infer<typeof departmentUpdateSchema>;
export type DepartmentIdParams = z.infer<typeof departmentIdParamsSchema>;
export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;
export type DepartmentResponseList = PaginatedResponse<DepartmentResponse>;
