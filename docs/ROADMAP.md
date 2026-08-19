# Roadmap and Build Progress

Phase plan from master spec §31. This file is the live status board — update it as phases land.

Legend: ☐ not started · ◐ in progress · ☑ done

---

## Phase 0 — Repo and tooling ☑

- [x] Monorepo (npm workspaces), TypeScript strict base config
- [x] ESLint flat config, Prettier
- [x] Vitest projects: unit / rls / extension
- [x] `docs/` — spec + ARCHITECTURE, DATABASE, SECURITY, AI_PIPELINE, EXTENSION, FORM_ENGINE,
      DEVELOPMENT_RULES, QA_CHECKLIST, PRD, and this roadmap
- [x] CI workflow with a dedicated safety job (no submit / captcha / otp / payment)
- [x] `npm run check:sql` — parses every migration with the real Postgres grammar, no Docker needed
- [ ] **Product owner task:** interview 20 operators, record top 10 forms, time per application,
      error rates and willingness to pay. Pick the top 5 MVP workflows.
      _This is the one Phase 0 item code cannot do, and Phase 5 adapters should not be
      finalised without it._

## Phase 1 — Foundation ◐

Done:

- [x] `packages/core` — roles, the full permission matrix, Indian field registry, validation and
      normalisation, duplicate detection, application status machine, plans and entitlements,
      audit catalogue, masking, redaction, AES-256-GCM field encryption (89 unit tests)
- [x] `packages/ui` — Button, Field/Input/Select/Textarea, Alert/Badge/Card/Stat/EmptyState, Table
- [x] Migrations 0001–0011: 25 tables, tenancy helpers, triggers, every RLS policy, storage
      policies, and the `create_organization` / `accept_invitation` / `search_customers` /
      `dashboard_summary` RPCs
- [x] Next.js 15 App Router shell, Supabase server/browser/admin clients, middleware session refresh
- [x] Sign up / sign in / forgot password, email-confirmation callback
- [x] Organization creation, first-run checklist, members list, invitations, role changes, removal
- [x] Dashboard home with live counters, settings, landing page
- [x] Hindi/English localisation with full `en` + `hi` dictionaries and an in-place switcher
- [x] `/api/me`, `/api/organizations/current`
- [x] Request context that resolves cookie sessions and extension bearer tokens identically

Remaining:

- [ ] Apply the migrations against a live Supabase (blocked: Docker not installed on this machine)
- [ ] `npm run db:types` and wire the generated `Database` type into the Supabase clients
- [ ] `packages/database/seed` — demo organization, four roles, ~30 fake customers
- [ ] `packages/database/rls-tests` — cross-org denial, viewer write denial, billing_admin
      document denial, audit immutability
- [ ] Password reset completion page (`/reset-password`)
- [ ] Legal pages, pricing page, demo request page

Acceptance: user signs up and creates an org · owner invites an operator · operator cannot reach
billing settings · cross-org access blocked by test.

## Phase 2 — Customer CRM ☐

Customer list + search UI (the `search_customers` RPC and the schema already exist), add-customer
form, profile tabs, field-level provenance UI, duplicate warning wired to `findDuplicates`,
sensitive-value reveal flow, audit logs, fake seed customers.

Acceptance: customer created in under 30 s · search by name/mobile/location · Indian address
fields · sensitive fields masked · changes audited.

## Phase 3 — Documents and OCR ☐

Private storage upload flow, job model, `OcrProvider` abstraction, mock provider, classification,
extraction review UI, profile update from accepted extraction, fixtures.

## Phase 4 — Chrome extension (basic) ◐

Done:

- [x] MV3 manifest — `activeTab`, `storage`, `scripting`, `sidePanel` and **no install-time
      host permissions**; the content script is injected on demand after a user gesture
- [x] Zod-validated message contract with sender verification; unknown messages dropped silently
- [x] Storage split: tokens, selected customer and recent customers in `chrome.storage.session`,
      only preferences in `local`
- [x] Field detector — label resolution (label[for] → wrapping → aria-labelledby → previous table
      cell → preceding text), visibility, stable signatures, same-origin frame walking
- [x] Fill executor — native setter + input/change so React/Vue inputs update; select matching by
      value then label; bounded wait for dependent dropdowns; radio/checkbox
- [x] Popup and side panel (customer picker, review table with confidence, edit/skip, results)
- [x] Service worker: pairing auth, message routing, API calls, fill-session recording
- [x] Bundle split so the content script pulls only what it needs (67 kB, 17 kB gzipped)
- [x] 55 extension tests, including 14 that run the real demo forms end to end

- [x] `/api/extension/pair` and `/api/extension/refresh` route handlers, plus
      `/api/extension/pairing-code` which mints the one-time code
- [x] `/extension/connect` dashboard page, gated on an `EXTENSION_ALLOWED_IDS` allowlist so a
      crafted `?ext=` link cannot pair someone else's extension
- [x] `externally_connectable` manifest entry for the dashboard origin
- [x] Extension icons and the branded popup / side panel

Remaining:

- [ ] Manual smoke test in a real Chrome profile
- [ ] Set `EXTENSION_ALLOWED_IDS` for staging and production (pairing fails closed until then)
- [ ] Schedule `purge_extension_pairing_codes()` so spent rows do not accumulate

## Phase 5 — Form engine and adapters ◐

Done:

- [x] Detected-field schema — metadata only, values never transmitted
- [x] Safety classifiers for CAPTCHA / OTP / payment / submit, with 52 regression tests
- [x] Mapping dictionary: ~60 entries in English, Hindi and Hinglish, with negative keywords so
      "Father's Name" can never resolve to the applicant's own name
- [x] Scorer with weighted signals, input-type penalty and tie demotion into the review band
- [x] Full resolution order — adapter → org override → history → dictionary
- [x] Adapter schema, glob URL matching, specificity + status ranking
- [x] 20 named transforms, all returning `null` rather than guessing
- [x] Mandatory review for high-risk and unverified fields
- [x] `POST /api/forms/map` and `PATCH /api/fill-sessions/:id`

Remaining:

- [ ] Seed the 3–5 demo adapters into `portal_adapters`
- [ ] Adapter admin / import UI and the health dashboard
- [ ] `POST /api/form-reports`
- [ ] AI-assisted mapping (priority 5), gated on org opt-in

## Phase 6 — Document tools ☐

Requirement presets, photo and signature crop/resize/compress, PDF compress/merge/split,
derivative storage, extension suggestions.

## Phase 7 — Application tracking ☐

Applications list + detail, status transitions (machine already built and tested), document
checklist, fill-session links, customer profile history.

## Phase 8 — Billing hooks ☐

Entitlement service wiring (logic already built and tested), usage counters, plan page, checkout
provider interface, mock provider, webhook idempotency tests.

## Phase 9 — Security hardening ☐

Full RLS review, audit coverage, consent records, export/delete workflows, sensitive reveal flow,
log redaction verification, support access grants, backup plan, security tests.

## Phase 10 — Pilot beta ☐

5–10 pilot centres, configured workflows, operator training, fill-success monitoring, bug
collection, willingness-to-pay signal, time-saved measurement.

---

## Deferred, by decision

- Physical E-card and card reader (spec §4.3) — revisit only against the criteria listed there.
- Citizen mobile app, customer portal, public API, WhatsApp notifications (V1.5+/V2/V3).
- Regional languages beyond the Hindi/English foundation.

---

## Known deviations from spec §26

| Spec says                      | Built as                           | Why                                                                                     |
| ------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/database/migrations` | `supabase/migrations`              | CLI-native path; avoids a synced second copy that would drift                           |
| —                              | `apps/web/app/(app)/…` route group | Keeps `/dashboard`, `/customers` at the top level while sharing one authenticated shell |
