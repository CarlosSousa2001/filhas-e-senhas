export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidPhone(phone: string): boolean {
  return /^[0-9]{10,11}$/.test(normalizePhone(phone));
}
