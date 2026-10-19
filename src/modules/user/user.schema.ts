import { z } from 'zod';
import { newPasswordSchema } from '../../shared/auth/password.schema.js';

export const userIdParamsSchema = z.strictObject({
  userId: z.uuid({ error: 'Identificador de usuário inválido' }),
});

export const userResetPasswordSchema = z.strictObject({
  newPassword: newPasswordSchema,
});

export const userEmptySchema = z.strictObject({});
