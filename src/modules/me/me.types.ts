/**
 * Entitlements surfaced by /me. The subscription models that populated
 * modules/limits were removed; the field stays (empty) for SPA wire-compat.
 */
export interface MeEntitlements {
  modules: string[];
  limits: Record<string, number>;
}

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  mfa_enabled: boolean;
  is_platform_staff: boolean;
  platform_staff_role: string | null;
}

export interface MeOrganization {
  id: string;
  name: string | null;
  slug: string | null;
  logo_url: string | null;
  currency: string | null;
  locale: string | null;
}

export interface MeBranch {
  id: string;
  name: string;
  is_default: boolean;
}

/** A compact stored policy, shipped so the SPA can mirror the server's can() for UI gating. */
export interface MePolicy {
  effect: 'ALLOW' | 'DENY';
  action: string;
  subject: string;
  conditions: unknown | null;
  role_id: string | null;
}

/** GET /api/v1/me — the SPA's single bootstrap call. */
export interface MeResponse {
  user: MeUser;
  organization: MeOrganization | null;
  permissions: string[];
  branches: MeBranch[];
  default_branch_id: string | null;
  policies: MePolicy[];
  entitlements: MeEntitlements;
}
