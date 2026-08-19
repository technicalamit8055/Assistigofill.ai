# Architecture

Derived from master spec §15, §16, §17, §26.

---

## 1. System shape

```text
┌──────────────────┐        ┌────────────────────────┐
│  Web dashboard   │        │  Chrome MV3 extension  │
│  (Next.js App    │        │  popup / side panel /  │
│   Router, RSC)   │        │  content script / SW   │
└────────┬─────────┘        └───────────┬────────────┘
         │  cookie session               │  bearer token (Supabase session)
         └───────────────┬───────────────┘
                         ▼
              ┌─────────────────────┐
              │   API layer         │  Next.js route handlers, Zod-validated
              │   apps/web/app/api  │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │  Domain services    │  packages/core, ai, form-engine,
              │                     │  document-tools
              └──────────┬──────────┘
                         ▼
   ┌──────────────┬──────────────┬───────────────┬──────────────┐
   │  Postgres    │  Storage     │  Jobs table   │  OCR/AI      │
   │  (+ RLS)     │  (private)   │  + worker     │  providers   │
   └──────────────┴──────────────┴───────────────┴──────────────┘
```

## 2. Stack decisions

| Concern              | Choice                                         | Why                                       |
| -------------------- | ---------------------------------------------- | ----------------------------------------- |
| Web framework        | Next.js 15, App Router, TypeScript             | Spec §16.1; RSC keeps operator lists fast |
| API style            | Next.js route handlers + Zod                   | Spec §17.3 — pick one and stay consistent |
| Auth                 | Supabase Auth (email/password)                 | Spec §16.1, §19.4                         |
| Database             | Supabase Postgres + RLS                        | Spec §18                                  |
| File storage         | Supabase Storage, private buckets, signed URLs | Spec §19.3                                |
| Client data fetching | TanStack Query (client islands only)           | Spec §16.1                                |
| Styling              | Tailwind + local primitives in `packages/ui`   | Spec §16.2 — dense operational UI         |
| i18n                 | Local dictionary loader, `en` / `hi`           | Spec §20                                  |
| Background jobs      | `jobs` table + worker route, polled            | Spec §17.5 — works on Vercel + Supabase   |
| Extension build      | Vite, multi-entry, bundled (no remote code)    | Spec §15.3                                |
| Tests                | Vitest (unit/RLS/extension), Playwright (E2E)  | Spec §23                                  |

### Why route handlers rather than tRPC

The Chrome extension is a first-class client. Plain HTTP + Zod keeps the extension's API client
small, avoids shipping a tRPC runtime into a content script, and keeps the contract inspectable
in the network tab during QA (spec §30 expects Antigravity to read network errors).

## 3. Two client surfaces, one API

|                   | Dashboard                  | Extension                              |
| ----------------- | -------------------------- | -------------------------------------- |
| Session transport | HTTP-only Supabase cookies | `Authorization: Bearer <access_token>` |
| Token storage     | browser cookie jar         | `chrome.storage.session` (spec §15.1)  |
| Entry point       | `apps/web/app/(dashboard)` | `apps/extension/src`                   |
| Allowed endpoints | all                        | the `extensionSafe` subset only        |

`apps/web/lib/api/context.ts` resolves both transports into one `RequestContext`
(`{ user, organization, role, permissions, actorType }`). Handlers never look at cookies or
headers directly.

## 4. Package boundaries

```text
packages/core           Pure domain logic + Zod schemas. No React. No Supabase client.
  ├ auth/               roles, permissions, membership rules
  ├ customers/          profile schema, field keys, duplicate detection, masking
  ├ documents/          document types, retention rules, requirement presets
  ├ applications/       status machine, transitions
  ├ billing/            plans, entitlements, usage event types
  ├ audit/              audit action catalogue, sensitivity levels
  └ privacy/            redaction, masking, encryption helpers

packages/ai             OCR provider interface + mock/tesseract/vision implementations,
                        field extraction, normalisation, confidence scoring, fixtures.

packages/form-engine    Detected-field schema, mapping dictionaries (en + hi), scorer,
                        adapter schema + resolution order, safety classifiers
                        (captcha / otp / payment / submit).

packages/document-tools Image + PDF operations, portal requirement presets.

packages/database       SQL migrations, seed SQL, RLS test helpers, generated DB types.

packages/ui             Shared React primitives (Button, Table, Badge, Drawer, Field…).
```

Dependency direction is one-way: `apps/*` → `packages/*`. Packages never import from apps.
`core` is the only package the others may depend on.

Packages publish TypeScript source directly (`"main": "./src/index.ts"`); the web app lists them
in `transpilePackages`, and Vite/Vitest resolve them by alias. No package build step.

## 5. Request lifecycle (dashboard write)

```text
1. Route handler receives request
2. resolveContext()      → user, org, role   (401/403 here, not later)
3. Zod parse of body     → typed input       (400 here)
4. requirePermission()   → role gate         (403)
5. Domain call in packages/core              (pure, testable)
6. Supabase call under the *user's* JWT      → RLS is the second gate
7. writeAuditLog() when the action is sensitive
8. Redacted response
```

RLS is never the only gate, and never bypassed for convenience. The service-role key is used in
exactly three places: migrations, the background worker, and the billing webhook — each documented
in `docs/SECURITY.md`.

## 6. Extension architecture (spec §15)

```text
popup/          Quick status, customer selector, "Detect fields"
sidepanel/      Rich review table, confidence, edit/skip, Fill button
content/        Field detection, safe fill application, floating launcher
background/     Service worker: auth, message routing, API calls (no DOM)
shared/         Message schemas (Zod), API client, storage helpers, types
```

Message flow:

```text
sidepanel ──DETECT_FIELDS──▶ background ──▶ content.detect()
content ────field metadata──▶ background ──POST /api/forms/map──▶ server
server ─────mapping proposal─▶ background ──▶ sidepanel (review UI)
user clicks Fill
sidepanel ──APPLY_FILL──────▶ background ──▶ content.fill()
content ────per-field result─▶ background ──PATCH /api/fill-sessions/:id──▶ server
```

Every message is parsed with a Zod schema on receipt, and the sender's origin is verified.
Field **values** only travel background → content at fill time; they are never persisted in
extension storage and never logged.

## 7. Background jobs (spec §17.5)

A `jobs` table plus a worker endpoint, rather than an external queue, because the MVP hosting
target is Vercel + Supabase.

```text
jobs(id, organization_id, type, payload, status, attempts, run_after, locked_until, ...)
```

- Producers insert a row inside the same transaction as the entity they act on.
- The worker claims rows with `FOR UPDATE SKIP LOCKED` and a `locked_until` lease.
- Handlers are idempotent, keyed on `(type, payload.entity_id)`.
- Job types: `ocr.extract`, `document.derivative`, `retention.sweep`, `billing.aggregate`,
  `adapter.healthcheck`, `notification.send`.

In local dev the worker is triggered by `POST /api/jobs/run`; in production by a scheduled cron.

## 8. Frontend structure

```text
apps/web/app
  (marketing)/          landing, pricing, demo request, legal
  (auth)/               sign-in, sign-up, forgot password
  (onboarding)/         org setup, first-run checklist
  (dashboard)/          home, customers, documents, document-tools,
                        applications, form-library, fill-sessions,
                        billing, settings, admin
  api/                  route handlers
  demo-forms/           locally served practice forms for QA
```

Server Components fetch through a per-request Supabase server client. Client islands (search,
review tables, tool editors) use TanStack Query against the same API routes the extension calls,
so both surfaces exercise one code path.

## 9. Environments

| Environment | Data                           | Notes                                    |
| ----------- | ------------------------------ | ---------------------------------------- |
| local       | seeded fake data               | `supabase start`, mock OCR, mock billing |
| development | fake data                      | shared, test keys                        |
| staging     | fake/demo only unless approved | Antigravity QA target                    |
| production  | real                           | strict redaction, backups, monitoring    |

## 10. What is intentionally not here

Per spec §4.2/§4.3: no physical E-card, no card reader, no citizen mobile app, no autonomous
submission agent, no custom-trained OCR model, no large portal-adapter library at V1.
