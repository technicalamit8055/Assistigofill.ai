# Assistigo.ai

India-first AI form-filling SaaS for CSCs, cyber cafes, VLEs, CSPs and digital service centres.

Save a customer's details once. Extract information from Indian documents. Detect fields on
online forms. Fill supported forms quickly, prepare required documents, and track applications
from start to finish.

> **Source of truth:** [`docs/MASTER_BUILD_SPEC.md`](docs/MASTER_BUILD_SPEC.md).
> Do not add product scope that is not in that document.

---

## Hard product rules

These are non-negotiable and enforced across code review, tests and CI:

1. **No automatic submission.** Assistigo fills fields. A human clicks submit.
2. **No CAPTCHA bypass.** CAPTCHA fields are detected and skipped, never read or solved.
3. **No OTP automation.** OTP fields are detected and skipped.
4. **No payment autofill** in the MVP.
5. **No full Aadhaar storage** unless a legal review approves it and the org explicitly enables it.
   The default is last-four only.
6. **No real citizen data in development, tests, seeds or fixtures.**
7. **No customer PII in logs, error reports or adapter reports.**

See [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md).

---

## Repository layout

```text
apps/
  web/                Next.js dashboard + API (App Router, TypeScript)
  extension/          Chrome Manifest V3 extension
packages/
  core/               Domain logic: customers, documents, applications, billing, audit
  ai/                 OCR provider abstraction, extraction, normalisation, fixtures
  form-engine/        Field detection schema, mapping dictionaries, scoring, adapters
  document-tools/     Photo / signature / PDF preparation + portal presets
  database/           Seed data, RLS tests, generated types
  ui/                 Shared React primitives
supabase/             config.toml + SQL migrations (CLI-native location)
docs/                 Specification and derived engineering docs
tests/                E2E specs, fixtures, local demo forms
scripts/              Seeding, env verification, SQL checks, extension packaging
```

---

## Getting started

### Prerequisites

- Node.js 20.11+ (repo is developed on Node 24)
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local Postgres/Auth/Storage)
- Docker Desktop (required by the Supabase CLI)
- Google Chrome (for the extension)

### Install

```bash
npm install
cp .env.example .env.local
```

### Start the local backend

```bash
npx supabase start      # prints the anon key / service role key
npx supabase db reset   # applies supabase/migrations
```

Requires Docker Desktop. Without it the app still typechecks, builds and runs its unit tests,
but nothing can talk to a database.

Paste the printed keys into `.env.local`, then verify:

```bash
npm run verify:env
```

### Run the dashboard

```bash
npm run dev             # http://localhost:3000
```

### Build the extension

```bash
npm run build:extension
```

Then load `apps/extension/dist` in `chrome://extensions` with **Developer mode → Load unpacked**.

### Demo forms

Local practice forms live in [`tests/demo-forms/`](tests/demo-forms/) and are also served by the
dashboard at `/demo-forms`. They contain **no real portal branding and no real PII**.

---

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run check:sql   # parse-checks every migration, no Docker needed
npm test            # unit + extension
npm run test:rls    # requires a running local Supabase
```

---

## Status

Build progress is tracked against the phase plan in
[`docs/ROADMAP.md`](docs/ROADMAP.md) (§31 of the master spec).
