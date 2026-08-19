-- =============================================================================
-- 0006  Portal adapters, fill sessions, form reports, org field mappings
-- Master spec §14, §18.2
-- =============================================================================

-- organization_id null = global adapter shipped by Assistigo.
create table public.portal_adapters (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references public.organizations (id) on delete cascade,
  slug                  text not null,
  portal_name           text not null,
  form_name             text not null,
  region                text,
  url_patterns          text[] not null default '{}',
  version               text not null default '1.0.0',
  status                text not null default 'draft'
                          check (status in ('draft', 'testing', 'active', 'deprecated')),
  field_mappings        jsonb not null default '[]'::jsonb,
  document_requirements jsonb not null default '[]'::jsonb,
  notes                 text,
  known_issues          text,
  last_verified_at      timestamptz,
  -- Rolling health signal fed by fill sessions and the adapter.healthcheck job.
  health                jsonb not null default '{"successRate": null, "lastFailureAt": null}'::jsonb,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index portal_adapters_global_slug_idx
  on public.portal_adapters (slug) where organization_id is null;
create unique index portal_adapters_org_slug_idx
  on public.portal_adapters (organization_id, slug) where organization_id is not null;
create index portal_adapters_status_idx on public.portal_adapters (status);

create trigger portal_adapters_set_updated_at
  before update on public.portal_adapters
  for each row execute function public.set_updated_at();

alter table public.applications
  add constraint applications_portal_adapter_fk
  foreign key (portal_adapter_id) references public.portal_adapters (id) on delete set null;

-- -----------------------------------------------------------------------------
-- org_field_mappings — an organization's own override for a portal field
-- (priority 2 in the mapping strategy, docs/FORM_ENGINE.md §3)
-- -----------------------------------------------------------------------------
create table public.org_field_mappings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  page_origin      text not null,
  field_signature  text not null,
  customer_field   text not null check (customer_field like 'customer.%'),
  transform        text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, page_origin, field_signature)
);

create trigger org_field_mappings_set_updated_at
  before update on public.org_field_mappings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- fill_sessions
-- -----------------------------------------------------------------------------
create table public.fill_sessions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  customer_id            uuid not null references public.customers (id) on delete cascade,
  application_id         uuid references public.applications (id) on delete set null,
  portal_adapter_id      uuid references public.portal_adapters (id) on delete set null,

  page_origin            text not null,
  page_path              text,
  page_title             text,

  detected_fields_count  int not null default 0,
  proposed_fields_count  int not null default 0,
  filled_fields_count    int not null default 0,
  skipped_fields_count   int not null default 0,
  review_required_count  int not null default 0,
  -- Counted separately so we can prove, from data, that these are never filled (§19.7).
  captcha_fields_count   int not null default 0,
  otp_fields_count       int not null default 0,
  payment_fields_count   int not null default 0,

  status                 text not null default 'detected'
                           check (status in ('detected', 'reviewed', 'filled', 'failed', 'cancelled')),
  error_summary          text,
  extension_version      text,

  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on column public.fill_sessions.page_origin is
  'Origin + path only. The full query string may carry PII and is not stored.';

create index fill_sessions_recent_idx on public.fill_sessions (organization_id, created_at desc);
create index fill_sessions_customer_idx on public.fill_sessions (organization_id, customer_id);
create index fill_sessions_adapter_idx on public.fill_sessions (portal_adapter_id, status);

create trigger fill_sessions_set_updated_at
  before update on public.fill_sessions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- fill_session_fields
-- -----------------------------------------------------------------------------
create table public.fill_session_fields (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  fill_session_id        uuid not null references public.fill_sessions (id) on delete cascade,

  field_signature        text not null,
  field_label            text,
  input_type             text not null,
  mapped_customer_field  text,
  mapping_source         text check (mapping_source in
                           ('adapter', 'org_custom', 'history', 'dictionary', 'ai', 'manual')),
  -- MASKED preview only. Never the full value (spec §18.2, docs/DATABASE.md §5).
  proposed_value_preview text,
  confidence             numeric(4, 3),
  action                 text not null default 'skipped'
                           check (action in ('filled', 'skipped', 'edited', 'failed')),
  skip_reason            text,
  safety_class           text not null default 'normal'
                           check (safety_class in ('normal', 'captcha', 'otp', 'payment', 'submit')),
  review_required        boolean not null default false,
  error                  text,
  created_at             timestamptz not null default now()
);

create index fill_session_fields_session_idx
  on public.fill_session_fields (organization_id, fill_session_id);

-- A captcha, OTP or payment field may never be recorded as filled. If this constraint ever
-- fires, a safety rule has been broken (spec §14.8, §19.7).
alter table public.fill_session_fields
  add constraint fill_session_fields_safety
  check (safety_class = 'normal' or action <> 'filled');

-- -----------------------------------------------------------------------------
-- form_reports — operator-submitted "this form is not supported"
-- -----------------------------------------------------------------------------
create table public.form_reports (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  fill_session_id    uuid references public.fill_sessions (id) on delete set null,
  portal_adapter_id  uuid references public.portal_adapters (id) on delete set null,

  page_origin        text not null,
  page_path          text,
  page_title         text,
  -- Anonymised field metadata only. No customer values, ever (spec §9.6, §14.2).
  field_metadata     jsonb not null default '[]'::jsonb,
  note               text,
  screenshot_path    text,
  screenshot_consent boolean not null default false,
  browser_version    text,
  extension_version  text,
  status             text not null default 'new'
                       check (status in ('new', 'triaged', 'adapter_created', 'declined')),

  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint form_reports_screenshot_requires_consent
    check (screenshot_path is null or screenshot_consent = true)
);

create index form_reports_status_idx on public.form_reports (status, created_at desc);
create index form_reports_org_idx on public.form_reports (organization_id, created_at desc);

create trigger form_reports_set_updated_at
  before update on public.form_reports
  for each row execute function public.set_updated_at();
