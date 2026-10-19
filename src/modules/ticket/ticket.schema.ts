import { z } from 'zod';
import { paginatedResponseSchema } from '../../shared/http/pagination.js';

export const ticketCreateSchema = z.strictObject({
  departmentId: z.uuid({ error: 'Identificador de departamento inválido' }),
});

const ticketStatusSchema = z.enum([
  'WAITING',
  'IN_SERVICE',
  'FINISHED',
  'NO_SHOW',
  'CANCELLED',
  'EXPIRED',
]);

export const ticketResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  status: ticketStatusSchema,
  serviceDate: z.iso.date(),
  createdAt: z.iso.datetime(),
  department: z.object({ id: z.uuid(), name: z.string(), prefix: z.string() }),
});

/** Departamentos disponíveis na tela de geração de senha do balcão. */
export const ticketDepartmentResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
});

export const ticketDepartmentResponseListSchema = paginatedResponseSchema(
  ticketDepartmentResponseSchema,
);

export const ticketEmptySchema = z.strictObject({});
