import { BaseRepository } from '@/infra/prisma';

export class EntitlementRepository extends BaseRepository {
  /** The org's subscription with everything needed to compute entitlements. */
  findSubscription(organizationId: string) {
    return this.db.organizationSubscription.findUnique({
      where: { organization_id: organizationId },
      include: {
        subscription_modules: true,
        plan: { include: { plan_limits: true, plan_features: true } },
      },
    });
  }
}

export const entitlementRepository = new EntitlementRepository();
