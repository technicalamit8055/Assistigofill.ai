-- =============================================================================
-- 0009  Background jobs
-- Master spec §17.5; docs/ARCHITECTURE.md §7
--
-- A jobs table rather than an external queue, because the MVP hosting target is
-- Vercel + Supabase. Handlers must be idempotent.
-- =============================================================================

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade,
  type             text not null
                     check (type in ('ocr.extract', 'document.derivative', 'retention.sweep',
                                     'billing.aggregate', 'adapter.healthcheck',
                                     'notification.send', 'data.export', 'data.delete')),
  -- Entity ids and options only. Never customer values.
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'pending'
                     check (status in ('pending', 'running', 'retry', 'completed', 'failed', 'cancelled')),
  attempts         int not null default 0,
  max_attempts     int not null default 5,
  run_after        timestamptz not null default now(),
  locked_until     timestamptz,
  locked_by        text,
  last_error       text,
  -- Deduplication key so producing the same job twice is harmless.
  idempotency_key  text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create unique index jobs_idempotency_idx
  on public.jobs (type, idempotency_key)
  where idempotency_key is not null and status in ('pending', 'running', 'retry');

create index jobs_claimable_idx
  on public.jobs (run_after)
  where status in ('pending', 'retry');

create index jobs_org_idx on public.jobs (organization_id, status, created_at desc);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Claim jobs with a lease. SKIP LOCKED lets several workers run without stepping
-- on each other; locked_until means a crashed worker's jobs come back on their own.
-- service_role only — the worker is the sole caller.
-- -----------------------------------------------------------------------------
create or replace function public.claim_jobs(
  worker_id text,
  batch_size int default 5,
  lease_seconds int default 120
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select j.id
    from public.jobs j
    where j.status in ('pending', 'retry')
      and j.run_after <= now()
      and (j.locked_until is null or j.locked_until < now())
    order by j.run_after
    for update skip locked
    limit batch_size
  )
  update public.jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_by = worker_id,
         locked_until = now() + make_interval(secs => lease_seconds),
         updated_at = now()
    from claimable c
   where j.id = c.id
  returning j.*;
end;
$$;

revoke execute on function public.claim_jobs(text, int, int) from public, authenticated;
grant execute on function public.claim_jobs(text, int, int) to service_role;

create or replace function public.complete_job(job_id uuid, ok boolean, error_text text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.jobs;
begin
  select * into job from public.jobs where id = job_id for update;
  if job is null then
    return;
  end if;

  if ok then
    update public.jobs
       set status = 'completed', completed_at = now(), locked_until = null,
           locked_by = null, last_error = null
     where id = job_id;
  elsif job.attempts >= job.max_attempts then
    update public.jobs
       set status = 'failed', locked_until = null, locked_by = null, last_error = error_text
     where id = job_id;
  else
    -- Exponential backoff: 30s, 60s, 120s, 240s …
    update public.jobs
       set status = 'retry',
           locked_until = null,
           locked_by = null,
           last_error = error_text,
           run_after = now() + make_interval(secs => 30 * power(2, job.attempts)::int)
     where id = job_id;
  end if;
end;
$$;

revoke execute on function public.complete_job(uuid, boolean, text) from public, authenticated;
grant execute on function public.complete_job(uuid, boolean, text) to service_role;
