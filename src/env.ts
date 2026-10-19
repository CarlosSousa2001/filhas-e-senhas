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
  // Proxy confiável para ler o IP real em X-Forwarded-For (o servidor do Next.js).
  // 'true', 'false' ou lista de IPs/sub-redes separados por vírgula.
  TRUST_PROXY: z.string().default('false'),
  // Rate limit das rotas públicas (seção 8 do contexto).
  RATE_LIMIT_LOGIN_PER_IP: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LOGIN_PER_ACCOUNT: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_SIGNUP_PER_HOUR: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().positive().default(120),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
}

function parseTrustProxy(value: string): boolean | string[] {
  if (value === 'true') return true;
  if (value === 'false' || value.trim() === '') return false;
  return value.split(',').map((item) => item.trim());
}

export const env = {
  ...parsed.data,
  TRUST_PROXY: parseTrustProxy(parsed.data.TRUST_PROXY),
  // Documentação ligada por padrão, exceto em produção.
  DOCS_ENABLED: parsed.data.DOCS_ENABLED ?? parsed.data.NODE_ENV !== 'production',
};
