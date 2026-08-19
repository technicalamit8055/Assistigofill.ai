# Security and Privacy

Derived from master spec §19, §18.3, §24.2.

This document is engineering guidance, not legal advice. Before production launch with real
identity documents, obtain a professional legal/privacy review (spec §19.1). Assistigo processes
digital personal data under India's DPDP Act 2023 and DPDP Rules 2025.

---

## 1. Threat model summary

| Threat                                      | Mitigation                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Operator A reads Operator B's customers     | `organization_id` on every tenant row + RLS + API context check                              |
| Stolen access token used against the API    | Short Supabase JWT lifetime, session revocation, role checks per request                     |
| Document leaked via URL sharing             | Private buckets, signed URLs with ≤5 min expiry, no public bucket                            |
| Aadhaar/PAN leaked via logs                 | Central redaction helper, `no-console` rules, structured logging only                        |
| Malicious host page attacking the extension | Content script treats DOM as untrusted, Zod-validates every message, sanitises rendered text |
| Extension exfiltrating data                 | Bundled code only, no remote scripts, minimal permissions, values never persisted            |
| Support staff snooping                      | Support access grant table, time-boxed, reason-recorded, audited                             |
| AI provider retaining documents             | Provider is off by default; org-level opt-in; no training use; request-id-only audit         |

## 2. Tenancy and RLS

Every tenant table has `organization_id uuid not null` and `alter table ... enable row level
security`. Policies are built from two SQL helper functions:

```sql
public.is_org_member(org uuid)          -- active membership exists
public.has_org_role(org uuid, roles text[])  -- active membership with one of these roles
```

Rules:

- `select`: `is_org_member(organization_id)`.
- `insert` / `update` / `delete`: `has_org_role(...)` with the roles allowed for that entity.
- `billing_admin` alone never grants access to `documents`, `document_extractions`,
  `document_derivatives` or `customer_field_values` (spec §18.3).
- `viewer` gets read-only access to `customers`, `documents`, `applications` and `fill_sessions`,
  and **no access at all to `customer_field_values`** — that table carries encrypted identity
  values and raw extraction provenance, which a read-only role has no reason to hold. A viewer
  still sees the confirmed profile through `customers`.
- Service role bypasses RLS and is used only by migrations, the job worker and the billing webhook.

RLS is verified by `packages/database/rls-tests`, which must pass before pilot (spec §23.3).

## 3. Role permission matrix

| Capability               | owner |    manager    | operator |  viewer  | billing_admin |
| ------------------------ | :---: | :-----------: | :------: | :------: | :-----------: |
| View customers           |   ✓   |       ✓       |    ✓     |    ✓     |       –       |
| Create/edit customers    |   ✓   |       ✓       |    ✓     |    –     |       –       |
| Delete customer          |   ✓   |       ✓       |    –     |    –     |       –       |
| Upload / view documents  |   ✓   |       ✓       |    ✓     | ✓ (view) |       –       |
| Delete document          |   ✓   |       ✓       |    –     |    –     |       –       |
| Review extraction        |   ✓   |       ✓       |    ✓     |    –     |       –       |
| Reveal sensitive field   |   ✓   |       ✓       |    ✓     |    –     |       –       |
| Run fill session         |   ✓   |       ✓       |    ✓     |    –     |       –       |
| Create/edit applications |   ✓   |       ✓       |    ✓     |    –     |       –       |
| Manage members / roles   |   ✓   | ✓ (not owner) |    –     |    –     |       –       |
| Manage billing           |   ✓   |       –       |    –     |    –     |       ✓       |
| Org security settings    |   ✓   |       –       |    –     |    –     |       –       |
| Export / delete org data |   ✓   |       –       |    –     |    –     |       –       |

Implemented once in `packages/core/src/auth/permissions.ts` and mirrored by RLS policies.

## 4. Sensitive data handling

### Aadhaar-like identifiers

- Default: **store last four digits only**, in `identity_summary_json.aadhaar_last4`.
- Full value storage is gated behind `organizations.settings.allow_full_aadhaar`, which is
  `false` and cannot be enabled from the UI in the MVP.
- Display is always masked (`XXXX XXXX 1234`).
- Aadhaar is never a search key and is never indexed.

### PAN, bank account

- Stored encrypted (AES-256-GCM) in `customer_field_values.value_encrypted`, never in plaintext
  columns.
- Masked by default; revealing requires permission `customer.reveal_sensitive` and writes an
  audit entry with sensitivity `critical`.

### Encryption

`packages/core/src/privacy/crypto.ts` — AES-256-GCM, key from `FIELD_ENCRYPTION_KEY`
(base64, 32 bytes). Ciphertext format: `v1.<iv_b64>.<tag_b64>.<ct_b64>`. The version prefix
exists so keys can be rotated without ambiguity. Encryption happens server-side only.

### Documents

- Bucket `customer-documents`, private, no public policy.
- Upload path: `org/<organization_id>/customer/<customer_id>/<document_id>/<filename>`.
- Access only through `POST /api/documents/:id/signed-url` (≤ 300 s expiry, audited).
- MIME type and magic-byte sniffing on upload; extension is not trusted.
- Generated derivatives have EXIF stripped.

## 5. Logging and redaction

Never logged: full Aadhaar / PAN / bank values, raw OCR text, document contents, field values,
customer names, mobile numbers, email addresses.

All log payloads go through `packages/core/src/privacy/redact.ts`, which:

- drops any key matching the sensitive-key list (`aadhaar`, `pan`, `account`, `otp`,
  `password`, `token`, `full_name`, `mobile`, …),
- replaces values with a type tag and length (`"[redacted:string:11]"`),
- truncates deep objects.

Production logs are structured JSON with a trace id. Debug payloads exist only when
`NEXT_PUBLIC_APP_ENV=local`.

## 6. Audit events (spec §19.5)

Recorded in `audit_logs` with sensitivity `normal | sensitive | critical`:

login failure · member invite/remove/role change · customer create/update/delete ·
sensitive field reveal · document upload/download/delete · extraction accepted ·
fill session run · application status change · billing plan change · data export/delete ·
support access grant and use.

The action catalogue is `packages/core/src/audit/actions.ts`. Audit rows are insert-only:
no update or delete policy exists for any role.

## 7. Extension security (spec §15.3, §19.6)

- Permissions requested: `activeTab`, `storage`, `scripting`, `sidePanel`. No broad
  `host_permissions` at install time; page access is granted per-tab by user action.
- Never runs on `chrome://`, `chrome-extension://`, `about:`, `file://` or the Chrome Web Store.
- All bundled code; no `eval`, no `new Function`, no remotely hosted scripts.
- Every runtime message is Zod-parsed and the sender verified (`sender.id === chrome.runtime.id`).
- Text taken from the host page is rendered via `textContent`, never `innerHTML`.
- Customer values live in memory for the duration of a fill and in `chrome.storage.session` at
  most; never in `chrome.storage.local`.
- Field values are never written to the console, even in debug builds.

## 8. Abuse prevention (spec §19.7)

Hard-coded refusals in `packages/form-engine/src/safety.ts`:

- `isCaptchaField()` → always skipped, never read.
- `isOtpField()` → always skipped.
- `isPaymentField()` → never filled in the MVP.
- `isSubmitControl()` → the fill executor refuses to click, and never dispatches
  `form.submit()` or a click on `type="submit"`.

These are covered by regression tests that must never be deleted.

## 9. Support access

Internal staff cannot read customer data by default. A row in `support_access_grants`
(`organization_id`, `granted_to`, `reason`, `expires_at`, `approved_by`) is required; it is
time-boxed, org-approved, and every use writes an audit entry.

## 10. Data subject rights

- **Export**: `POST /api/settings/data/export` produces a JSON + files archive for the org.
- **Delete**: customer deletion soft-deletes the profile, hard-deletes storage objects, and
  records a `data.delete` audit entry. Retention sweeps run via the `retention.sweep` job.
- **Consent**: `consent_records` stores versioned consent per customer per subject
  (`customer_data`, `document_storage`, `ai_processing`) with grant/withdraw timestamps.

## 11. Pre-pilot security checklist

- [ ] RLS tests pass for every tenant table
- [ ] Cross-organization access denied in tests
- [ ] `billing_admin` cannot read documents
- [ ] Storage bucket is private; signed URL expiry ≤ 300 s
- [ ] No PII appears in application logs during a full QA pass
- [ ] Sensitive reveal writes an audit entry
- [ ] Extension requests only the four documented permissions
- [ ] Safety regression tests (captcha/otp/payment/submit) pass
- [ ] `FIELD_ENCRYPTION_KEY` set, and rotation procedure documented
- [ ] Backup and restore verified
