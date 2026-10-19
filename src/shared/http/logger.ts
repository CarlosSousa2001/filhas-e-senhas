import type { FastifyServerOptions } from 'fastify';

const sensitiveFields = [
  'password',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
];

// O formatter complementa o redact para objetos e arrays em qualquer profundidade.
function redactFields(value: unknown, visited = new WeakMap<object, unknown>()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (visited.has(value)) return visited.get(value);
  if (
    !Array.isArray(value) &&
    !(value instanceof Error) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return value;

  const result: Record<string, unknown> = {};
  const output: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : result;
  visited.set(value, output);
  if (Array.isArray(value)) {
    for (const item of value) (output as unknown[]).push(redactFields(item, visited));
  } else {
    // Preserva o diagnóstico dos erros, incluindo causas não enumeráveis.
    if (value instanceof Error) {
      result.type = value.name;
      result.message = value.message;
      result.stack = value.stack;
      if (value.cause !== undefined) result.cause = redactFields(value.cause, visited);
    }
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sensitiveFields.includes(key) ? '[Redacted]' : redactFields(entry, visited);
    }
  }
  return output;
}

export const loggerOptions: Exclude<FastifyServerOptions['logger'], boolean | undefined> = {
  redact: [
    'req.headers.authorization',
    'headers.authorization',
    ...sensitiveFields.flatMap((field) => [field, `*.${field}`, `req.body.${field}`]),
  ],
  formatters: {
    log: (object) => redactFields(object) as Record<string, unknown>,
  },
};
