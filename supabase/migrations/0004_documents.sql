-- =============================================================================
-- 0004  Documents, extractions, prepared derivatives, requirement presets
-- Master spec §12, §13, §18.2
-- =============================================================================

create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  customer_id        uuid references public.customers (id) on delete set null,
  application_id     uuid,

  original_filename  text not null,
  storage_bucket     text not null default 'customer-documents',
  storage_path       text not null,
  mime_type          text not null
                       check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes         bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  sha256             text,

  document_type      text not null default 'unknown'
                       check (document_type in (
                         'aadhaar_like', 'pan', 'voter_id', 'marksheet_10', 'marksheet_12',
                         'caste_certificate', 'income_certificate', 'residence_certificate',
                         'photo', 'signature', 'receipt', 'application_pdf', 'generic', 'unknown')),
  status             text not null default 'uploaded'
                       check (status in ('uploaded', 'processing', 'extracted',
                                         'review_required', 'verified', 'failed', 'deleted')),
  is_sensitive       boolean not null default true,
  expires_at         date,
  label              text,

  uploaded_by        uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  unique (organization_id, storage_bucket, storage_path)
);

create index documents_customer_idx on public.documents (organization_id, customer_id);
create index documents_status_idx on public.documents (organization_id, status);
create index documents_application_idx on public.documents (organization_id, application_id);
create index documents_expiry_idx on public.documents (organization_id, expires_at)
  where expires_at is not null;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Storage paths are org-scoped so a leaked path cannot address another tenant's object.
alter table public.documents
  add constraint documents_path_is_org_scoped
  check (storage_path like ('org/' || organization_id::text || '/%'));

-- -----------------------------------------------------------------------------
-- document_extractions
-- -----------------------------------------------------------------------------
create table public.document_extractions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  document_id       uuid not null references public.documents (id) on delete cascade,

  provider          text not null,
  provider_request_id text,
  document_type     text not null default 'unknown',
  -- Kept only while the extraction is unreviewed, then truncated to matched snippets
  -- by the retention job (docs/AI_PIPELINE.md §7).
  raw_text          text,
  extracted_fields  jsonb not null default '[]'::jsonb,
  warnings          jsonb not null default '[]'::jsonb,
  confidence        numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status            text not null default 'pending'
                      check (status in ('pending', 'completed', 'review_required',
                                        'failed', 'accepted', 'rejected')),
  error_code        text,
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index document_extractions_document_idx
  on public.document_extractions (organization_id, document_id);
create index document_extractions_status_idx
  on public.document_extractions (organization_id, status);

create trigger document_extractions_set_updated_at
  before update on public.document_extractions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- document_requirement_presets  (organization_id null = global preset)
-- -----------------------------------------------------------------------------
create table public.document_requirement_presets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  code              text not null,
  name              text not null,
  name_hi           text,
  category          text not null default 'photo'
                      check (category in ('photo', 'signature', 'document', 'pdf')),
  mime_types        text[] not null default array['image/jpeg'],
  min_size_bytes    bigint,
  max_size_bytes    bigint,
  width             int,
  height            int,
  dpi               int,
  color_mode        text check (color_mode in ('colour', 'greyscale', 'bw')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index document_requirement_presets_global_code_idx
  on public.document_requirement_presets (code)
  where organization_id is null;
create unique index document_requirement_presets_org_code_idx
  on public.document_requirement_presets (organization_id, code)
  where organization_id is not null;

create trigger document_requirement_presets_set_updated_at
  before update on public.document_requirement_presets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- document_derivatives — prepared files. The original is never modified (§13.3).
-- -----------------------------------------------------------------------------
create table public.document_derivatives (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  source_document_id  uuid references public.documents (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  application_id      uuid,

  tool_type           text not null check (tool_type in ('photo', 'signature', 'pdf')),
  preset_id           uuid references public.document_requirement_presets (id) on delete set null,
  storage_bucket      text not null default 'prepared-files',
  storage_path        text not null,
  filename            text not null,
  mime_type           text not null,
  size_bytes          bigint not null check (size_bytes > 0),
  width               int,
  height              int,
  -- { operations: [...], preset: {...}, source: {...} } — the recipe that produced this file.
  metadata            jsonb not null default '{}'::jsonb,

  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),

  unique (organization_id, storage_bucket, storage_path)
);

create index document_derivatives_customer_idx
  on public.document_derivatives (organization_id, customer_id);
create index document_derivatives_source_idx
  on public.document_derivatives (organization_id, source_document_id);

alter table public.document_derivatives
  add constraint document_derivatives_path_is_org_scoped
  check (storage_path like ('org/' || organization_id::text || '/%'));

-- -----------------------------------------------------------------------------
-- Private storage buckets (§19.3)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('customer-documents', 'customer-documents', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('prepared-files', 'prepared-files', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
