import { definePermissionCatalog, type PermissionSeed, type RoleSeed } from '@/access/catalog';

export type { PermissionSeed, RoleSeed };

/**
 * Business-module codes — one generic `example` module ships with the starter to
 * demonstrate the module → permission → nav pattern. Add your own module codes
 * here; each is expanded across `MODULE_ACTIONS` into permission codes.
 */
export const MODULE_CODES = ['example'] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

/** Generic actions granted per module — every module gets the identical shape. */
export const MODULE_ACTIONS = ['view', 'create', 'update', 'delete', 'manage', 'reports'] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

/** Fully-qualified platform.* permission codes. */
const PLATFORM_CODES = [
  'platform.users.read',
  'platform.users.invite',
  'platform.users.manage',
  'platform.users.remove',
  'platform.organizations.manage',
  'platform.organization.delete',
  'platform.branches.read',
  'platform.branches.manage',
  'platform.branches.delete',
  'platform.roles.read',
  'platform.roles.manage',
  'platform.policies.read',
  'platform.policies.manage',
  'platform.subscription.read',
  'platform.subscription.change_plan',
  'platform.subscription.pause',
  'platform.subscription.modules',
  'platform.billing.read',
  'platform.billing.manage',
  'platform.settings.manage',
  'platform.branding.manage',
  'platform.tax.manage',
  'platform.audit.read',
  'platform.audit.export',
  'platform.files.upload',
  'platform.notifications.read',
  'platform.notifications.preferences',
  'platform.api_keys.read',
  'platform.api_keys.manage',
  'platform.webhooks.read',
  'platform.webhooks.manage',
  'platform.webhooks.test',
  'platform.webhooks.replay',
  'platform.credit.read',
  'platform.credit.adjust',
  'platform.members.transfer_ownership',
  'platform.mfa.enforce',
  'platform.mfa.reset',
  'platform.sessions.read_all',
  'platform.sessions.revoke_others',
  'platform.reports.read',
  'platform.reports.export',
];

/** The full catalog: platform codes + one entry per module×action, built by the library. */
const CATALOG = definePermissionCatalog({
  platformCodes: PLATFORM_CODES,
  modules: MODULE_CODES,
  moduleActions: MODULE_ACTIONS,
});

export const ALL_PERMISSIONS: PermissionSeed[] = CATALOG.permissions;
export const ALL_PERMISSION_CODES: string[] = CATALOG.codes;
/** Whether a code exists in the catalog (used by role write-validation). */
export const isKnownPermissionCode = (code: string): boolean => CATALOG.has(code);

/** Reserved for the Owner only — Admin/Manager are denied these, and no custom role may grant them. */
export const DANGER_ZONE_CODES = ['platform.organization.delete', 'platform.members.transfer_ownership'];

const MEMBER_GRANTS = [
  'platform.users.read',
  'platform.branches.read',
  'platform.roles.read',
  'platform.policies.read',
  'platform.subscription.read',
  'platform.notifications.preferences',
];

const CASHIER_GRANTS = ['example.view', 'example.create', 'example.update'];

/**
 * System roles (global: organization_id = null, is_system = true). Owner gets
 * everything; Admin/Manager get everything except the danger zone. Room is left
 * for org-scoped custom roles created through the API.
 */
export const SYSTEM_ROLES: RoleSeed[] = [
  {
    id: 'role_owner',
    name: 'Owner',
    description: 'Full access to the organization, billing, and danger zone.',
    grants: 'ALL',
  },
  {
    id: 'role_admin',
    name: 'Admin',
    description: 'Manage users, settings, and reports. Cannot transfer ownership.',
    grants: ALL_PERMISSION_CODES.filter((c) => !DANGER_ZONE_CODES.includes(c)),
  },
  {
    id: 'role_manager',
    name: 'Manager',
    description: 'All Admin powers plus elevated operational overrides.',
    grants: ALL_PERMISSION_CODES.filter((c) => !DANGER_ZONE_CODES.includes(c)),
  },
  {
    id: 'role_member',
    name: 'Member',
    description: 'Read-only access to most areas. Good for analysts.',
    grants: MEMBER_GRANTS,
  },
  {
    id: 'role_cashier',
    name: 'Cashier',
    description: 'Operate the example module — create and update records within their branch.',
    grants: CASHIER_GRANTS,
  },
];
