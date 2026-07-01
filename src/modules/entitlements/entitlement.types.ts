/** A single plan feature flag as surfaced in `/me` entitlements. */
export interface FeatureEntitlement {
  code: string | null;
  included: boolean;
  limit: number | null;
  is_addon: boolean;
}

/**
 * The org's effective entitlements, derived from its subscription + plan. Shape is
 * a superset of what the SPA reads (`modules`, `limits`) so extra fields are safe.
 */
export interface Entitlements {
  status: string | null;
  plan_slug: string | null;
  plan_name: string | null;
  billing_interval: string | null;
  modules: string[];
  features: FeatureEntitlement[];
  limits: Record<string, number>;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_until: string | null;
}

export const EMPTY_ENTITLEMENTS: Entitlements = {
  status: null,
  plan_slug: null,
  plan_name: null,
  billing_interval: null,
  modules: [],
  features: [],
  limits: {},
  trial_end: null,
  current_period_end: null,
  cancel_at_period_end: false,
  grace_until: null,
};
