import type { Organization, OrganizationMember, User } from '@prisma/client';

/** The lightweight principal decoded from the access token by `authGuard`. */
export interface AuthPrincipal {
  userId: string;
  /** Active organization from the token's `org_id` claim; null for platform staff / no-org tokens. */
  orgId: string | null;
}

/** The fully-resolved request context loaded from the DB by `loadUserOrg`. */
export interface AuthContext {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
}
