/**
 * RBAC catalog — the representative subset we seed. Structured so that ADDING A
 * MODULE = add its codes + grant them to roles; nothing else changes.
 *
 * Codes and grants are copied from the reference seed
 * (`business-sync-backend-services/scripts/seeds/{permission,role}.py`). Shape is
 * `{module}.{action}` or `{module}.{resource}.{action}`. We ship the full
 * platform.* core set, one POS vertical (pos_shop.*), and inventory.* — the other
 * verticals (pos_food_service, pos_clothing, ecommerce, ads_manager, chat_manager)
 * follow the identical pattern.
 */

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

/** Subscription module codes (drive `requireModule` + entitlements). */
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

const POS_SHOP_CODES = [
  'pos_shop.sell',
  'pos_shop.refund',
  'pos_shop.manage_session',
  'pos_shop.view_reports',
  'pos_shop.manage',
  'pos_shop.products',
  'pos_shop.variants',
  'pos_shop.categories',
  'pos_shop.barcodes',
  'pos_shop.inventory',
  'pos_shop.inventory.adjust',
  'pos_shop.inventory.receive',
  'pos_shop.inventory.damage',
  'pos_shop.inventory.damage.approve',
  'pos_shop.inventory.settings',
  'pos_shop.stock_transfers',
  'pos_shop.purchase_orders',
  'pos_shop.suppliers',
  'pos_shop.customers',
  'pos_shop.loyalty',
  'pos_shop.pricing',
  'pos_shop.promotions',
  'pos_shop.branches',
  'pos_shop.devices',
  'pos_shop.shifts',
  'pos_shop.tax',
  'pos_shop.settings',
  'pos_shop.bill_config',
  'pos_shop.customer_orders',
  'pos_shop.holds',
  'pos_shop.sales',
  'pos_shop.returns',
  'pos_shop.reports',
  'pos_shop.dashboard',
  'pos_shop.audit',
  'pos_shop.alerts',
  'pos_shop.trash_view',
  'pos_shop.restore',
  'pos_shop.permanent_delete',
];

const INVENTORY_CODES = [
  'inventory.view',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.approve_transfer',
  'inventory.view_ledger',
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

export const ALL_PERMISSIONS: PermissionSeed[] = [
  ...toSeeds(PLATFORM_CODES),
  ...toSeeds(POS_SHOP_CODES),
  ...toSeeds(INVENTORY_CODES),
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

const CASHIER_GRANTS = ['pos_shop.sell', 'pos_shop.refund', 'pos_shop.customer_orders'];

/**
 * System roles (global: organization_id = null, is_system = true). Owner gets
 * everything; Admin/Manager get everything except the danger zone (Manager's extra
 * power is PIN-gated at the POS-operation level via the manager_pin token, not by
 * a broader grant). Room is left for org-scoped custom roles.
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
