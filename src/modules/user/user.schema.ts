import { z } from 'zod';
import { newPasswordSchema } from '../../shared/auth/password.schema.js';
import {
  MAX_EMAIL_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
} from '../../shared/constants/index.js';
import { paginatedResponseSchema } from '../../shared/http/pagination.js';
import { normalizeEmail } from '../../shared/utils/email.js';
import { isValidUsername, normalizeUsername } from '../../shared/utils/username.js';

/** Roles que podem ser atribuídas na V1 (OWNER é único; BRANCH_ADMIN só com multi-filial). */
export const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT', 'VIEWER'] as const;

const nameSchema = z
  .string({ error: 'Informe o nome' })
  .trim()
  .min(1, 'Informe o nome')
  .max(MAX_PERSON_NAME_LENGTH, 'Nome muito longo');

const usernameSchema = z
  .string({ error: 'Informe o nome de usuário' })
  .transform(normalizeUsername)
  .refine(
    isValidUsername,
    `Use apenas letras minúsculas, números, "." e "_" (até ${MAX_USERNAME_LENGTH} caracteres)`,
  );

const roleSchema = z.enum(ASSIGNABLE_ROLES, {
  error: 'Role inválida. Use ADMIN, MANAGER, ATTENDANT ou VIEWER',
});

export const userCreateSchema = z.strictObject({
  name: nameSchema,
  role: roleSchema,
  username: usernameSchema.optional(),
  email: z
    .string({ error: 'Informe um e-mail válido' })
    .transform(normalizeEmail)
    .pipe(
      z.email({ error: 'Informe um e-mail válido' }).max(MAX_EMAIL_LENGTH, 'E-mail muito longo'),
    )
    .optional(),
  password: newPasswordSchema,
});

export const userUpdateSchema = z
  .strictObject({
    name: nameSchema.optional(),
    role: roleSchema.optional(),
    username: usernameSchema.optional(),
    active: z.boolean({ error: 'active deve ser verdadeiro ou falso' }).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para alterar',
  });

export const userIdParamsSchema = z.strictObject({
  userId: z.uuid({ error: 'Identificador de usuário inválido' }),
});

export const userResetPasswordSchema = z.strictObject({
  newPassword: newPasswordSchema,
});

export const userDepartmentAccessSchema = z.strictObject({
  departmentId: z.uuid({ error: 'Identificador de departamento inválido' }),
});

export const userResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  role: z.enum(['OWNER', 'ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'ATTENDANT', 'VIEWER']),
  active: z.boolean(),
  branchId: z.uuid().nullable(),
});

export const userResponseListSchema = paginatedResponseSchema(userResponseSchema);

export const userDepartmentAccessResponseSchema = z.object({
  userId: z.uuid(),
  department: z.object({ id: z.uuid(), name: z.string(), prefix: z.string() }),
});

export const userEmptySchema = z.strictObject({});
