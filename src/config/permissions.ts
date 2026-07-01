export interface PermissionSeed {
  code: string;
  module: string;
  description: string;
}

export interface RoleSeed {
  /** Stable id so re-seeding is idempotent and matches the shared DB. */
  id: string;
  name: string;
  description: string;
  /** `'ALL'` grants every permission in the catalog; otherwise an explicit list. */
  grants: 'ALL' | string[];
}

/** Vertical/module codes — a reference catalog for permission code prefixes. */
export const MODULE_CODES = [
  'pos_shop',
  'pos_food_service',
  'pos_clothing',
  'inventory',
  'ecommerce',
  'ads_manager',
  'chat_manager',
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

/** Generic actions granted per module — every module gets the identical shape. */
export const MODULE_ACTIONS = ['view', 'create', 'update', 'delete', 'manage', 'reports'] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

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

/** Turn `pos_shop.inventory.adjust` into a readable "Pos shop — inventory adjust". */
function humanize(code: string): string {
  const [mod, ...rest] = code.split('.');
  const module = (mod ?? '').replace(/_/g, ' ');
  const action = rest.join(' ').replace(/[._]/g, ' ');
  return `${module.charAt(0).toUpperCase()}${module.slice(1)} — ${action}`;
}

function toSeeds(codes: string[]): PermissionSeed[] {
  return codes.map((code) => ({ code, module: code.split('.')[0] ?? 'platform', description: humanize(code) }));
}

/** `{module}.view`, `{module}.create`, ... for one entry per `MODULE_ACTIONS`. */
function moduleCodes(module: ModuleCode): string[] {
  return MODULE_ACTIONS.map((action) => `${module}.${action}`);
}

export const ALL_PERMISSIONS: PermissionSeed[] = [
  ...toSeeds(PLATFORM_CODES),
  ...MODULE_CODES.flatMap((module) => toSeeds(moduleCodes(module))),
];

export const ALL_PERMISSION_CODES: string[] = ALL_PERMISSIONS.map((p) => p.code);

/** Reserved for the Owner only — Admin/Manager are denied these. */
export const DANGER_ZONE_CODES = [
  'platform.organization.delete',
  'platform.members.transfer_ownership',
];

const MEMBER_GRANTS = [
  'platform.users.read',
  'platform.branches.read',
  'platform.roles.read',
  'platform.subscription.read',
  'platform.notifications.preferences',
];

const CASHIER_GRANTS = ['pos_shop.view', 'pos_shop.create', 'pos_shop.update'];

/**
 * System roles (global: organization_id = null, is_system = true). Owner gets
 * everything; Admin/Manager get everything except the danger zone (Manager's extra
 * power would be PIN-gated at the POS-operation level, not by a broader grant).
 * Room is left for org-scoped custom roles.
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
    description: 'Manage users, settings, products, and reports. Cannot transfer ownership.',
    grants: ALL_PERMISSION_CODES.filter((c) => !DANGER_ZONE_CODES.includes(c)),
  },
  {
    id: 'role_manager',
    name: 'Manager',
    description: 'All Admin powers plus PIN-gated POS overrides.',
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
    description: 'Run the shop POS — sell, refund, and view their own sessions.',
    grants: CASHIER_GRANTS,
  },
];
