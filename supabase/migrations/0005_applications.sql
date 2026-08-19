-- =============================================================================
-- 0005  Applications, status history, document checklist
-- Master spec §21, §18.2
-- =============================================================================

create table public.applications (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  customer_id              uuid not null references public.customers (id) on delete cascade,
  portal_adapter_id        uuid,

  title                    text not null check (length(btrim(title)) >= 2),
  category                 text not null default 'other'
                             check (category in ('government', 'recruitment', 'scholarship',
                                                 'education', 'banking', 'certificate',
                                                 'utility', 'other')),
  status                   text not null default 'draft'
                             check (status in ('draft', 'pending_documents', 'ready_to_fill',
                                               'filled', 'submitted', 'pending_followup',
                                               'approved', 'rejected', 'cancelled')),

  portal_name              text,
  form_name                text,
  portal_url               text,
  -- The reference the *portal* issued. Assistigo does not invent or verify this (§21.4).
  portal_reference_number  text,

  deadline_at              timestamptz,
  amount_charged           numeric(10, 2) check (amount_charged is null or amount_charged >= 0),
  payment_status           text check (payment_status in ('unpaid', 'paid', 'refunded')),

  assigned_to              uuid references auth.users (id) on delete set null,
  notes                    text,

  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create index applications_status_idx on public.applications (organization_id, status);
create index applications_customer_idx on public.applications (organization_id, customer_id);
create index applications_deadline_idx on public.applications (organization_id, deadline_at)
  where deadline_at is not null;
create index applications_assigned_idx on public.applications (organization_id, assigned_to);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- Now that applications exists, wire up the deferred references from 0004.
alter table public.documents
  add constraint documents_application_fk
  foreign key (application_id) references public.applications (id) on delete set null;

alter table public.document_derivatives
  add constraint document_derivatives_application_fk
  foreign key (application_id) references public.applications (id) on delete set null;

-- -----------------------------------------------------------------------------
-- application_status_events — append-only history (§21.4)
-- -----------------------------------------------------------------------------
create table public.application_status_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  application_id   uuid not null references public.applications (id) on delete cascade,
  old_status       text,
  new_status       text not null,
  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index application_status_events_application_idx
  on public.application_status_events (organization_id, application_id, created_at desc);

-- Record every status change automatically so history cannot be forgotten by a code path.
create or replace function public.record_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_events
      (organization_id, application_id, old_status, new_status, created_by)
    values (new.organization_id, new.id, null, new.status, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.application_status_events
      (organization_id, application_id, old_status, new_status, created_by)
    values (new.organization_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger applications_record_status_change
  after insert or update of status on public.applications
  for each row execute function public.record_application_status_change();

-- -----------------------------------------------------------------------------
-- application_documents — the required-document checklist
-- -----------------------------------------------------------------------------
create table public.application_documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  application_id   uuid not null references public.applications (id) on delete cascade,
  document_id      uuid references public.documents (id) on delete set null,
  derivative_id    uuid references public.document_derivatives (id) on delete set null,
  requirement_key  text not null,
  requirement_label text,
  preset_id        uuid references public.document_requirement_presets (id) on delete set null,
  status           text not null default 'required'
                     check (status in ('required', 'attached', 'missing', 'rejected')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (application_id, requirement_key)
);

create index application_documents_application_idx
  on public.application_documents (organization_id, application_id);

create trigger application_documents_set_updated_at
  before update on public.application_documents
  for each row execute function public.set_updated_at();
