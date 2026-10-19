import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/index.js';

/** Query de paginação padrão (seção 8 do guia): ?page=1&pageSize=20. */
export const paginationQuerySchema = z.strictObject({
  page: z.coerce
    .number({ error: 'Página inválida' })
    .int('Página inválida')
    .min(1, 'Página inválida')
    .default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number({ error: 'Tamanho de página inválido' })
    .int('Tamanho de página inválido')
    .min(1, 'Tamanho de página inválido')
    .max(MAX_PAGE_SIZE, `O tamanho máximo de página é ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Schema Zod do PaginatedResponse<T> (documentação e filtro de saída). */
export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    currentPage: z.number().int(),
    pageSize: z.number().int(),
    nextPage: z.number().int().nullable(),
    previousPage: z.number().int().nullable(),
  });
}

export type PaginatedResponse<T> = {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  nextPage: number | null;
  previousPage: number | null;
};

export function toPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  { page, pageSize }: PaginationQuery,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    data,
    totalItems,
    totalPages,
    currentPage: page,
    pageSize,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? Math.min(page - 1, Math.max(totalPages, 1)) : null,
  };
}

export function paginationOffset({ page, pageSize }: PaginationQuery): number {
  return (page - 1) * pageSize;
}
