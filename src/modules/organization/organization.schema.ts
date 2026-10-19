import { z } from 'zod';
import {
  MAX_EMAIL_LENGTH,
  MAX_ORGANIZATION_NAME_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  MAX_SLUG_LENGTH,
} from '../../shared/constants/index.js';
import { newPasswordSchema } from '../../shared/auth/password.schema.js';
import { isValidDocument, normalizeDocument } from '../../shared/utils/document.js';
import { normalizeEmail } from '../../shared/utils/email.js';
import { isValidPhone, normalizePhone } from '../../shared/utils/phone.js';

const requiredString = () => z.string({ error: 'Campo obrigatório deve ser um texto' });
const passwordSchema = newPasswordSchema;

export const organizationCreateSchema = z
  .strictObject(
    {
      organizationName: requiredString()
        .trim()
        .min(1, 'Informe o nome da organização')
        .max(MAX_ORGANIZATION_NAME_LENGTH, 'Nome da organização muito longo'),
      document: requiredString()
        .transform(normalizeDocument)
        .refine(isValidDocument, 'Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos'),
      ownerName: requiredString()
        .trim()
        .min(1, 'Informe o nome do dono')
        .max(MAX_PERSON_NAME_LENGTH, 'Nome do dono muito longo'),
      phone: requiredString()
        .transform(normalizePhone)
        .refine(isValidPhone, 'Informe um telefone com 10 ou 11 dígitos'),
      email: requiredString()
        .transform(normalizeEmail)
        .pipe(
          z
            .email({ error: 'Informe um e-mail válido' })
            .max(MAX_EMAIL_LENGTH, 'E-mail muito longo'),
        ),
      password: passwordSchema,
      passwordConfirmation: passwordSchema,
      acceptedTerms: z.literal(true, { error: 'É necessário aceitar os termos de uso' }),
    },
    { error: 'Campos não permitidos no cadastro' },
  )
  .refine((body) => body.password === body.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não conferem',
  });

export const organizationSlugParamsSchema = z.strictObject({
  slug: z.string().trim().toLowerCase().max(MAX_SLUG_LENGTH),
});

export const organizationPublicResponseSchema = z.object({
  name: z.string(),
});

export const organizationEmptySchema = z.strictObject({}, { error: 'Campos não permitidos' });

export const organizationResponseSchema = z.object({
  organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
  owner: z.object({ id: z.uuid(), name: z.string(), email: z.email(), username: z.string() }),
  branch: z.object({ id: z.uuid(), name: z.string() }),
  license: z.object({ status: z.literal('ACTIVE'), expiresAt: z.iso.datetime() }),
});
