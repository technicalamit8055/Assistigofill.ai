import 'server-only';

import type { AssistigoSupabaseClient } from '../supabase/server';
import { logger } from '../api/logger';

/**
 * Job enqueueing.
 * Master spec §17.5; docs/ARCHITECTURE.md §7. The table and the claim/complete functions live
 * in supabase/migrations/0009_jobs.sql.
 *
 * Payloads carry entity ids and options only — never customer values (§24.2).
 */

export type JobType =
  | 'ocr.extract'
  | 'document.derivative'
  | 'retention.sweep'
  | 'billing.aggregate'
  | 'adapter.healthcheck'
  | 'notification.send'
  | 'data.export'
  | 'data.delete';

/**
 * Job types an operator may queue from a request. The rest are scheduled infrastructure and
 * stay service-role only — mirrored by the same whitelist inside the `enqueue_job` function,
 * which is the gate that actually enforces it (0014).
 */
export type OperatorJobType = Extract<JobType, 'ocr.extract' | 'document.derivative'>;

export type EnqueueInput = {
  type: OperatorJobType;
  organizationId: string;
  payload: Record<string, string | number | boolean | null>;
  /**
   * Deduplication key. Enqueuing the same work twice while it is still in flight is a no-op,
   * which is what makes "click Process again" harmless.
   */
  idempotencyKey?: string;
};

/**
 * Queues a job.
 *
 * Goes through the `enqueue_job` RPC rather than inserting directly, because `jobs` has RLS
 * enabled and no policies (0010) — it is service-role territory. The RPC is `security definer`
 * and re-checks the caller's membership and role in the database, so authorization is still
 * enforced twice: once in the route handler, once in Postgres (docs/SECURITY.md §2).
 *
 * Returns `deduplicated: true` when an identical job is already in flight.
 */
export async function enqueueJob(
  supabase: AssistigoSupabaseClient,
  input: EnqueueInput,
): Promise<{ id: string; deduplicated: boolean }> {
  const { data, error } = await supabase.rpc('enqueue_job', {
    p_type: input.type,
    p_organization_id: input.organizationId,
    p_payload: input.payload,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    logger.error('jobs.enqueue_failed', { type: input.type, dbError: error.message });
    throw error;
  }

  // The function returns null when it found the same work already queued.
  const id = typeof data === 'string' ? data : null;
  return id === null ? { id: '', deduplicated: true } : { id, deduplicated: false };
}
