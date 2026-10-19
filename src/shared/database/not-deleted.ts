import { isNull } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export function notDeleted(table: { deletedAt: AnyPgColumn }) {
  return isNull(table.deletedAt);
}
