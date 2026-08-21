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

Done (added since):

- [x] `packages/database/seed` — demo organization, four roles, ~30 fake customers, wired to
      `npm run db:seed` via `scripts/seed-demo-data.ts`. Document fixtures deliberately deferred
      to Phase 3: a `documents` row without real uploaded bytes would 404 in the CRM UI.
- [x] `packages/database/rls-tests` — cross-org denial, viewer write denial, billing_admin
      document/customer_field_values denial, audit immutability, anonymous access. Written and
      typechecked; not yet run against a live Supabase (blocked below).

Remaining:

- [ ] Apply the migrations against a live Supabase (blocked: Docker not installed on this machine)
      — this also blocks actually _running_ `npm run db:seed` and `npm run test:rls` for the
      first time, not just writing them.
- [ ] `npm run db:types` and wire the generated `Database` type into the Supabase clients
- [ ] Password reset completion page (`/reset-password`)
- [ ] Legal pages, pricing page, demo request page

Acceptance: user signs up and creates an org · owner invites an operator · operator cannot reach
billing settings · cross-org access blocked by test.

## Phase 2 — Customer CRM ☑

- [x] Customer list, search box wired to the `search_customers` RPC
- [x] Add-customer form, minimal fields, duplicate warning wired to `findDuplicates`
      (surfaced, never blocking — `?force=1` records the operator's decision)
- [x] Customer profile rendered from the field registry, section by section
- [x] Sensitive-value reveal flow via `POST /api/customers/:id/reveal`, one field per call, audited
- [x] Audit trail on the profile
- [x] `/api/customers` list/create, `/api/customers/:id` read/update/delete

Acceptance: customer created in under 30 s · search by name/mobile/location · Indian address
fields · sensitive fields masked · changes audited.

## Phase 3 — Documents and OCR ◐

Done:

- [x] `packages/ai` — `OcrProvider` abstraction, mock provider, document classification,
      rules-based field extraction with en/hi/Hinglish labels and negative keywords, confidence
      banding and review rules, fake fixtures with golden tests (53 unit tests)
- [x] Aadhaar safety layer: extraction emits **only** `customer.aadhaar_last4`, and identifiers
      are masked out of field values, source snippets and retained raw text before anything is
      persisted (15 dedicated regression tests)
- [x] Upload flow — `POST /api/documents/upload-intent` reserves a row and a one-time signed
      upload URL; bytes go browser → storage directly
- [x] `POST /api/documents/:id/process` — magic-byte sniff against the declared MIME type
      before anything is processed; a file that lied is deleted and marked failed
- [x] Job model: `enqueueJob`, the `ocr.extract` handler, the worker (`claim_jobs` /
      `complete_job`), and `POST /api/jobs/run` gated on `JOB_RUNNER_SECRET` (fails closed)
- [x] `GET /api/documents/:id/extraction`, `POST /api/documents/:id/review`,
      `POST /api/documents/:id/signed-url` (≤300 s, audited), `DELETE /api/documents/:id`
- [x] Review UI — per-field confidence, the reason review is required, the source snippet, and
      accept/edit/reject. Accepting writes to `customers` **and** `customer_field_values`
      (`operator_verified`) with provenance; rejecting records the rejection and never fills.
- [x] Documents list, upload page, document detail, and a documents section on the customer profile
- [x] Migration 0013 — one extraction per document (job idempotency) + `storage_used_bytes`,
      which also wires up the storage entitlement that Phase 1 stubbed at zero
- [x] `en` + `hi` strings for the whole surface
- [x] Paste-text import — `packages/ai/src/text.ts` runs the same dictionary, normalisation,
      confidence banding and Aadhaar gate over text an operator pastes, with no OCR and no
      classification. `POST /api/customers/parse-text` proposes and stores nothing;
      `POST /api/customers/:id/values` is the human gate and re-validates every value.
      Paste panel on the customer profile, prefill on the new-customer form, 34 unit tests.

Remaining:

- [ ] Import-customer-from-document (§9.3): review currently requires the document to be
      attached to an existing customer and refuses otherwise. Needs its own endpoint.
- [ ] Schedule `POST /api/jobs/run` (Vercel Cron or equivalent) and set `JOB_RUNNER_SECRET`
- [ ] Real OCR providers — `tesseract` and `anthropic` are declared and fail loudly rather than
      silently falling back to the mock
- [ ] Document fixtures in the seed (needs a live Supabase to upload real bytes)

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
- [x] Disconnect button added to the side panel, next to the organization/role row, so the
      operator can end a session without reopening the popup.

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

Done (added since):

- [x] First real portal adapter — `bihar-rtps-serviceonline` for RTPS Bihar / ServicePlus
      (`serviceonline.bihar.gov.in`), covering the income, caste and residence certificate
      forms. One adapter, because the services differ only by `?serviceId=` and §14.2 forbids
      transmitting the query string; label patterns select per form. Labels were read off the
      live portal. 17 end-to-end tests against an RTPS-shaped fixture.
- [x] `BUILT_IN_ADAPTERS` — adapters ship with the build and `POST /api/forms/map` merges the
      database over them, so an unseeded deployment still supports the portals it knows.
      `npm run db:seed:adapters` publishes them into `portal_adapters`.
- [x] Adapter field matching rewritten: longest-match wins rather than first-in-array (labels
      nest in Hindi — `नाम` ⊂ `पिता का नाम`), `negativePatterns`, placeholder/aria matching,
      and the adapter `key` no longer substring-matches label text.
- [x] `dependsOn` wired up — it was schema-only. `MappingProposal.fillOrder` now carries the
      dependency order through the API to the side panel.
- [x] Fixed: named transforms never ran on the real fill path. The review panel built its own
      instruction list, so `date.ddmmyyyy`, `mobile.10digit`, `pin.6digit`, `number.plain` and
      `gender.full` were all no-ops in the product while passing their unit tests. It now calls
      `buildFillInstructions`, which also re-checks safety classes and applies the fill order.
      The review table shows the transformed value, not the raw profile value.
- [x] Fixed: a `<select>`'s nearby text included its own option labels, so options acted as
      naming signals. Plus `ownTextOnly` for dictionary entries whose synonyms are container
      words ("address"), which were claiming every field under a matching section heading.
- [x] `customer.address.sub_division` (and `customer.permanent_address.sub_division`) added to
      the field registry — RTPS needs अनुमंडल to complete the district → sub-division → block
      chain. No migration needed: address parts live in the existing `address_json` JSONB
      column, not a first-class column, so this was a registry entry plus dictionary and adapter
      wiring, not a schema change. `bihar-rtps-serviceonline`'s `block` field now `dependsOn`
      `sub_division` instead of `district` directly. Also added: `customer.bpl_card_number`
      (identity, encrypted) and `customer.certificate.caste.sub_caste` (certificates, high-risk,
      always reviewed like the category it refines).

Remaining:

- [ ] Promote `bihar-rtps-serviceonline` from `testing` to `active` after a manual smoke test
      against the live portal — the adapter is written from the portal's rendered labels, and
      only a real run confirms the dependent-dropdown chain and the AJAX timings
- [ ] Seed the remaining demo adapters into `portal_adapters`
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
