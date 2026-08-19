# Form Detection and Field Mapping Engine

Derived from master spec §14.

---

## 1. Responsibilities

| Stage            | Where it runs                  | Output                                                     |
| ---------------- | ------------------------------ | ---------------------------------------------------------- |
| Detection        | content script                 | `DetectedField[]` — metadata only, no customer PII         |
| Classification   | `packages/form-engine`         | safety class per field (normal/captcha/otp/payment/submit) |
| Mapping          | server (`POST /api/forms/map`) | `FieldMapping[]` with `customerField`, confidence, reason  |
| Value resolution | server                         | proposed value per mapping, from the selected customer     |
| Review           | side panel                     | operator accepts / edits / skips                           |
| Fill             | content script                 | per-field result, no submit                                |
| Logging          | server                         | `fill_sessions` + `fill_session_fields`                    |

## 2. Detected field schema (§14.2)

The content script sends metadata only:

```ts
{
  signature: string; // stable hash of form+name+id+index
  tagName: 'input' | 'select' | 'textarea';
  inputType: string; // text | email | tel | date | select-one | radio | checkbox | file …
  name: string | null;
  id: string | null;
  placeholder: string | null;
  labelText: string | null;
  ariaLabel: string | null;
  nearbyText: string | null; // trimmed, capped at 120 chars
  sectionHeading: string | null;
  options: {
    value: string;
    label: string;
  }
  [] | null;
  required: boolean;
  maxLength: number | null;
  pattern: string | null;
  hasValue: boolean; // whether it is already filled — never the value itself
  visible: boolean;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  frame: number;
}
```

Plus page context: `origin`, `path`, `title`. **Full page HTML is never sent.**

## 3. Mapping strategy (§14.3)

Resolution order — first hit wins, and the reason is recorded so the operator can see _why_:

1. `adapter` — portal adapter exact mapping for a matching URL pattern
2. `org_custom` — organization-specific override
3. `history` — a mapping previously confirmed for the same portal + field signature
4. `dictionary` — rules-based synonym dictionary (English + Hindi + Hinglish)
5. `ai` — AI-assisted mapping using **field metadata only** (never customer values)
6. `manual` — the operator maps it by hand

## 4. Scoring

The dictionary matcher scores each candidate customer field:

| Signal                                               | Weight                         |
| ---------------------------------------------------- | ------------------------------ |
| exact normalized match on label                      | 1.00                           |
| exact match on `name`/`id` attribute                 | 0.95                           |
| exact match on aria-label / placeholder              | 0.90                           |
| token-subset match on label                          | 0.80                           |
| match on nearby text                                 | 0.65                           |
| input-type compatibility                             | ×0.5 penalty when incompatible |
| negative-keyword hit (e.g. "father" for `full_name`) | reject                         |

Confidence bands (§14.6):

| Band   | Range       | Behaviour                               |
| ------ | ----------- | --------------------------------------- |
| high   | 0.90 – 1.00 | fillable after preview                  |
| medium | 0.70 – 0.89 | shown in review, pre-checked            |
| low    | < 0.70      | requires explicit operator confirmation |

**Always review regardless of confidence**: Aadhaar-like number, PAN, bank account, category /
caste, income, disability, DOB sourced from low-quality OCR, and any value whose source field is
still `extracted` (unverified).

## 5. Safety classification (§14.5, §14.8, §19.7)

`packages/form-engine/src/safety.ts` exports pure predicates used by both the mapper and the
content script:

- `isCaptchaField(f)` — label/name/id/class contains captcha markers, or the field sits next to a
  captcha image/iframe. Result: **skip, never read**.
- `isOtpField(f)` — otp / one time password / verification code / ओटीपी. Result: **skip**.
- `isPaymentField(f)` — card number, cvv, expiry, upi id, netbanking credentials. Result:
  **never filled in MVP**.
- `isSubmitControl(el)` — `type=submit`, `type=image`, or a button whose text matches submit /
  proceed / pay / confirm / final. Result: **never clicked**.

The fill executor refuses these classes even if a mapping somehow proposes them. This is
belt-and-braces on purpose.

## 6. Adapter schema (§14.7)

```ts
type PortalAdapter = {
  id: string;
  portalName: string;
  formName: string;
  region?: string;
  urlPatterns: string[]; // glob-ish: https://demo.example/*/apply
  version: string;
  status: 'draft' | 'testing' | 'active' | 'deprecated';
  lastVerifiedAt?: string;
  fields: AdapterField[];
  documentRequirements: DocumentRequirement[];
  notes?: string;
};

type AdapterField = {
  key: string; // adapter-local id
  customerField: string; // customer.full_name
  selector?: string; // CSS selector, preferred when stable
  labelPatterns?: string[]; // fallback when selectors drift
  inputType: string;
  transform?: string; // named transform, see §7
  required?: boolean;
  reviewRequired?: boolean;
};
```

Adapters are data, not code — stored in `portal_adapters` and seeded from
`packages/form-engine/src/adapters/*.json`. A selector that no longer matches degrades to
`labelPatterns`, then to dictionary mapping, and raises an adapter-health warning.

## 7. Transforms

Named, pure, unit-tested functions in `packages/form-engine/src/transforms.ts`:

`date.ddmmyyyy` · `date.yyyymmdd` · `date.iso` · `text.upper` · `text.lower` · `text.titlecase` ·
`mobile.10digit` · `mobile.e164` · `pin.6digit` · `name.initials` · `gender.mf` · `gender.full` ·
`category.code` · `aadhaar.last4`

Transforms never invent data. If input is missing, the transform returns `null` and the field is
skipped rather than filled with a guess.

## 8. Dependent dropdowns

State → district → block chains are filled sequentially: set the parent, dispatch `change`, wait
for the child's option list to change (bounded wait, ~1.5 s), then match the child. If the child
never populates, the field is marked `skipped` with reason `dependent_not_ready` — never forced.

## 9. Fill execution rules

- Set value via the native property setter, then dispatch `input` and `change` with `bubbles:true`
  so React/Angular/Vue controlled inputs update.
- Never dispatch `submit`, never click a submit control, never press Enter in a form.
- Never touch a field that is disabled, readonly, hidden, or already filled — unless the operator
  explicitly chose "overwrite".
- Radio/checkbox: match by option value, then option label, then normalized label; otherwise skip.
- File inputs: cannot be set programmatically for security reasons. The extension surfaces the
  matching prepared derivative and the operator picks the file (spec §7.4.5).
- Every field produces a result row: `filled | skipped | edited | failed` plus a reason.

## 10. Unsupported forms and reports (§9.6)

Generic mapping still runs. Anything below the low threshold requires confirmation. The operator
can file a form report containing URL origin + path, anonymised field metadata, adapter id if any,
browser/extension version, and a free-text note. **No customer values are included by default**,
and a screenshot is attached only if the operator explicitly opts in for that report.
