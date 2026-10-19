import { z } from 'zod';
import { MAX_DEPARTMENT_NAME_LENGTH } from '../../shared/constants/index.js';
import { paginatedResponseSchema } from '../../shared/http/pagination.js';

const nameSchema = z
  .string({ error: 'Informe o nome do departamento' })
  .trim()
  .min(1, 'Informe o nome do departamento')
  .max(MAX_DEPARTMENT_NAME_LENGTH, 'Nome do departamento muito longo');

export const departmentCreateSchema = z.strictObject({
  name: nameSchema,
  prefix: z
    .string({ error: 'Informe o prefixo' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,4}$/, 'O prefixo deve ter de 1 a 4 letras ou números'),
});

// Prefixo é imutável: não faz parte do schema estrito de edição (enviar prefix → 400).
export const departmentUpdateSchema = z
  .strictObject(
    {
      name: nameSchema.optional(),
      active: z.boolean({ error: 'active deve ser verdadeiro ou falso' }).optional(),
    },
    { error: 'Campo não permitido (o prefixo não pode ser alterado)' },
  )
  .refine((body) => body.name !== undefined || body.active !== undefined, {
    message: 'Informe ao menos um campo para alterar',
  });

export const departmentIdParamsSchema = z.strictObject({
  id: z.uuid({ error: 'Identificador de departamento inválido' }),
});

export const departmentResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  active: z.boolean(),
});

export const departmentResponseListSchema = paginatedResponseSchema(departmentResponseSchema);

export const departmentEmptySchema = z.strictObject({});
