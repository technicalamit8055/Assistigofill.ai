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

`packages/ai/src/fixtures/` holds generated fake documents and their expected extraction output.
Every fixture is stamped **DEMO ONLY — NOT A VALID DOCUMENT** and uses the reserved fake ranges
from `docs/DATABASE.md` §7. Golden tests assert extracted keys, values and confidence bands.

No real document is ever committed, in any form, including cropped or redacted.
