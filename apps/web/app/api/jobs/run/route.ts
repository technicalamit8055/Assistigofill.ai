import { timingSafeEqual } from 'node:crypto';
import { unauthenticated } from '@assistigo/core';
import { handler, ok } from '@/lib/api/response';
import { runPendingJobs } from '@/lib/jobs/runner';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';

/**
 * POST /api/jobs/run — drain the job queue.
 * Master spec §17.5; docs/ARCHITECTURE.md §7.
 *
 * Called by a scheduler (Vercel Cron or equivalent), never by a browser. It runs with the
 * service-role client, which bypasses RLS, so authorization here is the only gate — and it
 * fails closed: with no `JOB_RUNNER_SECRET` configured the endpoint refuses everything rather
 * than running unauthenticated work.
 */

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const POST = handler('api.jobs.run', async (request) => {
  const expected = serverEnv().JOB_RUNNER_SECRET;
  if (!expected) throw unauthenticated('errors.unauthenticated');

  const header = request.headers.get('authorization') ?? '';
  const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (provided === '' || !secretMatches(provided, expected)) {
    throw unauthenticated('errors.unauthenticated');
  }

  const result = await runPendingJobs(createSupabaseAdminClient(), {
    workerId: `web-${process.env.VERCEL_REGION ?? 'local'}`,
  });

  return ok(result);
});
