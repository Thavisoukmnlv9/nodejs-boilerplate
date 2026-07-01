/** The merged member+user view returned by the users feature. */
export interface MemberUserView {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  status: string;
}

export interface MemberView {
  /** OrganizationMember id (the membership), NOT the user id. */
  id: string;
  user: MemberUserView;
  role_id: string | null;
  is_owner: boolean;
  branch_ids: string[];
  default_branch_id: string | null;
  staff_title: string | null;
  staff_note: string | null;
  invited_at: string;
  accepted_at: string | null;
}
