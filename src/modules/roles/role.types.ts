/** The role shape returned by the roles feature (mirrors the reference RoleResponse). */
export interface RoleView {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
  permission_codes: string[];
  created_at: string;
}

/** A permission catalog entry (for the permission-matrix UI). */
export interface PermissionView {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

/** Aggregate counts for the roles-page stat cards. */
export interface RoleStats {
  total: number;
  system: number;
  custom: number;
  unused: number;
}
