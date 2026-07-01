import { ACTIVE_SUBSCRIPTION_STATUSES, cacheKeys } from '@/config/constants';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { redis } from '@/infra/redis';
import { type EntitlementRepository, entitlementRepository } from '@/modules/entitlements/entitlement.repository';
import { EMPTY_ENTITLEMENTS, type Entitlements } from '@/modules/entitlements/entitlement.types';

/**
 * Computes the org's entitlements from its subscription + plan, cached in Redis
 * (`entitlements:{orgId}`, TTL from REDIS_CACHE_TTL) since it's read on nearly
 * every `requireModule`-guarded request. Mutating a subscription should call
 * `invalidate(orgId)`. Redis failures degrade gracefully to a live DB build.
 */
export class EntitlementService {
  constructor(private readonly repo: EntitlementRepository = entitlementRepository) {}

  async getEntitlements(organizationId: string): Promise<Entitlements> {
    const key = cacheKeys.entitlements(organizationId);
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as Entitlements;
    } catch (err) {
      logger.warn({ err, organizationId }, 'Entitlements cache read failed; rebuilding');
    }

    const built = await this.build(organizationId);

    try {
      await redis.set(key, JSON.stringify(built), 'EX', env.REDIS_CACHE_TTL);
    } catch (err) {
      logger.warn({ err, organizationId }, 'Entitlements cache write failed');
    }
    return built;
  }

  async canUseModule(organizationId: string, moduleCode: string): Promise<boolean> {
    const ent = await this.getEntitlements(organizationId);
    return ent.modules.includes(moduleCode);
  }

  async invalidate(organizationId: string): Promise<void> {
    try {
      await redis.del(cacheKeys.entitlements(organizationId));
    } catch (err) {
      logger.warn({ err, organizationId }, 'Entitlements cache invalidation failed');
    }
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
