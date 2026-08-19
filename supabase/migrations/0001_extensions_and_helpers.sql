-- =============================================================================
-- 0001  Extensions and shared helpers
-- Master spec §18.1
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger that keeps updated_at honest regardless of what the client sends.';

-- -----------------------------------------------------------------------------
-- Text normalisation used by generated columns.
-- Marked immutable because generated columns require it; the logic is pure.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_mobile(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null then null
    else right(regexp_replace(raw, '[^0-9]', '', 'g'), 10)
  end;
$$;

comment on function public.normalize_mobile(text) is
  'Last 10 digits of a mobile number so +91 / 0 / spaced variants all match one search key.';
