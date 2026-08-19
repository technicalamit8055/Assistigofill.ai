-- =============================================================================
-- 0012  Extension pairing codes
-- Master spec §15.1.2; docs/EXTENSION.md §3
--
-- Transport for one step only: moving a signed-in dashboard session into the Chrome extension
-- without a password ever being typed into extension UI.
--
-- The row is deliberately short-lived and single-use:
--   * `code_hash` is SHA-256 of the code. The code itself is never stored, so a database leak
--     cannot be replayed against this table.
--   * `session_payload` is the dashboard's Supabase session, AES-256-GCM encrypted by the
--     application (packages/core/src/privacy/crypto.ts) with the code hash as AAD, so a row
--     cannot be transplanted onto a different code.
--   * `expires_at` is minutes at most, and `consumed_at` makes redemption one-shot.
--
-- No customer data is ever written here.
-- =============================================================================

create table public.extension_pairing_codes (
  code_hash       text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- v1.<iv>.<tag>.<ciphertext> — see packages/core/src/privacy/crypto.ts
  session_payload text not null,
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index extension_pairing_codes_expires_idx
  on public.extension_pairing_codes (expires_at);

-- One live code per user: minting a new one invalidates the last, so an abandoned connect tab
-- cannot leave a redeemable code behind.
create unique index extension_pairing_codes_live_user_idx
  on public.extension_pairing_codes (user_id) where consumed_at is null;

alter table public.extension_pairing_codes enable row level security;

-- No policies, by design: only the pairing routes reach this table, through service_role.
-- An operator's own JWT must not be able to read another row, or their own encrypted session.

-- -----------------------------------------------------------------------------
-- Redemption, as one atomic statement.
--
-- Runs as the definer so the pair route can call it without service_role, and so the
-- "check unconsumed, then mark consumed" pair cannot interleave with a second redemption of
-- the same code. Returns nothing when the code is unknown, expired or already used — the
-- caller cannot tell which, on purpose.
-- -----------------------------------------------------------------------------
-- Output columns are deliberately not named `user_id` / `session_payload`: in a SQL-language
-- table function those names would be ambiguous against the table's own columns.
create function public.consume_extension_pairing_code(p_code_hash text)
returns table (paired_user_id uuid, sealed_session text)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.extension_pairing_codes
     set consumed_at = now()
   where code_hash = p_code_hash
     and consumed_at is null
     and expires_at > now()
  returning extension_pairing_codes.user_id, extension_pairing_codes.session_payload;
$$;

revoke all on function public.consume_extension_pairing_code(text) from public;
grant execute on function public.consume_extension_pairing_code(text) to service_role;

-- -----------------------------------------------------------------------------
-- Housekeeping. Consumed and expired rows have no value; the sweep keeps the encrypted
-- session payloads from lingering (docs/SECURITY.md — retention).
-- -----------------------------------------------------------------------------
create function public.purge_extension_pairing_codes()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with deleted as (
    delete from public.extension_pairing_codes
     where expires_at < now() - interval '1 hour'
        or consumed_at < now() - interval '1 hour'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.purge_extension_pairing_codes() from public;
grant execute on function public.purge_extension_pairing_codes() to service_role;
