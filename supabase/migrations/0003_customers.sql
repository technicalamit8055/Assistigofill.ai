-- =============================================================================
-- 0003  Customers and field-level provenance
-- Master spec §11, §18.2
-- =============================================================================

create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  customer_code      text not null,

  full_name          text not null check (length(btrim(full_name)) >= 2),
  full_name_hi       text,
  mobile             text,
  mobile_alt         text,
  email              text,
  date_of_birth      date,
  gender             text check (gender in ('male', 'female', 'transgender', 'other')),
  marital_status     text check (marital_status in ('single', 'married', 'widowed', 'divorced', 'separated')),
  category           text check (category in ('general', 'obc', 'sc', 'st', 'ews', 'other')),

  father_name        text,
  mother_name        text,
  spouse_name        text,
  guardian_name      text,

  -- { current: {...}, permanent: {...}, permanent_same_as_current: bool }
  address_json       jsonb not null default '{}'::jsonb,
  -- Masked / derived identity summary only. There is NO column for a full Aadhaar number
  -- anywhere in this schema, by design (spec §19.3).
  identity_summary_json jsonb not null default '{}'::jsonb,
  education_json     jsonb not null default '{}'::jsonb,
  certificates_json  jsonb not null default '{}'::jsonb,

  notes              text,
  verification_status text not null default 'unverified'
                       check (verification_status in (
                         'unverified', 'extracted', 'operator_verified',
                         'customer_confirmed', 'expired', 'rejected')),

  assigned_to        uuid references auth.users (id) on delete set null,
  created_by         uuid references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  mobile_normalized  text generated always as (public.normalize_mobile(mobile)) stored,

  -- Aadhaar is deliberately absent from the search vector: it must never be a search key
  -- (spec §19.3).
  search_vector tsvector generated always as (
    to_tsvector('simple',
      coalesce(full_name, '') || ' ' ||
      coalesce(full_name_hi, '') || ' ' ||
      coalesce(customer_code, '') || ' ' ||
      coalesce(public.normalize_mobile(mobile), '') || ' ' ||
      coalesce(public.normalize_mobile(mobile_alt), '') || ' ' ||
      coalesce(father_name, '') || ' ' ||
      coalesce(address_json -> 'current' ->> 'village_town_city', '') || ' ' ||
      coalesce(address_json -> 'current' ->> 'district', '') || ' ' ||
      coalesce(address_json -> 'current' ->> 'state', '')
    )
  ) stored,

  unique (organization_id, customer_code)
);

comment on table public.customers is
  'Confirmed customer profile. Extracted-but-unreviewed values live in customer_field_values.';

create index customers_org_active_idx on public.customers (organization_id, deleted_at);
create index customers_search_idx on public.customers using gin (search_vector);
create index customers_mobile_idx on public.customers (organization_id, mobile_normalized);
create index customers_name_trgm_idx on public.customers using gin (full_name extensions.gin_trgm_ops);
create index customers_created_idx on public.customers (organization_id, created_at desc);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Assign the per-organization customer code on insert.
create or replace function public.assign_customer_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := public.next_customer_code(new.organization_id);
  end if;
  return new;
end;
$$;

create trigger customers_assign_code
  before insert on public.customers
  for each row execute function public.assign_customer_code();

-- Guard rail: refuse to store anything that looks like a full Aadhaar number in the
-- identity summary. Belt and braces alongside the application-level checks (spec §19.3).
create or replace function public.reject_full_aadhaar()
returns trigger
language plpgsql
as $$
declare
  summary text := coalesce(new.identity_summary_json::text, '');
begin
  if summary ~ '"aadhaar"\s*:\s*"[0-9]{12}"'
     or summary ~ '"aadhaar_number"'
     or summary ~ '"aadhaar_full"' then
    raise exception
      'ASSISTIGO_FULL_AADHAAR_FORBIDDEN: only aadhaar_last4 may be stored (spec 19.3)'
      using errcode = 'check_violation';
  end if;

  if (new.identity_summary_json ->> 'aadhaar_last4') is not null
     and (new.identity_summary_json ->> 'aadhaar_last4') !~ '^[0-9]{4}$' then
    raise exception 'ASSISTIGO_INVALID_AADHAAR_LAST4: expected exactly four digits'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger customers_reject_full_aadhaar
  before insert or update on public.customers
  for each row execute function public.reject_full_aadhaar();

-- -----------------------------------------------------------------------------
-- customer_field_values — provenance, confidence and encrypted values
-- -----------------------------------------------------------------------------
create table public.customer_field_values (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  customer_id         uuid not null references public.customers (id) on delete cascade,
  field_key           text not null check (field_key like 'customer.%'),

  value_text          text,
  -- AES-256-GCM payload written by packages/core/src/privacy/crypto.ts. Never plaintext.
  value_encrypted     text,
  value_json          jsonb,
  -- Masked form safe to render in a list without a reveal action.
  display_value       text,

  source_document_id  uuid,
  confidence          numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status              text not null default 'extracted'
                        check (status in ('extracted', 'operator_verified',
                                          'customer_confirmed', 'rejected', 'expired')),

  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (organization_id, customer_id, field_key),
  constraint customer_field_values_encrypted_shape
    check (value_encrypted is null or value_encrypted like 'v1.%')
);

comment on table public.customer_field_values is
  'Field-level provenance. An extracted value stays here until a human accepts it (spec §9.3).';

create index customer_field_values_customer_idx
  on public.customer_field_values (organization_id, customer_id);
create index customer_field_values_status_idx
  on public.customer_field_values (organization_id, status);

create trigger customer_field_values_set_updated_at
  before update on public.customer_field_values
  for each row execute function public.set_updated_at();
