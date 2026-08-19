# Database

Derived from master spec §18.

**Migrations live in `supabase/migrations/`**, not `packages/database/migrations` as sketched in
spec §26. The Supabase CLI reads that path with no configuration, so `supabase db reset`,
`supabase db diff` and the CI `database` job all work out of the box; a second copy synced from
elsewhere would be a drift hazard for no benefit. `packages/database/` holds the seed data,
the RLS test suite and generated types.

---

## 1. Conventions

- UUID primary keys (`gen_random_uuid()`).
- Every tenant table has `organization_id uuid not null references organizations(id)`.
- `created_at` / `updated_at` are `timestamptz not null default now()`; `updated_at` is
  maintained by the `set_updated_at()` trigger.
- Soft delete (`deleted_at`) on business records that need audit history:
  `organizations`, `customers`, `documents`. Hard delete is reserved for privacy erasure.
- Enumerated values are Postgres `text` + `check` constraints rather than native enums, so a new
  status does not require a type migration during the MVP.
- All identifiers `snake_case`.

## 2. Migration order

| File                              | Contents                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `0001_extensions_and_helpers.sql` | `pgcrypto`, `set_updated_at()`, `is_org_member()`, `has_org_role()`, `current_org_role()`                              |
| `0002_organizations.sql`          | `organizations`, `organization_members`, `organization_invitations`                                                    |
| `0003_customers.sql`              | `customers`, `customer_field_values`                                                                                   |
| `0004_documents.sql`              | `documents`, `document_extractions`, `document_derivatives`, `document_requirement_presets`, storage bucket + policies |
| `0005_applications.sql`           | `applications`, `application_status_events`, `application_documents`                                                   |
| `0006_form_engine.sql`            | `portal_adapters`, `fill_sessions`, `fill_session_fields`, `form_reports`, `org_field_mappings`                        |
| `0007_billing.sql`                | `plans`, `subscriptions`, `usage_events`                                                                               |
| `0008_audit_and_privacy.sql`      | `audit_logs`, `consent_records`, `support_access_grants`, `data_requests`                                              |
| `0009_jobs.sql`                   | `jobs` table + claim/complete functions                                                                                |
| `0010_rls_policies.sql`           | every RLS policy in one reviewable place, plus storage policies                                                        |
| `0011_rpc.sql`                    | `create_organization`, `accept_invitation`, `search_customers`, `dashboard_summary`                                    |

Seed data is **separate from migrations** (`packages/database/seed/`), per spec §25.4.

## 3. Security helper functions

```sql
-- active membership in the org
create function public.is_org_member(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from organization_members m
      where m.organization_id = org
        and m.user_id = auth.uid()
        and m.status = 'active'
    );
  $$;

-- active membership with one of the given roles
create function public.has_org_role(org uuid, roles text[]) returns boolean ...
```

`security definer` is required so the policies on `organization_members` do not recurse.

## 4. Role vocabulary

`owner` · `manager` · `operator` · `viewer` · `billing_admin`

Membership status: `active` · `invited` · `suspended`.

## 5. Key design notes

### `customers` vs `customer_field_values`

`customers` holds the **confirmed** profile — what the operator has accepted. Fast to query,
drives search and autofill.

`customer_field_values` holds **field-level provenance**: which document a value came from, its
confidence, and its verification status (`extracted` → `operator_verified` →
`customer_confirmed`, or `rejected` / `expired`). Encrypted values (PAN, bank account) live only
here, in `value_encrypted`. An extracted value does not touch `customers` until a human accepts it
(spec §9.3, §12.6).

### Search

`customers` carries a generated `search_vector tsvector` over name, mobile, customer code,
village and district, with a GIN index. Aadhaar is deliberately excluded — it must never be a
search key (spec §19.3).

Mobile search also matches on a normalized last-10-digit column so `98765 43210`,
`+919876543210` and `9876543210` all find the same customer.

### Sensitive columns

`customers.identity_summary_json` stores masked summaries only:

```json
{ "aadhaar_last4": "1234", "pan_masked": "ABCXX1234X", "voter_id_last4": "7788" }
```

Full PAN / bank account live encrypted in `customer_field_values.value_encrypted`.
There is no column anywhere for a full Aadhaar number in the MVP.

### `fill_session_fields`

Stores `proposed_value_preview` — a **masked, truncated** preview (e.g. `Am… K…`,
`98•••••210`), never the full value. This makes fill sessions debuggable without turning the
audit trail into a PII store.

## 6. Indexes

```sql
customers            (organization_id, deleted_at), gin(search_vector), (organization_id, mobile_normalized)
customer_field_values(organization_id, customer_id, field_key) unique
documents            (organization_id, customer_id), (organization_id, status)
applications         (organization_id, status), (organization_id, customer_id), (organization_id, deadline_at)
fill_sessions        (organization_id, created_at desc), (organization_id, customer_id)
audit_logs           (organization_id, created_at desc), (organization_id, entity_type, entity_id)
usage_events         (organization_id, event_type, created_at)
jobs                 (status, run_after) where status in ('pending','retry')
```

## 7. Seed data rules (spec §32)

Fake only. Specifically:

| Field             | Rule                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Mobile            | starts `99000` — a range reserved for testing, never allocated to real subscribers           |
| Aadhaar last four | always `0000`                                                                                |
| PAN               | pattern-valid but with `ZZZ` issuer block, e.g. `ZZZPD1234Q`                                 |
| Names             | common Indian names, but paired with fake DOB/address so no real identity is reconstructable |
| Documents         | generated PDFs/PNGs stamped **DEMO ONLY — NOT A VALID DOCUMENT**                             |

`npm run db:seed` creates one demo organization, four members (one per role), ~30 customers,
document fixtures, applications across every status, and the demo portal adapters.

## 8. RLS test coverage

`packages/database/rls-tests` asserts, for each tenant table:

1. a member of org A can read their own rows,
2. a member of org B **cannot** read org A's rows,
3. a `viewer` cannot insert or update,
4. a `billing_admin` cannot read documents or customer field values,
5. `audit_logs` cannot be updated or deleted by anyone,
6. anonymous access returns zero rows.
