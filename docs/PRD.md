# Assistigo.ai — Product Requirements (condensed)

Condensed from the master spec for day-to-day reference. Where this file and
[`MASTER_BUILD_SPEC.md`](MASTER_BUILD_SPEC.md) disagree, the master spec wins.

---

## Problem

Indian service-centre operators — CSCs, cyber cafes, VLEs, CSPs, recruitment form shops — retype
the same citizen details into government, exam, scholarship and banking portals dozens of times a
day. Typing is slow, mistakes cause rejections, and nothing is reusable for the next application.

## Product

Save a customer's details once. Extract details from Indian documents. Detect fields on online
forms. Fill supported forms after operator review. Prepare photos, signatures and PDFs to portal
requirements. Track applications end to end.

**Positioning:** India's AI form-filling assistant for CSCs and cyber cafes.
**Hindi line:** Customer details ek baar save karo. Government, recruitment, scholarship aur
online forms seconds mein bharo.

## Who it is for

Primary: cyber cafe operator on a Windows desktop with Chrome, serving many walk-in customers.
Secondary: CSC/VLE operators, CSP correspondents, recruitment centres, owners/managers.

## What makes it different

Generic autofill tools model **one person's** profile. Assistigo models **an operator's hundreds
of customers**, plus Indian document intelligence, Hindi/English field understanding, portal
document tools, and application tracking. The retention comes from being a service-centre
operating system, not a browser utility.

## MVP surface

| Area           | In MVP                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Dashboard      | home, customers, documents, document tools, applications, form library, fill sessions, billing, settings |
| Auth           | email/password, org setup, members, five roles                                                           |
| Customers      | Indian profile schema, search, manual + document import, field-level provenance                          |
| Documents      | private upload, classification, OCR with human review, retention controls                                |
| Document tools | photo / signature / PDF preparation with portal presets                                                  |
| Extension      | MV3, pairing auth, customer selector, detection, review, guided fill                                     |
| Applications   | records, status pipeline, document checklist, receipts                                                   |
| Platform       | audit logs, consent records, billing entitlements, Hindi/English, demo data                              |

## Explicitly not in V1

Physical E-card, card reader, citizen mobile app, autonomous submission agent, CAPTCHA bypass,
OTP automation, automatic submission, 1000 portal adapters, custom-trained OCR model, DigiLocker
replacement, regional languages beyond Hindi/English.

## Success measures for the pilot

| Measure                                      | Target                |
| -------------------------------------------- | --------------------- |
| Operators completing real workflows          | ≥ 5                   |
| Fields correctly filled on supported forms   | ≥ 85%                 |
| Time per repeat application vs manual        | ≥ 50% faster          |
| Operators who can state the value unprompted | ≥ 4 of 5              |
| Operators willing to pay after the trial     | measured, not assumed |

## Pricing hypothesis (placeholder, not committed)

Free ₹0 (limited) · Starter ₹299/mo · Professional ₹599/mo · Business ₹999+/mo, plus extra
AI-extraction credits. Limits are enforced server-side; the app runs fully in free mode without a
payment provider configured.

## Principles

1. The operator stays in control — Assistigo never submits.
2. The selected customer is always visible before any fill.
3. Risky fields get reviewed even at high confidence.
4. Field intelligence must handle English, Hindi and Hinglish labels.
5. Speed matters more than polish for multi-customer workflows.
6. No overclaiming — "supported forms", "guided autofill", never "works everywhere".
7. Privacy by default — store less, mask more, audit access, allow deletion.
