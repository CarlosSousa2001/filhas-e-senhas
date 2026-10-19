/** undefined: não é violação; null: violação sem nome de constraint. */
export function getUniqueViolationConstraint(error: unknown): string | null | undefined {
  const visited = new Set<object>();
  let current = error;

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);
    if ('code' in current && current.code === '23505') {
      return 'constraint' in current && typeof current.constraint === 'string'
        ? current.constraint
        : null;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}
