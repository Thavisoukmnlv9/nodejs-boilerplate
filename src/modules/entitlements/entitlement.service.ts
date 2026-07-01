import { ACTIVE_SUBSCRIPTION_STATUSES } from '@/config/constants';
import { env } from '@/config/env';
import { type EntitlementRepository, entitlementRepository } from '@/modules/entitlements/entitlement.repository';
import { EMPTY_ENTITLEMENTS, type Entitlements } from '@/modules/entitlements/entitlement.types';

/**
 * Computes an org's entitlements from its subscription + plan. Read on nearly every
 * `requireModule`-guarded request, so results are cached IN-MEMORY with a short TTL
 * (ENTITLEMENTS_CACHE_TTL). Mutating a subscription should call `invalidate(orgId)`.
 *
 * The cache is per-instance (single-host target). To scale horizontally and keep
 * caches coherent, move this behind a shared cache (Redis) — only this file changes.
 */
interface CacheEntry {
  value: Entitlements;
  expiresAt: number;
}

export class EntitlementService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly repo: EntitlementRepository = entitlementRepository) {}

  async getEntitlements(organizationId: string): Promise<Entitlements> {
    const hit = this.cache.get(organizationId);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await this.build(organizationId);
    this.cache.set(organizationId, { value, expiresAt: Date.now() + env.ENTITLEMENTS_CACHE_TTL * 1000 });
    return value;
  }

  async canUseModule(organizationId: string, moduleCode: string): Promise<boolean> {
    const ent = await this.getEntitlements(organizationId);
    return ent.modules.includes(moduleCode);
  }

  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  private async build(organizationId: string): Promise<Entitlements> {
    const sub = await this.repo.findSubscription(organizationId);

    // No subscription, or not in an entitling state → no modules/features/limits.
    if (!sub || !sub.status || !ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status as never)) {
      return {
        ...EMPTY_ENTITLEMENTS,
        status: sub?.status ?? null,
        grace_until: sub?.grace_until?.toISOString() ?? null,
      };
    }

    const modules = (sub.subscription_modules ?? [])
      .filter((m) => m.enabled && !m.deleted_at && m.module_code)
      .map((m) => m.module_code as string);

    const limits: Record<string, number> = {};
    for (const pl of sub.plan?.plan_limits ?? []) {
      if (pl.deleted_at || !pl.limit_key || pl.limit_value == null) continue;
      limits[pl.limit_key] = pl.limit_value;
    }

    const features = (sub.plan?.plan_features ?? [])
      .filter((pf) => !pf.deleted_at)
      .map((pf) => ({
        code: pf.feature_code,
        included: pf.included,
        limit: pf.limit_value,
        is_addon: pf.is_addon,
      }));

    return {
      status: sub.status,
      plan_slug: sub.plan?.slug ?? null,
      plan_name: sub.plan?.name ?? null,
      billing_interval: sub.billing_interval ?? null,
      modules,
      features,
      limits,
      trial_end: sub.trial_end?.toISOString() ?? null,
      current_period_end: sub.current_period_end?.toISOString() ?? null,
      cancel_at_period_end: sub.cancel_at_period_end,
      grace_until: sub.grace_until?.toISOString() ?? null,
    };
  }
}

export const entitlementService = new EntitlementService();
