-- =============================================================================
-- 0013  One current extraction per document
-- Master spec §12.1, §12.6; docs/AI_PIPELINE.md §1
--
-- The `ocr.extract` job must be idempotent (§17.5): a retry after a transient storage or
-- provider failure has to replace its own previous attempt rather than stack a second copy of
-- the same fields into the operator's review queue.
--
-- History is not lost by collapsing this to one row. Provenance for values the operator
-- *accepted* lives in `customer_field_values` (source document, confidence, status), and the
-- accept/reject decision itself is in `audit_logs`. What this table holds is the current
-- proposal, and there is only ever one of those per document.
-- =============================================================================

-- Collapse any pre-existing duplicates before the constraint goes on, keeping the newest row
-- for each document. A fresh database has nothing to do here.
delete from public.document_extractions e
 using public.document_extractions newer
 where e.document_id = newer.document_id
   and (newer.created_at, newer.id) > (e.created_at, e.id);

alter table public.document_extractions
  add constraint document_extractions_one_per_document unique (document_id);

-- -----------------------------------------------------------------------------
-- Storage accounting for the storage entitlement (§22.3)
--
-- `security definer` so the caller does not need to read every document row to learn a single
-- total — the number is a plan measurement, not customer data. Deleted documents are excluded
-- because their bytes are removed from the bucket at delete time (docs/SECURITY.md §10).
-- -----------------------------------------------------------------------------
create or replace function public.storage_used_bytes(org uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(d.size_bytes), 0)::bigint
  from public.documents d
  where d.organization_id = org
    and d.deleted_at is null
    and public.is_org_member(org);
$$;

revoke execute on function public.storage_used_bytes(uuid) from public;
grant execute on function public.storage_used_bytes(uuid) to authenticated, service_role;
