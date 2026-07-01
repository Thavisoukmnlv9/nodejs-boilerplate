import type { Entitlements } from '@/modules/entitlements/entitlement.types';

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

/** GET /api/v1/me — the SPA's single bootstrap call. */
export interface MeResponse {
  user: MeUser;
  organization: MeOrganization | null;
  permissions: string[];
  branches: MeBranch[];
  default_branch_id: string | null;
  entitlements: Entitlements;
}
