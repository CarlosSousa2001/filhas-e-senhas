import { z } from 'zod';
import { MAX_SERVICE_POINT_NAME_LENGTH } from '../../shared/constants/index.js';
import { paginatedResponseSchema } from '../../shared/http/pagination.js';

const nameSchema = z
  .string({ error: 'Informe o nome do guichê' })
  .trim()
  .min(1, 'Informe o nome do guichê')
  .max(MAX_SERVICE_POINT_NAME_LENGTH, 'Nome do guichê muito longo');

export const servicePointCreateSchema = z.strictObject({
  name: nameSchema,
});

export const servicePointUpdateSchema = z
  .strictObject({
    name: nameSchema.optional(),
    active: z.boolean({ error: 'active deve ser verdadeiro ou falso' }).optional(),
  })
  .refine((body) => body.name !== undefined || body.active !== undefined, {
    message: 'Informe ao menos um campo para alterar',
  });

export const servicePointIdParamsSchema = z.strictObject({
  id: z.uuid({ error: 'Identificador de guichê inválido' }),
});

export const departmentIdParamsSchema = z.strictObject({
  departmentId: z.uuid({ error: 'Identificador de departamento inválido' }),
});

export const servicePointAssociateSchema = z.strictObject({
  servicePointId: z.uuid({ error: 'Identificador de guichê inválido' }),
});

export const servicePointResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
});

export const servicePointResponseListSchema = paginatedResponseSchema(servicePointResponseSchema);

export const servicePointEmptySchema = z.strictObject({});
