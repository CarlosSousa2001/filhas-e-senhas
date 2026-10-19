import { existsSync } from 'node:fs';
import { z } from 'zod';

// Carrega o .env quando existir. Variáveis já definidas no ambiente não são sobrescritas.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  DOCS_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
}

export const env = {
  ...parsed.data,
  // Documentação ligada por padrão, exceto em produção.
  DOCS_ENABLED: parsed.data.DOCS_ENABLED ?? parsed.data.NODE_ENV !== 'production',
};
