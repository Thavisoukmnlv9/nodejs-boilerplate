/** Stored ABAC policy shape returned by the policies feature. */
export interface PolicyView {
  id: string;
  organization_id: string;
  role_id: string | null;
  effect: 'ALLOW' | 'DENY';
  action: string;
  subject: string;
  conditions: unknown | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
