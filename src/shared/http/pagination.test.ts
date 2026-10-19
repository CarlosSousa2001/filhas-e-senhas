import { describe, expect, it } from 'vitest';
import { paginationQuerySchema, toPaginatedResponse } from './pagination.js';

describe('paginação', () => {
  it('aplica os padrões page=1 e pageSize=20', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('recusa pageSize acima de 100', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('monta a resposta de uma página do meio', () => {
    expect(toPaginatedResponse(['a'], 42, { page: 2, pageSize: 10 })).toEqual({
      data: ['a'],
      totalItems: 42,
      totalPages: 5,
      currentPage: 2,
      pageSize: 10,
      nextPage: 3,
      previousPage: 1,
    });
  });

  it('última página sem próxima', () => {
    const response = toPaginatedResponse([], 42, { page: 5, pageSize: 10 });
    expect(response.nextPage).toBeNull();
    expect(response.previousPage).toBe(4);
  });

  it('lista vazia', () => {
    expect(toPaginatedResponse([], 0, { page: 1, pageSize: 20 })).toEqual({
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 20,
      nextPage: null,
      previousPage: null,
    });
  });
});
