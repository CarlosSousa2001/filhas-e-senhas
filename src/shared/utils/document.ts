export function normalizeDocument(document: string): string {
  return document.replace(/\D/g, '');
}

export function isValidDocument(document: string): boolean {
  return /^(?:[0-9]{11}|[0-9]{14})$/.test(normalizeDocument(document));
}
