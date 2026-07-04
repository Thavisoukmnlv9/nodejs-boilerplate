/** The user sub-view embedded in a member. */
export interface MemberUserView {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  status: string;
}

/** The merged member+user view returned by the users feature. */
export interface MemberView {
  /** OrganizationMember id (the membership), NOT the user id. */
  id: string;
  user: MemberUserView;
  role_id: string | null;
  is_owner: boolean;
  /** ACTIVE | INACTIVE | SUSPENDED | PENDING (PENDING = invite not yet accepted). */
  status: string;
  branch_ids: string[];
  default_branch_id: string | null;
  staff_title: string | null;
  staff_note: string | null;
  invited_at: string;
  invitation_expires_at: string | null;
  accepted_at: string | null;
}

/** Response after issuing (or re-issuing) an invite — the raw token is shown once. */
export interface InviteIssued {
  member: MemberView;
  invite_token: string;
  invitation_expires_at: string;
}
