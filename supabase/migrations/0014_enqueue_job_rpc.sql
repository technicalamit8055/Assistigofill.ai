-- =============================================================================
-- 0014  enqueue_job — the one way an operator can queue background work
-- Master spec §17.5; docs/SECURITY.md §2
--
-- `jobs` has RLS enabled and deliberately no policies (0010): it is service-role territory,
-- because a table that drives background execution is not something a tenant should be able to
-- write to freely. But an operator pressing "Read this document" genuinely does need to queue an
-- `ocr.extract`, and doing that with the service-role client from a route handler would put RLS
-- behind a single application-code check instead of two gates.
--
-- So this follows the same shape as `create_organization` in 0011: the table stays closed, and
-- one `security definer` function provides a narrow, validated entry point that re-checks
-- membership in the database.
-- =============================================================================

-- Job types an operator may trigger. Everything else — retention sweeps, billing aggregation,
-- adapter health checks — is scheduled infrastructure and stays service-role only.
create or replace function public.enqueue_job(
  p_type            text,
  p_organization_id uuid,
  p_payload         jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor    uuid := auth.uid();
  existing uuid;
  new_id   uuid;
begin
  if actor is null then
    raise exception 'ASSISTIGO_UNAUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  if p_type not in ('ocr.extract', 'document.derivative') then
    raise exception 'ASSISTIGO_JOB_TYPE_NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  -- Same roles that may upload a document may queue work about it (docs/SECURITY.md §3).
  if not public.has_org_role(p_organization_id, array['owner', 'manager', 'operator']) then
    raise exception 'ASSISTIGO_FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  -- Deduplicate against work that is still in flight, so pressing the button twice is harmless.
  if p_idempotency_key is not null then
    select j.id into existing
    from public.jobs j
    where j.type = p_type
      and j.idempotency_key = p_idempotency_key
      and j.status in ('pending', 'running', 'retry')
    limit 1;

    if existing is not null then
      return null;
    end if;
  end if;

  insert into public.jobs (organization_id, type, payload, idempotency_key, created_by)
  values (p_organization_id, p_type, coalesce(p_payload, '{}'::jsonb), p_idempotency_key, actor)
  returning id into new_id;

  return new_id;

exception
  -- Two requests raced past the check above; the partial unique index caught the second one.
  -- That is the deduplication working, not a failure.
  when unique_violation then
    return null;
end;
$$;

revoke execute on function public.enqueue_job(text, uuid, jsonb, text) from public;
grant execute on function public.enqueue_job(text, uuid, jsonb, text) to authenticated, service_role;
