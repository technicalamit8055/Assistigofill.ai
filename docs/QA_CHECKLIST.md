# QA Checklist

Derived from master spec §30 and §23.3. Intended for Antigravity or a human QA pass.

**Never use real Aadhaar, PAN, mobile numbers or documents in QA.** Use seeded demo data only.

---

## Environment

- [ ] Target is local or staging, never production
- [ ] `npm run db:reset && npm run db:seed` completed
- [ ] Extension built from the same commit as the web app
- [ ] Browser console and network tab open for the whole pass

---

## Scenario 1 — New owner onboarding

1. Sign up with a fresh email
2. Create organization (business type, city, district, state, locale)
3. See the first-run checklist
4. Add a fake customer
5. Install / connect the extension
6. Open a demo form and fill it

- [ ] Onboarding completes with no developer help
- [ ] Dashboard shows whether the extension is connected
- [ ] No real identity numbers anywhere

## Scenario 2 — Document import

1. Upload a fake certificate PDF from `packages/ai/src/fixtures`
2. Wait for extraction
3. Review extracted fields
4. Accept some, edit one, reject one
5. Create the customer

- [ ] Each field shows its source document
- [ ] Low-confidence fields are visually distinct and not pre-accepted
- [ ] Rejected field never appears in autofill
- [ ] Audit entry exists for the accepted extraction

## Scenario 3 — Photo tool

1. Upload a fake photo
2. Apply a portal preset
3. Save the derivative and attach it to an application

- [ ] Output is inside the preset's size and dimension range
- [ ] Original file is unchanged and still downloadable
- [ ] Derivative metadata shows dimensions, size, format, preset, creator

## Scenario 4 — Supported form fill

1. Select a customer
2. Open the supported demo form
3. Detect fields, review mappings, fill

- [ ] Selected customer name + mobile last four visible throughout
- [ ] Confidence shown per field; low-confidence requires confirmation
- [ ] **Nothing is submitted**
- [ ] CAPTCHA placeholder is reported as skipped
- [ ] OTP placeholder is reported as skipped
- [ ] Filled / skipped / needs-review counts shown before and after
- [ ] Fill session appears in the dashboard
- [ ] Application record can be created from the result screen

## Scenario 5 — Permissions

1. Owner invites an operator
2. Operator signs in, creates a customer
3. Operator opens billing settings
4. Viewer tries to edit a customer

- [ ] Operator can create customers
- [ ] Operator is blocked from billing (UI **and** direct URL)
- [ ] Viewer cannot edit or run a fill
- [ ] Blocked attempts return 403, not a blank page

## Scenario 6 — Hindi UI

1. Switch locale to Hindi
2. Walk dashboard, customers, documents, applications
3. Fill the Hindi/English demo form

- [ ] No untranslated keys shown raw
- [ ] Devanagari renders cleanly, no clipping or overlap
- [ ] Longer Hindi labels do not break table or button layout
- [ ] Hindi field labels on the demo form map correctly

## Scenario 7 — Unsupported form

1. Open a demo form with no adapter
2. Detect and review

- [ ] Extension does not error
- [ ] Generic mapping offered with visible low confidence
- [ ] Form report can be filed
- [ ] Report body contains **no customer values** (verify in the network tab)

---

## Cross-cutting checks

- [ ] No customer PII in console logs
- [ ] No customer PII in network request bodies except the fill payload itself
- [ ] Document URLs are signed and expire
- [ ] Empty, loading and error states exist on every list
- [ ] Keyboard navigation works for customer search and the review table
- [ ] Focus is visible; form controls have labels

---

## Bug report format (§30.3)

```text
Title:
Severity:            blocker | major | minor | cosmetic
Environment:         local | staging, commit sha
User role:
Steps:
Expected:
Actual:
Evidence:            screenshot / video
Console/network:
Suspected area:
```

---

## Pre-pilot gate (§23.3)

- [ ] All P0 tests pass
- [ ] RLS tests pass
- [ ] Extension demo fill passes in Chrome
- [ ] No customer PII in logs
- [ ] Private document storage verified
- [ ] This checklist completed end to end
