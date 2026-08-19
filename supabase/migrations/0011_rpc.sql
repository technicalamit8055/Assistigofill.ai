-- =============================================================================
-- 0011  RPCs that need to run as more than one statement, atomically
-- Master spec §7.2 (org setup), §9.1 (onboarding), §7.3.2 (customer search)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_organization
--
-- Organizations have no INSERT policy on purpose: an organization without an owner is a
-- broken tenant nobody can administer or erase. This function is the only way to create
-- one, and it always creates the owner membership in the same transaction.
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_business_type text default 'other',
  p_city text default null,
  p_district text default null,
  p_state text default null,
  p_locale text default 'en',
  p_monthly_forms text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org public.organizations;
  free_plan_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'ASSISTIGO_UNAUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations
    (name, business_type, city, district, state, preferred_locale,
     monthly_forms_estimate, created_by)
  values
    (btrim(p_name), coalesce(p_business_type, 'other'), p_city, p_district, p_state,
     coalesce(p_locale, 'en'), p_monthly_forms, actor)
  returning * into new_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_org.id, actor, 'owner', 'active');

  select id into free_plan_id from public.plans where code = 'free';
  if free_plan_id is not null then
    insert into public.subscriptions
      (organization_id, plan_id, provider, status, current_period_start, current_period_end)
    values
      (new_org.id, free_plan_id, 'mock', 'active', date_trunc('month', now()),
       date_trunc('month', now()) + interval '1 month');
  end if;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_type, action, entity_type, entity_id, sensitivity)
  values
    (new_org.id, actor, 'user', 'organization.created', 'organization', new_org.id, 'normal');

  return new_org;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text, text, text, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- accept_invitation
--
-- The invitee is not yet a member, so they cannot read organization_invitations. They present
-- the hash of the token from their emailed link and this function does the rest.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token_hash text)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.organization_invitations;
  membership public.organization_members;
  actor uuid := auth.uid();
  actor_email text;
begin
  if actor is null then
    raise exception 'ASSISTIGO_UNAUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select email into actor_email from auth.users where id = actor;

  select * into invite
  from public.organization_invitations
  where token_hash = p_token_hash
  for update;

  if invite is null then
    raise exception 'ASSISTIGO_INVITE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'ASSISTIGO_INVITE_NOT_PENDING' using errcode = 'invalid_parameter_value';
  end if;

  if invite.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = invite.id;
    raise exception 'ASSISTIGO_INVITE_EXPIRED' using errcode = 'invalid_parameter_value';
  end if;

  -- The link is not a bearer token for anyone who finds it: it only works for the invited
  -- address (spec §19.4).
  if lower(coalesce(actor_email, '')) <> lower(invite.email) then
    raise exception 'ASSISTIGO_INVITE_EMAIL_MISMATCH' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status, invited_by)
  values (invite.organization_id, actor, invite.role, 'active', invite.invited_by)
  on conflict (organization_id, user_id)
    do update set status = 'active', role = excluded.role
  returning * into membership;

  update public.organization_invitations
     set status = 'accepted', accepted_by = actor, accepted_at = now()
   where id = invite.id;

  insert into public.audit_logs
    (organization_id, actor_user_id, actor_type, action, entity_type, entity_id, sensitivity)
  values
    (invite.organization_id, actor, 'user', 'member.accepted', 'organization_member',
     membership.id, 'normal');

  return membership;
end;
$$;

revoke execute on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- search_customers
--
-- Deliberately SECURITY INVOKER: RLS still applies, so this cannot become a way around
-- tenancy. Ranks full-text matches, exact mobile matches and trigram name similarity.
-- Aadhaar is not searchable, by design (§19.3).
-- -----------------------------------------------------------------------------
create or replace function public.search_customers(
  p_organization_id uuid,
  p_query text default null,
  p_district text default null,
  p_state text default null,
  p_assigned_to uuid default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  customer_code text,
  full_name text,
  full_name_hi text,
  mobile text,
  district text,
  state text,
  date_of_birth date,
  verification_status text,
  created_at timestamptz,
  rank real
)
language sql
stable
as $$
  with params as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as q,
      public.normalize_mobile(nullif(btrim(coalesce(p_query, '')), '')) as q_mobile
  )
  select
    c.id,
    c.customer_code,
    c.full_name,
    c.full_name_hi,
    c.mobile,
    c.address_json -> 'current' ->> 'district' as district,
    c.address_json -> 'current' ->> 'state' as state,
    c.date_of_birth,
    c.verification_status,
    c.created_at,
    case
      when p.q is null then 0::real
      when p.q_mobile is not null and length(p.q_mobile) = 10 and c.mobile_normalized = p.q_mobile
        then 1.0::real
      when lower(c.customer_code) = lower(p.q) then 0.99::real
      else greatest(
        ts_rank(c.search_vector, plainto_tsquery('simple', p.q)),
        similarity(c.full_name, p.q)
      )
    end as rank
  from public.customers c
  cross join params p
  where c.organization_id = p_organization_id
    and c.deleted_at is null
    and (p_district is null or c.address_json -> 'current' ->> 'district' = p_district)
    and (p_state is null or c.address_json -> 'current' ->> 'state' = p_state)
    and (p_assigned_to is null or c.assigned_to = p_assigned_to)
    and (
      p.q is null
      or c.search_vector @@ plainto_tsquery('simple', p.q)
      or c.full_name % p.q
      or lower(c.customer_code) = lower(p.q)
      or (p.q_mobile is not null and length(p.q_mobile) >= 4
          and c.mobile_normalized like '%' || p.q_mobile)
    )
  order by rank desc, c.created_at desc
  limit least(coalesce(p_limit, 25), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.search_customers(uuid, text, text, text, uuid, int, int) from public;
grant execute on function public.search_customers(uuid, text, text, text, uuid, int, int)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- dashboard_summary — the home screen counters (§7.3.1) in one round trip.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_organization_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'fillsToday', (
      select count(*) from public.fill_sessions
      where organization_id = p_organization_id
        and status = 'filled'
        and created_at >= date_trunc('day', now())
    ),
    'customersServedToday', (
      select count(distinct customer_id) from public.fill_sessions
      where organization_id = p_organization_id
        and created_at >= date_trunc('day', now())
    ),
    'customersTotal', (
      select count(*) from public.customers
      where organization_id = p_organization_id and deleted_at is null
    ),
    'documentsProcessedToday', (
      select count(*) from public.document_extractions
      where organization_id = p_organization_id
        and status in ('completed', 'accepted', 'review_required')
        and created_at >= date_trunc('day', now())
    ),
    'applicationsOpen', (
      select count(*) from public.applications
      where organization_id = p_organization_id
        and deleted_at is null
        and status in ('draft', 'pending_documents', 'ready_to_fill', 'filled',
                       'submitted', 'pending_followup')
    ),
    'reviewsPending', (
      select count(*) from public.document_extractions
      where organization_id = p_organization_id and status = 'review_required'
    ),
    'fieldsFilledThisMonth', (
      select coalesce(sum(filled_fields_count), 0) from public.fill_sessions
      where organization_id = p_organization_id
        and created_at >= date_trunc('month', now())
    )
  );
$$;

revoke execute on function public.dashboard_summary(uuid) from public;
grant execute on function public.dashboard_summary(uuid) to authenticated, service_role;
