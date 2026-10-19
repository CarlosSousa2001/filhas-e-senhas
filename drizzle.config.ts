import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: z.url().parse(process.env.DATABASE_URL),
  },
});
