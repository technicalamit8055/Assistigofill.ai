-- =============================================================================
-- 0002  Organizations, members, invitations, and the tenancy helper functions
-- Master spec §6.2, §18.2, §18.3
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(btrim(name)) between 2 and 160),
  business_type     text not null default 'other'
                      check (business_type in (
                        'cyber_cafe', 'csc_vle', 'csp', 'digital_service_centre',
                        'recruitment_centre', 'other')),
  phone             text,
  email             text,
  city              text,
  district          text,
  state             text,
  preferred_locale  text not null default 'en' check (preferred_locale in ('en', 'hi')),
  monthly_forms_estimate text,

  -- Organization-level switches. Defaults are the privacy-preserving choice (§12.3, §19.3).
  settings          jsonb not null default jsonb_build_object(
                      'ai_processing_enabled', false,
                      'allow_full_aadhaar', false,
                      'retention', 'keep',
                      'overwrite_filled_fields', false
                    ),

  plan_code         text not null default 'free',
  customer_counter  bigint not null default 0,

  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on column public.organizations.settings is
  'allow_full_aadhaar must stay false. Flipping it requires a legal review (spec §11.2, §19.3).';

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null
                     check (role in ('owner', 'manager', 'operator', 'viewer', 'billing_admin')),
  status           text not null default 'active'
                     check (status in ('active', 'invited', 'suspended')),
  invited_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members (user_id, status);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- An organization must always have at least one owner, otherwise nobody can manage billing
-- or delete the data — which would make the DPDP erasure obligation unmeetable.
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owners int;
  target_org uuid;
begin
  target_org := coalesce(old.organization_id, new.organization_id);

  if tg_op = 'UPDATE' and old.role = 'owner' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  select count(*) into remaining_owners
  from public.organization_members
  where organization_id = target_org
    and role = 'owner'
    and status = 'active'
    and id <> old.id;

  if remaining_owners = 0 then
    raise exception 'ASSISTIGO_LAST_OWNER: an organization must keep at least one active owner'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function public.prevent_last_owner_removal();

-- -----------------------------------------------------------------------------
-- organization_invitations
-- -----------------------------------------------------------------------------
create table public.organization_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            text not null,
  role             text not null
                     check (role in ('manager', 'operator', 'viewer', 'billing_admin')),
  token_hash       text not null unique,
  status           text not null default 'pending'
                     check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at       timestamptz not null default now() + interval '7 days',
  invited_by       uuid references auth.users (id) on delete set null,
  accepted_by      uuid references auth.users (id) on delete set null,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.organization_invitations.token_hash is
  'SHA-256 of the invite token. The raw token exists only in the emailed link (spec §19.4).';

comment on column public.organization_invitations.role is
  'Owner is deliberately not invitable — ownership transfer is a separate, audited action.';

create index organization_invitations_org_idx
  on public.organization_invitations (organization_id, status);
create index organization_invitations_email_idx
  on public.organization_invitations (lower(email), status);

create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tenancy helpers
--
-- security definer so that policies on organization_members do not recurse into
-- themselves when they call these (spec §18.3, docs/DATABASE.md §3).
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(org uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

create or replace function public.current_org_role(org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = org
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.has_org_role(uuid, text[]) from public;
revoke execute on function public.current_org_role(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.current_org_role(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Per-organization customer codes (C00001, C00002 …)
-- A counter column on organizations gives an atomic sequence per tenant; count(*) would race.
-- -----------------------------------------------------------------------------
create or replace function public.next_customer_code(org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq bigint;
begin
  update public.organizations
     set customer_counter = customer_counter + 1
   where id = org
  returning customer_counter into seq;

  if seq is null then
    raise exception 'ASSISTIGO_UNKNOWN_ORG: organization % does not exist', org;
  end if;

  return 'C' || lpad(seq::text, 5, '0');
end;
$$;
