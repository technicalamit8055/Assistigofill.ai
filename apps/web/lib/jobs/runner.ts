import 'server-only';

import { logger } from '../api/logger';
import type { AssistigoSupabaseClient } from '../supabase/server';
import type { JobRow } from '../supabase/database.types';
import { handleOcrExtract } from './handlers/ocr-extract';
import type { JobType } from './queue';

/**
 * The job worker.
 * Master spec §17.5; docs/ARCHITECTURE.md §7.
 *
 * Claims a batch under a lease (`claim_jobs`), runs each handler, and reports the outcome back
 * through `complete_job`, which applies the retry/backoff policy in SQL. A crashed worker's
 * jobs come back on their own when the lease expires — no external queue, no orphan locks.
 *
 * Runs with the service-role client, which is a permitted caller (docs/SECURITY.md §2).
 */

type JobHandler = (
  supabase: AssistigoSupabaseClient,
  payload: unknown,
) => Promise<{ ok: true } | { ok: false; error: string }>;

const HANDLERS: Partial<Record<JobType, JobHandler>> = {
  'ocr.extract': handleOcrExtract,
};

export type RunJobsResult = {
  claimed: number;
  completed: number;
  failed: number;
};

export async function runPendingJobs(
  supabase: AssistigoSupabaseClient,
  options: { workerId: string; batchSize?: number; leaseSeconds?: number },
): Promise<RunJobsResult> {
  const { data, error } = await supabase.rpc('claim_jobs', {
    worker_id: options.workerId,
    batch_size: options.batchSize ?? 5,
    lease_seconds: options.leaseSeconds ?? 120,
  });

  if (error) throw error;

  const jobs = (data ?? []) as JobRow[];
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = HANDLERS[job.type as JobType];

    if (!handler) {
      // An unroutable job would otherwise retry until it exhausted its attempts, quietly.
      await supabase.rpc('complete_job', {
        job_id: job.id,
        ok: false,
        error_text: `no handler for type ${job.type}`,
      });
      failed += 1;
      continue;
    }

    try {
      const result = await handler(supabase, job.payload);
      await supabase.rpc('complete_job', {
        job_id: job.id,
        ok: result.ok,
        error_text: result.ok ? null : result.error,
      });
      if (result.ok) completed += 1;
      else failed += 1;
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : 'unknown';
      await supabase.rpc('complete_job', { job_id: job.id, ok: false, error_text: message });
      failed += 1;
      logger.error('jobs.handler_threw', { jobId: job.id, type: job.type, reason: message });
    }
  }

  return { claimed: jobs.length, completed, failed };
}
