# Development Rules

Derived from master spec §27 (Coding Standards), §28 (AI-Agent Rules), §35 (Definition of Done).

Every contributor — human or coding agent — must follow these.

---

## 1. Non-negotiable product rules

These are product-level constraints, not preferences. A PR that violates one is rejected.

| #   | Rule                                                                                                      | Spec         |
| --- | --------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Assistigo never clicks a final submit / confirm-payment button.                                           | §14.8, §9.5  |
| 2   | Assistigo never reads, solves or bypasses a CAPTCHA.                                                      | §14.5, §19.7 |
| 3   | Assistigo never retrieves or auto-enters an OTP.                                                          | §14.5, §19.7 |
| 4   | Payment credential fields are not autofilled in the MVP.                                                  | §14.5, §19.7 |
| 5   | Full Aadhaar numbers are not stored. Last four only, unless legal review approves and the org enables it. | §11.2, §19.3 |
| 6   | No real citizen data in dev, test, seed or fixture data.                                                  | §32.1        |
| 7   | No customer PII in logs, error reports, or portal adapter reports.                                        | §19.6, §24.2 |
| 8   | No competitor branding, copy, layout or assets.                                                           | §1, §28.1    |
| 9   | No product scope invented outside the master spec.                                                        | §28.1        |
| 10  | Raw documents are never sent to an AI provider without org-level opt-in.                                  | §12.3, §19.3 |

Rules 1–4 are additionally guarded by tests in `apps/extension/tests/` and constants in
`packages/form-engine/src/safety.ts`. Do not weaken them "temporarily".

---

## 2. Language and typing

- TypeScript strict mode everywhere. `noImplicitAny`, `noUncheckedIndexedAccess` on.
- `any` is a lint error. Use `unknown` plus a Zod parse at the boundary.
- All external input (HTTP body, query, extension message, webhook, OCR output) is validated
  with a Zod schema before use.
- Domain types live in `packages/*`, not in React components.

## 3. Naming

| Thing                    | Convention                     | Example                 |
| ------------------------ | ------------------------------ | ----------------------- |
| Database identifiers     | `snake_case`                   | `customer_field_values` |
| TS variables / functions | `camelCase`                    | `proposeFieldMappings`  |
| React components         | `PascalCase`                   | `CustomerSearchBox`     |
| Translation keys         | dot notation                   | `customers.list.title`  |
| Customer field keys      | `customer.` prefix, snake tail | `customer.father_name`  |
| SQL migration files      | `NNNN_description.sql`         | `0002_customers.sql`    |

## 4. Authorization

- **Server-side checks are mandatory.** Hiding a button in the UI is not authorization.
- Every tenant table carries `organization_id` and has RLS enabled.
- API handlers resolve the caller's active membership before touching data.
- Role checks use `packages/core/src/auth/permissions.ts`. Do not inline role string comparisons.

## 5. Privacy standards

- Sensitive identifiers render masked by default. Revealing requires an explicit action, a role
  permission, and writes an audit log entry.
- `packages/core/src/privacy/redact.ts` is the only sanctioned path for building log payloads.
- Never seed a real-format identity number that could collide with a real person. Use the
  documented invalid ranges in `docs/DATABASE.md` § Seed data.
- Storage buckets are private. Access is via short-lived signed URLs only.

## 6. Error handling

- User-facing errors are plain, actionable and localized.
- Internal errors carry a trace id; the trace id is what the user is shown.
- Sensitive values never appear in an error message or stack.
- Background jobs are idempotent and retryable.

## 7. Tests

Write tests proportional to risk:

| Area                       | Required test                 |
| -------------------------- | ----------------------------- |
| Field mapping rules        | Unit                          |
| Validation / normalisation | Unit                          |
| Permission helpers         | Unit                          |
| RLS policy                 | `packages/database/rls-tests` |
| API route                  | Integration                   |
| Extension fill behaviour   | `apps/extension/tests`        |
| Safety rules (1–4 above)   | Dedicated regression test     |

Run the relevant checks before claiming a task is done. Report actual output, including failures.

## 8. Scope discipline

- No unrelated refactors inside a feature task.
- If the spec is ambiguous on something that affects **privacy, billing or legal risk**, stop and
  ask the product owner. Do not guess.
- If architecture changes, update the doc in `docs/` in the same PR.

## 9. Definition of Done (§35)

A feature is done only when it:

- [ ] matches the spec (or an approved written change),
- [ ] has tests appropriate to its risk,
- [ ] enforces permissions server-side,
- [ ] handles empty / loading / error states,
- [ ] uses translation keys rather than hard-coded strings,
- [ ] leaks no PII to logs or third parties,
- [ ] writes audit logs where the action is sensitive,
- [ ] works against seed/demo data,
- [ ] passes typecheck, lint and the relevant test suites.
