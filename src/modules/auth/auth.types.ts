/** Wire response shapes — raw payloads, no envelope (per the API contract). */

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface RegisterResponse extends TokenPair {
  user_id: string;
  email: string;
}

export type LoginResponse = TokenPair;

export interface RefreshResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface SessionResponse {
  id: string;
  organization_id: string | null;
  device_info: string | null;
  created_at: string;
  expires_at: string | null;
}

/** Request metadata captured for the Session row (device/audit trail). */
export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Internal service results (controller adds the cookie + HTTP shape). */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
