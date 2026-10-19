import { BRANCH_MANAGEMENT_ROLES, branchIdOf } from '../../shared/auth/auth-middleware.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import { MAX_SERVICE_POINTS_PER_DEPARTMENT } from '../../shared/constants/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import type { PaginationQuery } from '../../shared/http/pagination.js';
import { DepartmentNotFoundException } from '../department/department.errors.js';
import {
  ServicePointAlreadyAssociatedException,
  ServicePointLimitReachedException,
  ServicePointNotFoundException,
} from './service-point.errors.js';
import { servicePointRepository } from './service-point.repository.js';
import type {
  ServicePoint,
  ServicePointCreateRequest,
  ServicePointUpdateRequest,
} from './service-point.types.js';

function scopeOf(actor: AuthenticatedUser) {
  return { organizationId: actor.organizationId, branchId: branchIdOf(actor) };
}

export async function createServicePoint(
  actor: AuthenticatedUser,
  data: ServicePointCreateRequest,
): Promise<ServicePoint> {
  return servicePointRepository.create({ ...scopeOf(actor), name: data.name });
}

export async function updateServicePoint(
  actor: AuthenticatedUser,
  id: string,
  changes: ServicePointUpdateRequest,
): Promise<ServicePoint> {
  const servicePoint = await servicePointRepository.findInBranch(scopeOf(actor), id);
  if (!servicePoint) {
    throw new ServicePointNotFoundException();
  }
  // Desativar/reativar não muda a contagem do limite: inativos já contam.
  return servicePointRepository.update(servicePoint.id, changes);
}

/** Associa um guichê a um departamento da mesma filial (limite de 10 por departamento). */
export async function associateServicePoint(
  actor: AuthenticatedUser,
  departmentId: string,
  servicePointId: string,
): Promise<ServicePoint> {
  const scope = scopeOf(actor);
  if (!(await servicePointRepository.departmentExistsInBranch(scope, departmentId))) {
    throw new DepartmentNotFoundException();
  }
  const servicePoint = await servicePointRepository.findInBranch(scope, servicePointId);
  if (!servicePoint) {
    throw new ServicePointNotFoundException();
  }
  if (await servicePointRepository.isAssociated(departmentId, servicePointId)) {
    throw new ServicePointAlreadyAssociatedException();
  }
  // Contagem simples, sem lock: ultrapassar em 1 por concorrência é aceito na V1.
  if (
    (await servicePointRepository.countInDepartment(departmentId)) >=
    MAX_SERVICE_POINTS_PER_DEPARTMENT
  ) {
    throw new ServicePointLimitReachedException();
  }

  try {
    await servicePointRepository.associate(departmentId, servicePointId);
  } catch (error) {
    // Associação simultânea: a chave primária do vínculo já existe.
    if (getUniqueViolationConstraint(error) !== undefined) {
      throw new ServicePointAlreadyAssociatedException();
    }
    throw error;
  }
  return servicePoint;
}

/**
 * Guichês de um departamento. OWNER/ADMIN veem todos (inclusive inativos) de qualquer
 * departamento da filial; as demais roles, só os ativos dos departamentos liberados para elas.
 */
export async function listDepartmentServicePoints(
  actor: AuthenticatedUser,
  departmentId: string,
  pagination: PaginationQuery,
) {
  const managesBranch = BRANCH_MANAGEMENT_ROLES.includes(actor.role);
  const exists = await servicePointRepository.departmentExistsInBranch(
    scopeOf(actor),
    departmentId,
    managesBranch ? undefined : actor.userId,
  );
  if (!exists) {
    throw new DepartmentNotFoundException();
  }
  return servicePointRepository.listInDepartment(
    departmentId,
    { onlyActive: !managesBranch },
    pagination,
  );
}
