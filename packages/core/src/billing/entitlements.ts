/**
 * Entitlement checks. Master spec §22.3, §22.4.
 *
 * Two rules drive everything here:
 *   1. Limits are enforced server-side, never in the UI alone.
 *   2. Running out of credit degrades the product; it never deletes data and never blocks
 *      reading what the operator already has.
 */

import {
  PLANS,
  STATUSES_WITH_METERED_ACCESS,
  getPlan,
  type PlanDefinition,
  type SubscriptionStatus,
  type UsageEventType,
} from './plans';

export type EntitlementContext = {
  planCode: string | null | undefined;
  subscriptionStatus: SubscriptionStatus | null | undefined;
  /** Usage already recorded in the current billing period. */
  usage: Partial<Record<UsageEventType, number>>;
  seatsInUse: number;
  customerCount: number;
  storageUsedMb: number;
};

export type EntitlementDecision =
  | { allowed: true; remaining: number | null; plan: PlanDefinition }
  | {
      allowed: false;
      remaining: 0;
      plan: PlanDefinition;
      /** Translation key for the operator-facing message. */
      reason:
        | 'billing.limit.fills'
        | 'billing.limit.ai_extractions'
        | 'billing.limit.seats'
        | 'billing.limit.customers'
        | 'billing.limit.storage'
        | 'billing.limit.payment_required'
        | 'billing.limit.feature_not_in_plan';
    };

function allow(plan: PlanDefinition, remaining: number | null): EntitlementDecision {
  return { allowed: true, remaining, plan };
}

function deny(
  plan: PlanDefinition,
  reason: Extract<EntitlementDecision, { allowed: false }>['reason'],
): EntitlementDecision {
  return { allowed: false, remaining: 0, plan, reason };
}

/** Metered actions require a paid-up subscription; the free plan is always "paid up". */
function hasMeteredAccess(
  plan: PlanDefinition,
  status: SubscriptionStatus | null | undefined,
): boolean {
  if (plan.code === 'free') return true;
  return status ? STATUSES_WITH_METERED_ACCESS.includes(status) : false;
}

export function checkUsageEntitlement(
  context: EntitlementContext,
  eventType: UsageEventType,
  quantity = 1,
): EntitlementDecision {
  const plan = getPlan(context.planCode);

  if (!hasMeteredAccess(plan, context.subscriptionStatus)) {
    return deny(plan, 'billing.limit.payment_required');
  }

  const used = context.usage[eventType] ?? 0;

  switch (eventType) {
    case 'fill': {
      if (plan.includedFills === null) return allow(plan, null);
      const remaining = plan.includedFills - used;
      return remaining >= quantity
        ? allow(plan, remaining - quantity)
        : deny(plan, 'billing.limit.fills');
    }
    case 'ai_extraction': {
      if (plan.includedAiExtractions === null) return allow(plan, null);
      const remaining = plan.includedAiExtractions - used;
      return remaining >= quantity
        ? allow(plan, remaining - quantity)
        : deny(plan, 'billing.limit.ai_extractions');
    }
    case 'seat': {
      const remaining = plan.includedSeats - context.seatsInUse;
      return remaining >= quantity
        ? allow(plan, remaining - quantity)
        : deny(plan, 'billing.limit.seats');
    }
    case 'storage': {
      const remaining = plan.storageMb - context.storageUsedMb;
      return remaining >= quantity
        ? allow(plan, remaining - quantity)
        : deny(plan, 'billing.limit.storage');
    }
    case 'document_tool':
      // Document preparation is unmetered: it is the sticky habit, not the revenue lever.
      return allow(plan, null);
    default:
      return allow(plan, null);
  }
}

export function checkCustomerLimit(context: EntitlementContext): EntitlementDecision {
  const plan = getPlan(context.planCode);
  if (plan.maxCustomers === null) return allow(plan, null);
  const remaining = plan.maxCustomers - context.customerCount;
  return remaining > 0 ? allow(plan, remaining) : deny(plan, 'billing.limit.customers');
}

export function checkFeature(
  context: EntitlementContext,
  feature: keyof PlanDefinition['features'],
): EntitlementDecision {
  const plan = getPlan(context.planCode);
  const value = plan.features[feature];
  const enabled = typeof value === 'boolean' ? value : true;
  return enabled ? allow(plan, null) : deny(plan, 'billing.limit.feature_not_in_plan');
}

/** Summary used by the billing page and the dashboard usage widget. */
export type UsageSummary = {
  planCode: string;
  planName: { en: string; hi: string };
  items: {
    key: UsageEventType | 'customers' | 'storage_mb';
    used: number;
    included: number | null;
    /** 0–1, or null when the allowance is unlimited. */
    ratio: number | null;
  }[];
};

export function buildUsageSummary(context: EntitlementContext): UsageSummary {
  const plan = getPlan(context.planCode);
  const item = (
    key: UsageSummary['items'][number]['key'],
    used: number,
    included: number | null,
  ) => ({
    key,
    used,
    included,
    ratio: included === null || included === 0 ? null : Math.min(1, used / included),
  });

  return {
    planCode: plan.code,
    planName: plan.name,
    items: [
      item('fill', context.usage.fill ?? 0, plan.includedFills),
      item('ai_extraction', context.usage.ai_extraction ?? 0, plan.includedAiExtractions),
      item('seat', context.seatsInUse, plan.includedSeats),
      item('customers', context.customerCount, plan.maxCustomers),
      item('storage_mb', context.storageUsedMb, plan.storageMb),
    ],
  };
}

export const ALL_PLANS = Object.values(PLANS);
