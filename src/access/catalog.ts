/**
 * Permission-catalog mechanics (library-owned). The *content* — which platform
 * codes and modules exist — is app-specific and lives in `src/config/permissions.ts`,
 * which calls `definePermissionCatalog(...)`. This split lets another app reuse the
 * catalog machinery while defining its own permission surface.
 */

export interface PermissionSeed {
  code: string;
  module: string;
  description: string;
}

export interface RoleSeed {
  /** Stable id so re-seeding is idempotent. */
  id: string;
  name: string;
  description: string;
  /** `'ALL'` grants every code in the catalog; otherwise an explicit list. */
  grants: 'ALL' | string[];
}

/** `pos_shop.inventory.adjust` → "Pos shop — inventory adjust". */
export function humanize(code: string): string {
  const [mod, ...rest] = code.split('.');
  const module = (mod ?? '').replace(/_/g, ' ');
  const action = rest.join(' ').replace(/[._]/g, ' ');
  return `${module.charAt(0).toUpperCase()}${module.slice(1)} — ${action}`;
}

export function permissionSeedsFromCodes(codes: string[]): PermissionSeed[] {
  return codes.map((code) => ({ code, module: code.split('.')[0] ?? 'platform', description: humanize(code) }));
}

/** `{module}.{action}` for each action, e.g. `pos_shop.view`, `pos_shop.create`… */
export function moduleActionCodes(module: string, actions: readonly string[]): string[] {
  return actions.map((action) => `${module}.${action}`);
}

export interface CatalogInput {
  /** Fully-qualified platform.* codes. */
  platformCodes: string[];
  /** Business module prefixes, each expanded across `moduleActions`. */
  modules: readonly string[];
  moduleActions: readonly string[];
}

export interface PermissionCatalog {
  permissions: PermissionSeed[];
  codes: string[];
  codeSet: ReadonlySet<string>;
  has(code: string): boolean;
}

/** Build the full catalog from platform codes + a module×action matrix. */
export function definePermissionCatalog(input: CatalogInput): PermissionCatalog {
  const permissions: PermissionSeed[] = [
    ...permissionSeedsFromCodes(input.platformCodes),
    ...input.modules.flatMap((m) => permissionSeedsFromCodes(moduleActionCodes(m, input.moduleActions))),
  ];
  const codes = permissions.map((p) => p.code);
  const codeSet = new Set(codes);
  return { permissions, codes, codeSet, has: (code) => codeSet.has(code) };
}
