import { z } from 'zod';

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const apiErrorResponseSchema = z.object({
  message: z.string(),
  statusCode: z.number().int(),
  exception: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
