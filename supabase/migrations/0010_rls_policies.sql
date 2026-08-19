-- =============================================================================
-- 0010  Row Level Security
-- Master spec §18.3, §19; docs/SECURITY.md §2–§3
--
-- Every policy in one file so the whole tenancy model can be reviewed at once.
--
-- Role sets used below:
--   READ    owner, manager, operator, viewer        (billing_admin excluded — §6.2)
--   WRITE   owner, manager, operator
--   ADMIN   owner, manager
--   BILLING owner, manager, billing_admin           (view) / owner, billing_admin (manage)
-- =============================================================================

alter table public.organizations              enable row level security;
alter table public.organization_members       enable row level security;
alter table public.organization_invitations   enable row level security;
alter table public.customers                  enable row level security;
alter table public.customer_field_values      enable row level security;
alter table public.documents                  enable row level security;
alter table public.document_extractions       enable row level security;
alter table public.document_derivatives       enable row level security;
alter table public.document_requirement_presets enable row level security;
alter table public.applications               enable row level security;
alter table public.application_status_events  enable row level security;
alter table public.application_documents      enable row level security;
alter table public.portal_adapters            enable row level security;
alter table public.org_field_mappings         enable row level security;
alter table public.fill_sessions              enable row level security;
alter table public.fill_session_fields        enable row level security;
alter table public.form_reports               enable row level security;
alter table public.subscriptions              enable row level security;
alter table public.usage_events               enable row level security;
alter table public.billing_webhook_events     enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.consent_records            enable row level security;
alter table public.support_access_grants      enable row level security;
alter table public.data_requests              enable row level security;
alter table public.jobs                       enable row level security;

-- billing_webhook_events and jobs get NO policies: service_role only, by design.

-- -----------------------------------------------------------------------------
-- organizations
-- No INSERT policy: organizations are created through public.create_organization(),
-- which also creates the owner membership in the same transaction (0011).
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or public.has_support_access(id, 'metadata'));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner', 'manager']))
  with check (public.has_org_role(id, array['owner', 'manager']));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_org_role(id, array['owner']));

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id) or user_id = auth.uid());

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager']));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']))
  with check (public.has_org_role(organization_id, array['owner', 'manager']));

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

-- -----------------------------------------------------------------------------
-- organization_invitations
-- The invitee finds their invitation by token hash through an RPC, not by reading this table.
-- -----------------------------------------------------------------------------
create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

create policy organization_invitations_insert on public.organization_invitations
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager']));

create policy organization_invitations_update on public.organization_invitations
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']))
  with check (public.has_org_role(organization_id, array['owner', 'manager']));

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create policy customers_select on public.customers
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer'])
    or public.has_support_access(organization_id, 'customer_records')
  );

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy customers_update on public.customers
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy customers_delete on public.customers
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

-- -----------------------------------------------------------------------------
-- customer_field_values
-- Viewer is excluded: this table carries encrypted identity values and raw provenance.
-- A viewer still sees the confirmed profile through `customers`.
-- -----------------------------------------------------------------------------
create policy customer_field_values_select on public.customer_field_values
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager', 'operator'])
    or public.has_support_access(organization_id, 'customer_records')
  );

create policy customer_field_values_insert on public.customer_field_values
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy customer_field_values_update on public.customer_field_values
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy customer_field_values_delete on public.customer_field_values
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

-- -----------------------------------------------------------------------------
-- documents and friends
-- -----------------------------------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer'])
    or public.has_support_access(organization_id, 'documents')
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy documents_update on public.documents
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy documents_delete on public.documents
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

create policy document_extractions_select on public.document_extractions
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager', 'operator'])
    or public.has_support_access(organization_id, 'documents')
  );

create policy document_extractions_insert on public.document_extractions
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy document_extractions_update on public.document_extractions
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy document_derivatives_select on public.document_derivatives
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy document_derivatives_insert on public.document_derivatives
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy document_derivatives_delete on public.document_derivatives
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

-- Global presets (organization_id is null) are readable by everyone signed in.
create policy document_requirement_presets_select on public.document_requirement_presets
  for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));

create policy document_requirement_presets_write on public.document_requirement_presets
  for all to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'manager']))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'manager']));

-- -----------------------------------------------------------------------------
-- applications
-- -----------------------------------------------------------------------------
create policy applications_select on public.applications
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer'])
    or public.has_support_access(organization_id, 'customer_records')
  );

create policy applications_insert on public.applications
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy applications_update on public.applications
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy applications_delete on public.applications
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

-- History is readable but never editable: no update or delete policy.
create policy application_status_events_select on public.application_status_events
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy application_status_events_insert on public.application_status_events
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy application_documents_select on public.application_documents
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy application_documents_write on public.application_documents
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

-- -----------------------------------------------------------------------------
-- form engine
-- Global adapters are read-only reference data for every organization; only
-- service_role may write them (no policy covers organization_id is null).
-- -----------------------------------------------------------------------------
create policy portal_adapters_select on public.portal_adapters
  for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));

create policy portal_adapters_write on public.portal_adapters
  for all to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'manager']))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'manager']));

create policy org_field_mappings_select on public.org_field_mappings
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy org_field_mappings_write on public.org_field_mappings
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy fill_sessions_select on public.fill_sessions
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy fill_sessions_insert on public.fill_sessions
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy fill_sessions_update on public.fill_sessions
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy fill_session_fields_select on public.fill_session_fields
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy fill_session_fields_insert on public.fill_session_fields
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy form_reports_select on public.form_reports
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy form_reports_insert on public.form_reports
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

-- -----------------------------------------------------------------------------
-- billing
-- -----------------------------------------------------------------------------
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'billing_admin']));

create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'billing_admin']))
  with check (public.has_org_role(organization_id, array['owner', 'billing_admin']));

create policy usage_events_select on public.usage_events
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'billing_admin']));

create policy usage_events_insert on public.usage_events
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

-- -----------------------------------------------------------------------------
-- audit and privacy
-- audit_logs has select + insert only. Update and delete are additionally blocked by a
-- trigger, so even service_role cannot rewrite history.
-- -----------------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'manager'])
    or public.has_support_access(organization_id, 'metadata')
  );

create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy consent_records_select on public.consent_records
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator', 'viewer']));

create policy consent_records_insert on public.consent_records
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

create policy consent_records_update on public.consent_records
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager', 'operator']))
  with check (public.has_org_role(organization_id, array['owner', 'manager', 'operator']));

-- An organization can see who has been granted access to it; a support user can see their
-- own grants. Only an owner may create or revoke one.
create policy support_access_grants_select on public.support_access_grants
  for select to authenticated
  using (public.is_org_member(organization_id) or granted_to = auth.uid());

create policy support_access_grants_insert on public.support_access_grants
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner']));

create policy support_access_grants_update on public.support_access_grants
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner']))
  with check (public.has_org_role(organization_id, array['owner']));

create policy data_requests_select on public.data_requests
  for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'manager']));

create policy data_requests_insert on public.data_requests
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner']));

-- =============================================================================
-- Storage policies
--
-- The app normally issues short-lived signed URLs from the server, so these policies are
-- defence in depth: even with a leaked anon session, an object is reachable only by a
-- member of the organization named in its path prefix.
-- =============================================================================

create or replace function public.org_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  candidate text;
begin
  if object_name is null or split_part(object_name, '/', 1) <> 'org' then
    return null;
  end if;
  candidate := split_part(object_name, '/', 2);
  return candidate::uuid;
exception
  when others then
    return null;
end;
$$;

create policy "assistigo documents read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('customer-documents', 'prepared-files')
    and public.is_org_member(public.org_id_from_storage_path(name))
  );

create policy "assistigo documents write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('customer-documents', 'prepared-files')
    and public.has_org_role(
      public.org_id_from_storage_path(name),
      array['owner', 'manager', 'operator']
    )
  );

create policy "assistigo documents delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('customer-documents', 'prepared-files')
    and public.has_org_role(
      public.org_id_from_storage_path(name),
      array['owner', 'manager']
    )
  );
