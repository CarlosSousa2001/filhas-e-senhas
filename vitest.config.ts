import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { validateTestDatabaseUrl } from './test/database.js';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const databaseUrl =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/senhas_test';
validateTestDatabaseUrl(databaseUrl);
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./test/setup.ts'],
    setupFiles: ['./test/helpers.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-jwt-secret-at-least-32-characters',
      DATABASE_URL: databaseUrl,
    },
  },
});
