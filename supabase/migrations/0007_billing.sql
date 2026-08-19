-- =============================================================================
-- 0007  Plans, subscriptions, usage events
-- Master spec §22, §18.2
-- =============================================================================

create table public.plans (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique
                            check (code in ('free', 'starter', 'professional', 'business')),
  name                    text not null,
  name_hi                 text,
  price_monthly_inr       numeric(10, 2) not null default 0,
  included_fills          int,               -- null = unlimited
  included_ai_extractions int,
  included_seats          int not null default 1,
  max_customers           int,               -- null = unlimited
  storage_mb              int not null default 200,
  features                jsonb not null default '{}'::jsonb,
  active                  boolean not null default true,
  sort_order              int not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Plans are reference data, not tenant data: readable by any signed-in user, writable by
-- service_role only (there is no insert/update/delete policy below).
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (active = true);

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  plan_id                  uuid not null references public.plans (id),
  provider                 text not null default 'mock'
                             check (provider in ('mock', 'razorpay', 'stripe')),
  provider_customer_id     text,
  provider_subscription_id text,
  status                   text not null default 'active'
                             check (status in ('active', 'trialing', 'past_due',
                                               'cancelled', 'incomplete')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index subscriptions_one_active_per_org_idx
  on public.subscriptions (organization_id)
  where status in ('active', 'trialing', 'past_due');

create unique index subscriptions_provider_ref_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- billing_webhook_events — idempotency ledger (§22.4)
-- -----------------------------------------------------------------------------
create table public.billing_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  event_id      text not null,
  event_type    text not null,
  processed_at  timestamptz not null default now(),
  result        text not null default 'processed'
                  check (result in ('processed', 'ignored', 'failed')),
  unique (provider, event_id)
);

comment on table public.billing_webhook_events is
  'A replayed webhook hits the unique constraint and is ignored, making processing idempotent.';

-- -----------------------------------------------------------------------------
-- usage_events
-- -----------------------------------------------------------------------------
create table public.usage_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  event_type       text not null
                     check (event_type in ('fill', 'ai_extraction', 'document_tool',
                                           'storage', 'seat')),
  quantity         int not null default 1 check (quantity > 0),
  billable         boolean not null default true,
  -- Never contains customer values; only ids and counts.
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index usage_events_period_idx
  on public.usage_events (organization_id, event_type, created_at);

-- Aggregated usage for the current billing period, used by the entitlement service.
create or replace function public.usage_since(org uuid, since timestamptz)
returns table (event_type text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select u.event_type, sum(u.quantity)::bigint
  from public.usage_events u
  where u.organization_id = org
    and u.billable = true
    and u.created_at >= since
  group by u.event_type;
$$;

revoke execute on function public.usage_since(uuid, timestamptz) from public;
grant execute on function public.usage_since(uuid, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Seed the plan catalogue. Mirrors packages/core/src/billing/plans.ts.
-- Prices are the §22.1 placeholder, not a business commitment.
-- -----------------------------------------------------------------------------
insert into public.plans
  (code, name, name_hi, price_monthly_inr, included_fills, included_ai_extractions,
   included_seats, max_customers, storage_mb, features, sort_order)
values
  ('free', 'Free', 'फ्री', 0, 25, 10, 1, 50, 200,
   '{"adapterLibrary": false, "advancedDocumentTools": false, "bulkImport": false, "apiAccess": false, "support": "community"}'::jsonb, 0),
  ('starter', 'Starter', 'स्टार्टर', 299, 300, 100, 2, 1000, 2000,
   '{"adapterLibrary": true, "advancedDocumentTools": true, "bulkImport": false, "apiAccess": false, "support": "email"}'::jsonb, 1),
  ('professional', 'Professional', 'प्रोफेशनल', 599, 1000, 400, 4, 5000, 10000,
   '{"adapterLibrary": true, "advancedDocumentTools": true, "bulkImport": true, "apiAccess": false, "support": "email"}'::jsonb, 2),
  ('business', 'Business', 'बिज़नेस', 999, null, 1500, 10, null, 50000,
   '{"adapterLibrary": true, "advancedDocumentTools": true, "bulkImport": true, "apiAccess": false, "support": "priority"}'::jsonb, 3)
on conflict (code) do update
  set name = excluded.name,
      name_hi = excluded.name_hi,
      price_monthly_inr = excluded.price_monthly_inr,
      included_fills = excluded.included_fills,
      included_ai_extractions = excluded.included_ai_extractions,
      included_seats = excluded.included_seats,
      max_customers = excluded.max_customers,
      storage_mb = excluded.storage_mb,
      features = excluded.features,
      sort_order = excluded.sort_order;
