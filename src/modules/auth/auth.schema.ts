import { z } from 'zod';
import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_USERNAME_LENGTH,
} from '../../shared/constants/index.js';

// No login a senha é apenas obrigatória: a política de tamanho mínimo vale na criação/troca,
// e validar aqui revelaria a regra a quem tenta adivinhar senhas.
const password = z
  .string({ error: 'Informe a senha' })
  .min(1, 'Informe a senha')
  .max(MAX_PASSWORD_LENGTH, 'Credenciais inválidas');
const normalized = (message: string) =>
  z.string({ error: message }).trim().toLowerCase().min(1, message);

export const authLoginSchema = z.union(
  [
    z.strictObject({
      email: normalized('Informe o e-mail')
        .max(MAX_EMAIL_LENGTH)
        .pipe(z.email({ error: 'Informe um e-mail válido' })),
      password,
    }),
    z.strictObject({
      organizationSlug: normalized('Informe a empresa').max(MAX_SLUG_LENGTH),
      username: normalized('Informe o usuário').max(MAX_USERNAME_LENGTH),
      password,
    }),
  ],
  { error: 'Informe e-mail e senha (dono) ou empresa, usuário e senha (funcionário)' },
);

export const authEmptySchema = z.strictObject({});
export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    username: z.string(),
    role: z.enum(['OWNER', 'ADMIN', 'BRANCH_ADMIN', 'MANAGER', 'ATTENDANT', 'VIEWER']),
  }),
  organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
  branch: z.object({ id: z.uuid(), name: z.string() }),
  license: z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']),
    expiresAt: z.iso.datetime(),
    valid: z.boolean(),
  }),
});

/** GET /auth/me: mesmo formato do login, sem o token. */
export const authMeResponseSchema = authResponseSchema.omit({ accessToken: true }).extend({
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
