# Assistigo.ai — agent instructions

## Read first

1. `docs/MASTER_BUILD_SPEC.md` — the single source of truth for product scope.
2. `docs/DEVELOPMENT_RULES.md` — coding standards and the non-negotiable product rules.
3. The doc for the area you are touching: `ARCHITECTURE`, `DATABASE`, `SECURITY`,
   `AI_PIPELINE`, `EXTENSION`, `FORM_ENGINE`.
4. `docs/ROADMAP.md` — current phase and status.

## Never do these

- Add auto-submit, CAPTCHA bypass, OTP automation or payment autofill.
- Store a full Aadhaar number.
- Put customer PII in logs, error reports or portal adapter reports.
- Use real citizen data in seeds, fixtures or tests.
- Copy competitor branding, copy, layout or assets.
- Invent product scope that is not in the master spec.
- Weaken or delete the safety regression tests.

## Working loop

```text
read the relevant docs → plan a small task → implement → test → self-review → fix → summarise
```

Before coding, state: what you will build, which files you will touch, which tests you will add,
and any privacy/security risk. After coding, run the checks and report the real output.

## Commands

```bash
npm run dev            # dashboard on :3000
npm run build:extension
npm run typecheck
npm run lint
npm test               # unit + extension
npm run test:rls       # needs a local Supabase running
npm run db:reset       # migrations
npm run db:seed        # fake demo data
```

## Conventions

- TypeScript strict; `any` is a lint error; validate every external input with Zod.
- Database `snake_case`; TS `camelCase`; components `PascalCase`.
- Customer field keys look like `customer.father_name`.
- Domain logic lives in `packages/*`, not in React components.
- Authorization is checked server-side in every route handler, and again by RLS.
- Every user-facing string goes through a translation key (`en` + `hi`).

## Escalate, do not guess

Stop and ask the product owner when a decision affects privacy, billing or legal risk —
for example storing a new sensitive field, sending data to a third party, or changing what is
retained.
