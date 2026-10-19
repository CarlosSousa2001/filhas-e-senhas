import type { Department, DepartmentResponse } from './department.types.js';

export function toDepartmentResponse(department: Department): DepartmentResponse {
  return {
    id: department.id,
    name: department.name,
    prefix: department.prefix,
    active: department.active,
  };
}
