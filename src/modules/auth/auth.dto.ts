import type { Auth, AuthMe, AuthMeResponse, AuthResponse } from './auth.types.js';

export function toAuthResponse(auth: Auth, accessToken: string): AuthResponse {
  return {
    accessToken,
    ...auth,
    license: { ...auth.license, expiresAt: auth.license.expiresAt.toISOString() },
  };
}

export function toAuthMeResponse(me: AuthMe): AuthMeResponse {
  return {
    ...me,
    license: { ...me.license, expiresAt: me.license.expiresAt.toISOString() },
  };
}
