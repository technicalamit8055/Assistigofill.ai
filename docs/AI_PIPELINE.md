# Document Intelligence and OCR Pipeline

Derived from master spec §12.

---

## 1. Pipeline

```text
upload
  → file validation (size, mime, magic bytes)
  → malware scan hook (placeholder in MVP, interface in place)
  → private storage write
  → document classification
  → OCR / text extraction        (provider abstraction)
  → field extraction             (per document class)
  → validation + normalisation
  → confidence scoring
  → human review                 ← nothing reaches the profile before this
  → customer profile update
  → audit log
```

Steps after storage run as an `ocr.extract` background job so uploads stay fast and retryable.

## 2. Provider abstraction (§12.3)

```ts
export interface OcrProvider {
  readonly name: string;
  extract(input: OcrInput): Promise<OcrResult>;
}
```

| Provider    | Use                                                       | Status             |
| ----------- | --------------------------------------------------------- | ------------------ |
| `mock`      | local dev, tests, CI. Deterministic output from fixtures. | default            |
| `tesseract` | cheap local OCR for simple scans                          | optional           |
| `anthropic` | vision model for difficult layouts                        | **off by default** |

Selected by `OCR_PROVIDER`. The product is never hard-coded to one provider.

**The `anthropic` provider additionally requires** `organizations.settings.ai_processing_enabled
= true`, which an owner must switch on after reading the AI-processing notice. Without it the
pipeline falls back to the local provider and records a warning. Customer data is never used for
model training; only the provider request id is stored for audit, not the payload.

## 3. Document classes (§12.2)

`aadhaar_like` · `pan` · `voter_id` · `marksheet_10` · `marksheet_12` · `caste_certificate` ·
`income_certificate` · `residence_certificate` · `photo` · `signature` · `generic` · `unknown`

Classification is a scored keyword/layout match over the OCR text plus filename hints. `unknown`
is a first-class result — the operator can still attach and label the document by hand.

## 4. Extraction output (§12.4)

```json
{
  "documentType": "income_certificate",
  "provider": "mock",
  "fields": [
    {
      "key": "customer.full_name",
      "label": "Name",
      "value": "Amit Kumar",
      "confidence": 0.98,
      "sourceText": "Name: Amit Kumar",
      "page": 1,
      "bbox": [100, 200, 300, 230],
      "status": "needs_review"
    }
  ],
  "warnings": [
    { "code": "LOW_CONFIDENCE_ADDRESS", "message": "Address could not be extracted confidently." }
  ]
}
```

`status` is one of `needs_review` | `ok`. High-risk keys are always `needs_review` regardless of
confidence.

## 5. Normalisation (§12.5)

| Value        | Rule                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Dates        | parsed from `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy-mm-dd`, `d MMM yyyy`; stored ISO; displayed `dd/mm/yyyy`         |
| Mobile       | strip separators, drop `+91`/`0` prefix, must be 10 digits starting 6–9                                        |
| PIN          | exactly 6 digits, first digit 1–8                                                                              |
| PAN          | `^[A-Z]{5}[0-9]{4}[A-Z]$` — **format check only, never proof of authenticity**                                 |
| Aadhaar-like | 12 digits + Verhoeff checksum used only to decide "looks like an Aadhaar"; **only the last four are retained** |
| Names        | preserved as printed. Whitespace collapsed. Never title-cased, never transliterated.                           |
| Address      | components extracted **and** the full printed address retained verbatim                                        |

Normalisation never discards the original: `sourceText` always carries what was actually read.

## 6. Confidence and review (§12.6)

- `< 0.70` → low, must be confirmed
- `0.70 – 0.89` → medium, shown in review
- `≥ 0.90` → high, still previewed

Always `needs_review` regardless of confidence: `customer.aadhaar_last4`, `customer.pan`,
`customer.bank_account`, `customer.category`, `customer.annual_income`,
`customer.disability_status`, `customer.date_of_birth`.

The review screen shows, per field: detected label, proposed value, confidence, the source
document, and the source text snippet. The operator accepts, edits, or rejects. Accepting writes
to `customers` **and** to `customer_field_values` with status `operator_verified`, plus an audit
entry. Rejecting keeps the extracted value in `customer_field_values` as `rejected` for
traceability but never surfaces it for autofill.

## 7. Retention (§12.7)

- Documents are stored only when the operator attaches them to a customer.
- Temporary processing artefacts are deleted at the end of the job.
- Raw OCR text is retained only while the extraction is unreviewed, then truncated to the matched
  snippets.
- Org-level retention setting drives the `retention.sweep` job.
- Delete controls exist at document, customer and organization level.

## 8. Fixtures and golden tests (§23.1)

`packages/ai/src/fixtures.ts` holds the fake documents and their expected extraction output.
Every fixture is stamped **DEMO ONLY — NOT A VALID DOCUMENT** and uses the reserved fake ranges
from `docs/DATABASE.md` §7. Golden tests in `pipeline.test.ts` assert classification, extracted
keys, values and review status.

The Aadhaar-like fixture deliberately **fails** the Verhoeff checksum. It is Aadhaar-shaped, so
it exercises the extractor and the masking path, but it can never collide with a real allocated
number — which a checksum-valid twelve-digit number could.

No real document is ever committed, in any form, including cropped or redacted.

## 9. Where the Aadhaar rule is enforced

`packages/ai/src/safety.ts` is the single gate. Every extracted field, every source snippet and
the retained raw text pass through it before anything is persisted:

- any twelve-digit run is masked to `XXXX XXXX 1234` — deliberately broader than the Verhoeff
  check, because a misread Aadhaar is still an Aadhaar we must not store,
- `customer.aadhaar_last4` is reduced to four digits whatever the extractor produced,
- a field keyed to a full number (`customer.aadhaar`, `customer.uid`, …) is dropped outright.

`safety.test.ts` is a regression suite for a product rule, not an implementation detail
(docs/DEVELOPMENT_RULES.md §1 rule 5). Do not weaken it.

## 10. Running the pipeline

Extraction runs as a background job, not inside the upload request:

```text
POST /api/documents/upload-intent   → row reserved, one-time signed upload URL returned
PUT  <signed upload url>            → bytes go browser → storage, never through a route handler
POST /api/documents/:id/process     → magic bytes sniffed server-side, then `ocr.extract` queued
POST /api/jobs/run                  → worker claims the job and runs this pipeline
GET  /api/documents/:id/extraction  → the review payload
POST /api/documents/:id/review      → the human gate; the only path into a customer profile
```

`/api/jobs/run` uses the service-role client, so it is gated on `JOB_RUNNER_SECRET` and **fails
closed**: with the secret unset it refuses every request rather than running unauthenticated
work. Point a scheduler at it.

---

## 11. Pasted text

An operator often already has a customer's details as text — copied out of a portal, an email, a
spreadsheet or a message. Retyping it is the slow step the product exists to remove, so pasted
text gets the same treatment a document gets, minus the two steps that only apply to a scan:

```text
paste
  → line splitting            (packages/ai/src/text.ts)
  → field extraction          (the same LABEL_RULES dictionary)
  → validation + normalisation
  → confidence scoring
  → human review              ← nothing reaches the profile before this
  → customer profile update
  → audit log
```

There is no OCR and no classification. The operator chose the text, so there is no scan quality
to discount — block confidence is 1.0 and the score reflects label quality alone — and there is
no document class to guess, so the **whole** dictionary is in scope
(`ALL_EXTRACTABLE_FIELD_KEYS`) rather than one class's fields. Restricting pasted text to
`FIELDS_BY_DOCUMENT_TYPE.generic` would silently drop fields the operator deliberately typed.

The splitter handles the shapes real pastes arrive in:

| Shape                                       | Handling                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `Label: Value` per line                     | as-is                                                             |
| `Label = Value`                             | `=` accepted alongside `:`, `  `, ` - `                          |
| `A: 1, B: 2, C: 3` on one line              | split at a separator **only** when a new `label:` follows         |
| `Address: H.No 12, Rampur, Ghazipur`        | not split — the lookahead needs a label, so the address survives   |
| `Father's Name` / `Ram Kumar` on two lines | paired, but only if line 1 is a known label and line 2 is not      |

Two things are deliberately different from the document path:

1. **Nothing is persisted at parse time.** A document keeps its raw text until review because
   the reviewer needs to check the extractor against the page. Pasted text is already in front
   of the operator, so a second copy would be retention with no purpose (§7). There is no row,
   no file and no `document_extractions` record; the text lives in the request and the browser
   tab only.
2. **The write route re-validates every value.** Because nothing was stored, the accepted values
   arrive from the client. `POST /api/customers/:id/values` therefore checks each key against
   the field registry and runs every value through `sanitizeExtractedFields` (§9) before
   writing, so a full Aadhaar cannot be smuggled in under a permitted key.

```text
POST /api/customers/parse-text     → proposed fields; stores nothing
POST /api/customers/:id/values     → the human gate; the only path into a customer profile
```

Accepting writes to `customers` **and** `customer_field_values` with status
`operator_verified` and `source_document_id = null`, exactly as document review does — which
is what makes the values available to the form engine for autofill (§14).
