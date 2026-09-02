/** Auth-related shared types — placeholder stubs for workspace wiring */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
}
