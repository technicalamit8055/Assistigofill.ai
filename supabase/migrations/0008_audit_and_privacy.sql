-- =============================================================================
-- 0008  Audit logs, consent records, support access grants, data requests
-- Master spec §19.2, §19.5, §19.9 (support access), §18.2
-- =============================================================================

create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete set null,
  actor_user_id    uuid references auth.users (id) on delete set null,
  actor_type       text not null default 'user'
                     check (actor_type in ('user', 'extension', 'system', 'support', 'webhook')),
  action           text not null,
  entity_type      text not null,
  entity_id        uuid,
  sensitivity      text not null default 'normal'
                     check (sensitivity in ('normal', 'sensitive', 'critical')),
  ip_address       inet,
  user_agent       text,
  -- Must already be redacted by packages/core/src/privacy/redact.ts before insert.
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

comment on table public.audit_logs is
  'Insert-only. No update or delete policy exists for any role (spec §19.5).';

create index audit_logs_org_recent_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (organization_id, entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (organization_id, action, created_at desc);

-- Even the service role should not be quietly rewriting history.
create or replace function public.forbid_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ASSISTIGO_AUDIT_IMMUTABLE: audit_logs is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.forbid_audit_mutation();

-- -----------------------------------------------------------------------------
-- consent_records (§19.2)
-- -----------------------------------------------------------------------------
create table public.consent_records (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  customer_id          uuid references public.customers (id) on delete cascade,
  consent_subject      text not null
                         check (consent_subject in ('customer_data', 'document_storage', 'ai_processing')),
  consent_text_version text not null,
  status               text not null default 'granted' check (status in ('granted', 'withdrawn')),
  collected_by         uuid references auth.users (id) on delete set null,
  collected_at         timestamptz not null default now(),
  withdrawn_at         timestamptz,
  -- How consent was taken: in person, signed form reference, etc. No biometric data.
  evidence_json        jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),

  constraint consent_withdrawn_has_timestamp
    check (status <> 'withdrawn' or withdrawn_at is not null)
);

create index consent_records_customer_idx
  on public.consent_records (organization_id, customer_id, consent_subject);

-- -----------------------------------------------------------------------------
-- support_access_grants (§6.1, §19.9)
-- Internal staff have no standing access to customer data.
-- -----------------------------------------------------------------------------
create table public.support_access_grants (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  granted_to       uuid not null references auth.users (id) on delete cascade,
  reason           text not null check (length(btrim(reason)) >= 10),
  scope            text not null default 'metadata'
                     check (scope in ('metadata', 'customer_records', 'documents')),
  approved_by      uuid references auth.users (id) on delete set null,
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),

  constraint support_grant_is_time_boxed
    check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);

create index support_access_grants_active_idx
  on public.support_access_grants (granted_to, organization_id, expires_at);

create or replace function public.has_support_access(org uuid, required_scope text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_access_grants g
    where g.organization_id = org
      and g.granted_to = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
      and (
        g.scope = required_scope
        or (required_scope = 'metadata' and g.scope in ('customer_records', 'documents'))
        or (required_scope = 'customer_records' and g.scope = 'documents')
      )
  );
$$;

revoke execute on function public.has_support_access(uuid, text) from public;
grant execute on function public.has_support_access(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- data_requests — export and erasure (§19.10)
-- -----------------------------------------------------------------------------
create table public.data_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid references public.customers (id) on delete set null,
  request_type     text not null check (request_type in ('export', 'delete')),
  scope            text not null default 'customer' check (scope in ('customer', 'organization')),
  status           text not null default 'pending'
                     check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  requested_by     uuid references auth.users (id) on delete set null,
  reason           text,
  result_path      text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index data_requests_org_idx on public.data_requests (organization_id, status);

create trigger data_requests_set_updated_at
  before update on public.data_requests
  for each row execute function public.set_updated_at();
