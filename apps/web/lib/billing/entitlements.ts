import 'server-only';

import type { EntitlementContext, UsageEventType } from '@assistigo/core';
import type { RequestContext } from '../api/context';
import { logger } from '../api/logger';

/**
 * Loads the numbers the entitlement checks need.
 * Master spec §22.3 — limits are enforced server-side, never in the UI alone.
 */
export async function loadEntitlementContext(context: RequestContext): Promise<EntitlementContext> {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);

  const [usageResult, subscriptionResult, seatsResult, customersResult] = await Promise.all([
    context.supabase.rpc('usage_since', {
      org: context.organization.id,
      since: periodStart.toISOString(),
    }),
    context.supabase
      .from('subscriptions')
      .select('status')
      .eq('organization_id', context.organization.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle(),
    context.supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.organization.id)
      .eq('status', 'active'),
    context.supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null),
  ]);

  const usage: Partial<Record<UsageEventType, number>> = {};
  for (const row of (usageResult.data ?? []) as { event_type: UsageEventType; total: number }[]) {
    usage[row.event_type] = Number(row.total);
  }

  return {
    planCode: context.organization.plan_code,
    subscriptionStatus:
      (subscriptionResult.data?.status as EntitlementContext['subscriptionStatus']) ?? null,
    usage,
    seatsInUse: seatsResult.count ?? 0,
    customerCount: customersResult.count ?? 0,
    // Storage accounting arrives with Phase 3; until documents exist there is nothing to count.
    storageUsedMb: 0,
  };
}

/**
 * Records a billable action.
 *
 * Deliberately fire-and-forget at the transport level: losing a usage row costs a fraction of a
 * rupee, while failing the operator's fill because the meter did not write costs them a
 * customer standing at the counter (§22.4).
 */
export async function recordUsage(
  context: RequestContext,
  eventType: UsageEventType,
  quantity = 1,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await context.supabase.from('usage_events').insert({
    organization_id: context.organization.id,
    user_id: context.userId,
    event_type: eventType,
    quantity,
    metadata,
  });

  if (error) logger.error('usage.record_failed', { eventType, dbError: error.message });
}
