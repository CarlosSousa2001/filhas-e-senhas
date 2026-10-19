import type { Auth, AuthResponse } from './auth.types.js';

export function toAuthResponse(auth: Auth, accessToken: string): AuthResponse {
  return {
    accessToken,
    ...auth,
    license: { ...auth.license, expiresAt: auth.license.expiresAt.toISOString() },
  };
}
