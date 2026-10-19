import { BRANCH_MANAGEMENT_ROLES, branchIdOf } from '../../shared/auth/auth-middleware.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import { MAX_DEPARTMENTS_PER_BRANCH } from '../../shared/constants/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import type { PaginationQuery } from '../../shared/http/pagination.js';
import {
  DeletedDepartmentExistsException,
  DepartmentLimitReachedException,
  DepartmentNotFoundException,
  DepartmentPrefixAlreadyExistsException,
} from './department.errors.js';
import { departmentRepository } from './department.repository.js';
import type {
  Department,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
} from './department.types.js';

async function throwPrefixConflict(branchId: string, prefix: string): Promise<void> {
  const existing = await departmentRepository.findByPrefixIncludingDeleted(branchId, prefix);
  if (existing?.deletedAt) throw new DeletedDepartmentExistsException(existing.id);
  if (existing) throw new DepartmentPrefixAlreadyExistsException();
}

export async function createDepartment(
  actor: AuthenticatedUser,
  data: DepartmentCreateRequest,
): Promise<Department> {
  const branchId = branchIdOf(actor);

  // Contagem simples, sem lock: ultrapassar em 1 por concorrência é aceito na V1.
  if ((await departmentRepository.countInBranch(branchId)) >= MAX_DEPARTMENTS_PER_BRANCH) {
    throw new DepartmentLimitReachedException();
  }
  await throwPrefixConflict(branchId, data.prefix);

  try {
    return await departmentRepository.create({
      organizationId: actor.organizationId,
      branchId,
      name: data.name,
      prefix: data.prefix,
    });
  } catch (error) {
    if (getUniqueViolationConstraint(error) === 'uq_departments_branch_prefix') {
      await throwPrefixConflict(branchId, data.prefix);
    }
    throw error;
  }
}

/**
 * OWNER/ADMIN/BRANCH_ADMIN veem todos os departamentos da filial (inclusive inativos);
 * as demais roles veem apenas os ativos liberados em user_department_access.
 */
export async function listDepartments(actor: AuthenticatedUser, pagination: PaginationQuery) {
  const seesAll = BRANCH_MANAGEMENT_ROLES.includes(actor.role);
  return departmentRepository.listInBranch(
    {
      organizationId: actor.organizationId,
      branchId: branchIdOf(actor),
      accessibleByUserId: seesAll ? undefined : actor.userId,
    },
    pagination,
  );
}

export async function updateDepartment(
  actor: AuthenticatedUser,
  id: string,
  changes: DepartmentUpdateRequest,
): Promise<Department> {
  const department = await departmentRepository.findInBranch(
    actor.organizationId,
    branchIdOf(actor),
    id,
  );
  if (!department) {
    throw new DepartmentNotFoundException();
  }
  // Desativar/reativar não muda a contagem do limite: inativos já contam.
  return departmentRepository.update(department.id, changes);
}
