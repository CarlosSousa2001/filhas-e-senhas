import { branchIdOf } from '../../shared/auth/auth-middleware.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt.js';
import { MAX_GENERATED_VALUE_ATTEMPTS } from '../../shared/constants/index.js';
import { getUniqueViolationConstraint } from '../../shared/database/unique-violation.js';
import type { PaginationQuery } from '../../shared/http/pagination.js';
import { getServiceDate } from '../../shared/utils/date.js';
import { DepartmentNotFoundException } from '../department/department.errors.js';
import { generateTicketCode } from './generate-ticket-code.js';
import { TicketCodeGenerationException } from './ticket.errors.js';
import { ticketRepository } from './ticket.repository.js';
import type { Ticket } from './ticket.types.js';

function scopeOf(actor: AuthenticatedUser) {
  return { organizationId: actor.organizationId, branchId: branchIdOf(actor) };
}

/** Departamentos ativos da filial para a tela de geração do balcão (todos, sem filtro de acesso). */
export async function listTicketDepartments(actor: AuthenticatedUser, pagination: PaginationQuery) {
  return ticketRepository.listActiveDepartments(scopeOf(actor), pagination);
}

/**
 * Gera uma senha no balcão (seção 48 do contexto). A organização e a filial vêm do token;
 * qualquer departamento ativo da filial, sem consultar user_department_access.
 */
export async function createTicket(
  actor: AuthenticatedUser,
  departmentId: string,
): Promise<Ticket> {
  const scope = scopeOf(actor);
  const department = await ticketRepository.findActiveDepartment(scope, departmentId);
  if (!department) {
    throw new DepartmentNotFoundException();
  }

  for (let attempt = 0; attempt < MAX_GENERATED_VALUE_ATTEMPTS; attempt++) {
    // service_date e created_at saem do mesmo instante, lido do relógio da aplicação.
    const now = new Date();
    try {
      return await ticketRepository.createWithHistory({
        ...scope,
        department,
        code: generateTicketCode(department.prefix),
        serviceDate: getServiceDate(now),
        createdAt: now,
        actorUserId: actor.userId,
      });
    } catch (error) {
      // Código repetido no mesmo dia: gera outro e refaz a transação inteira.
      if (getUniqueViolationConstraint(error) !== 'uq_tickets_branch_code_date') throw error;
    }
  }
  throw new TicketCodeGenerationException();
}
