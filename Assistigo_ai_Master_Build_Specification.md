# Assistigo.ai Master Build Specification

Version: 1.0  
Date: 2026-08-16  
Audience: Claude Code, Antigravity, product owner, future engineers  
Primary artifact type: Implementation source of truth

---

## 1. Document Purpose

This document is the single source of truth for building Assistigo.ai.

Assistigo.ai is an India-first AI form-filling SaaS for CSCs, cyber cafes, VLEs, CSPs, online form centres, recruitment form shops, and digital service centres.

The product direction is inspired by the simple UX principle seen in modern AI autofill tools:

1. Save useful profile information once.
2. Detect fields on a web form.
3. Fill the form in one click after user review.

Assistigo must not copy FillGenius branding, code, text, proprietary design, visual identity, screenshots, pricing page, or implementation. The inspiration is limited to the general workflow principle of reducing repetitive form entry. Assistigo must differentiate through Indian service-centre workflows, multi-customer management, Indian document intelligence, Hindi/English support, document resizing tools, application tracking, and operator-first B2B SaaS features.

This specification translates the original Assistigofill AI proposal into a realistic software-first build plan. The original proposal's AI-enabled browser extension concept is retained. The physical E-card and card-reader concept is explicitly deferred.

---

## 2. Source Inputs

### 2.1 Original Assistigofill AI Proposal

The uploaded 2024 proposal defined the original problem:

- Online form filling for government services, banking applications, and official documents is slow and error-prone.
- Manual data entry causes mistakes, missed deadlines, rejected applications, and repeated re-entry when portals fail.
- Digitally underserved users such as farmers, elderly people, and people without smartphones depend on intermediaries like cyber cafes, CSCs, and CSPs.
- The proposed solution included an AI-enabled browser extension that reads uploaded documents, extracts information, auto-fills online forms, and uploads required documents.
- The proposal also suggested a subscription model for cyber cafes, CSCs, CSPs, and government service providers.
- The proposal included a future physical E-card and card-reader system for offline document access.

### 2.2 Updated Product Direction

The updated direction is:

- Build Assistigo.ai as a B2B SaaS for Indian service-centre operators.
- Prioritize customer profiles, document intelligence, reusable data, browser autofill, document tools, and application tracking.
- Focus on CSCs, cyber cafes, VLEs, CSPs, and digital service centres.
- Start with a software-first MVP.
- Validate with a small group of real operators before expanding.
- Do not build hardware, physical cards, or offline card readers in V1.

---

## 3. Executive Vision

### 3.1 Product Statement

Assistigo.ai is India's AI form-filling assistant for CSCs, cyber cafes, VLEs, and digital service centres.

It helps operators save a customer's details once, extract information from Indian documents, detect fields on online forms, fill supported forms quickly, prepare required documents, and track applications from start to finish.

### 3.2 Positioning

Primary positioning:

> India's AI form-filling assistant for CSCs and cyber cafes.

Secondary positioning:

> Customer details ek baar save karo. Government, recruitment, scholarship aur online forms seconds mein bharo.

### 3.3 Product Promise

Assistigo should help service-centre operators:

- Reduce repetitive typing.
- Reduce form mistakes.
- Serve more customers per day.
- Reuse customer data across many applications.
- Prepare photos, signatures, and PDFs to portal requirements.
- Track customer applications and documents in one place.

### 3.4 Differentiation

Generic AI autofill tools focus on one person's reusable profile. Assistigo focuses on hundreds or thousands of customers handled by an operator.

| Generic autofill | Assistigo.ai |
|---|---|
| Individual user profiles | Multi-customer service-centre CRM |
| Generic web forms | Indian government, recruitment, scholarship, banking, education, and service forms |
| Simple saved fields | Indian customer profile with address, family, identity, certificates, education, documents |
| English-first | Hindi/English interface and field intelligence |
| Autofill only | Autofill plus document tools and application tracking |
| One user workflow | Owner, staff, branch, and customer workflow |
| Generic documents | Aadhaar-like IDs, PAN, marksheets, certificates, photos, signatures, receipts |
| No local workflow context | CSC/cyber-cafe/VLE operating system |

---

## 4. Strategic Scope

### 4.1 MVP Scope

The MVP must include:

- Web dashboard.
- Authentication and organization setup.
- Organization members and roles.
- Customer database.
- Indian customer profile schema.
- Customer search.
- Manual customer creation.
- Document upload.
- OCR/extraction pipeline with human review.
- Document classification.
- Document storage.
- Photo/signature/PDF tools.
- Basic application tracking.
- Chrome Manifest V3 extension.
- Extension authentication.
- Customer selection from extension.
- Form detection.
- Field mapping.
- Fill preview.
- One-click guided fill.
- No automatic submission.
- No CAPTCHA bypass.
- No OTP automation.
- Form library/adapters for supported portals.
- Usage logging.
- Billing/pricing hooks.
- Hindi/English localization foundation.
- Security, audit logs, consent records, and deletion workflows.
- Seed/demo data and demo form pages for QA.

### 4.2 MVP Non-Goals

Do not build these in V1:

- Physical E-card.
- Card reader hardware.
- Offline physical card sync.
- Citizen mobile app.
- Full autonomous government application agent.
- CAPTCHA bypass.
- OTP automation.
- Automatic final submission.
- Scraping private government data without authorization.
- "Works on every form in India" claim.
- 1,000 portal integrations.
- Custom trained OCR model.
- Complex regional language support beyond Hindi/English foundation.
- Government partnership dependency.
- DigiLocker replacement.
- Long-term permanent storage of every uploaded raw document by default.

### 4.3 Explicit E-Card Deferral

The original proposal's physical E-card/card-reader idea is deferred to a future research phase. It is not part of the MVP, not part of the V1 architecture, and not part of the development backlog except as a documented future possibility.

Reason:

- Hardware increases cost, logistics, support, warranty, and compliance burden.
- Sensitive identity/document storage creates high privacy risk.
- India already has mature digital document infrastructure such as DigiLocker.
- Assistigo's first business must prove software value for operators before considering hardware.

Future reconsideration criteria:

- At least 5,000 paying service-centre customers.
- Clear legal/privacy review.
- Proven customer demand for offline use.
- Hardware partner identified.
- Secure element/card security design reviewed.
- Pilot economics validated.

---

## 5. Target Users

### 5.1 Primary User

Cyber cafe operator:

- Handles many customers daily.
- Fills exam, recruitment, scholarship, government, certificate, and service forms.
- Stores customer photos, signatures, IDs, certificates, and receipts.
- Wants speed, fewer typing errors, and repeat-customer convenience.
- Usually works from a Windows desktop/laptop with Chrome.

### 5.2 Secondary Users

CSC/VLE operator:

- Processes citizen services and local government-related workflows.
- Needs multi-customer history, document handling, and application tracking.
- May have staff members and multiple service desks.

CSP/banking correspondent:

- Handles customer onboarding and banking-related forms.
- Needs stricter privacy controls and audit logs.

Recruitment/application centre:

- Fills job, exam, admission, and scholarship forms.
- Needs photo/signature resizing and repeat applicant data.

Owner/manager:

- Needs billing, staff permissions, usage analytics, application volume, and subscription controls.

### 5.3 Future Users

- Schools and colleges.
- Education consultants.
- Insurance agents.
- HR/recruitment agencies.
- Immigration/document consultants.
- Regional service franchises.

---

## 6. User Roles and Permissions

### 6.1 Platform Roles

Super Admin:

- Internal Assistigo team only.
- Can manage platform-wide configuration, organizations, billing overrides, support tooling, and feature flags.
- Must not view sensitive customer documents unless a support access grant is active and audited.

Support Admin:

- Internal support team.
- Can view organization metadata, error reports, usage, and support tickets.
- Cannot view raw customer documents by default.
- Any temporary access to customer records must require explicit organization approval, time limit, reason, and audit log.

### 6.2 Organization Roles

Org Owner:

- Creates organization.
- Manages subscription.
- Invites/removes members.
- Manages all customers, documents, applications, and settings.
- Can export/delete organization data.

Manager:

- Manages customers, documents, applications, staff work, and branch-level settings.
- Cannot change billing owner or delete the organization.

Operator:

- Creates and edits customers.
- Uploads documents.
- Runs OCR review.
- Uses extension to fill forms.
- Creates and updates applications.
- Cannot change billing or organization security settings.

Viewer:

- Can view assigned customers and applications.
- Cannot edit customer identity fields or run fills.

Billing Admin:

- Manages plans, invoices, usage, and payment methods.
- No customer document access unless combined with another role.

### 6.3 Customer Role

The end citizen/customer is not a full dashboard user in MVP. They are represented as a customer profile inside the service centre's organization.

Future customer portal may allow:

- Consent review.
- Document upload.
- Application status.
- Data deletion request.

---

## 7. Complete Product Surface Inventory

### 7.1 Public Website

1. Landing page
   - Positioning for CSCs and cyber cafes.
   - Before/after workflow.
   - Product screenshots or demo animation.
   - Pricing preview.
   - CTA: Start Free, Watch Demo, Contact Sales.
   - Trust/security note.

2. Pricing page
   - Free, Starter, Professional, Business.
   - Usage limits, AI extraction credits, fill credits, seats.
   - Clear fair-use policy.

3. Demo request page
   - Name, mobile, business type, city/state, number of forms/month.

4. Legal pages
   - Privacy Policy.
   - Terms of Service.
   - Data Processing Addendum placeholder.
   - Acceptable Use Policy.
   - Security page.

### 7.2 Authentication and Onboarding

1. Sign up
   - Email/password and optional phone number.
   - Google sign-in optional.
   - Terms/privacy consent.

2. Sign in
   - Email/password.
   - Forgot password.
   - Optional OTP/MFA later.

3. Organization setup
   - Business name.
   - Business type: cyber cafe, CSC/VLE, CSP, digital service centre, recruitment centre, other.
   - City, district, state.
   - Preferred language: English, Hindi.
   - Approximate monthly forms.

4. First-run checklist
   - Add first customer.
   - Upload first document.
   - Install Chrome extension.
   - Try demo form.

### 7.3 Web Dashboard

1. Home dashboard
   - Today's forms filled.
   - Customers served.
   - Documents processed.
   - Applications pending.
   - Time saved estimate.
   - Quick actions.
   - Recent customers.
   - Recent applications.
   - Extension connection status.

2. Customers list
   - Search by name, mobile, customer code, document number last four, village, district.
   - Filters: created date, missing documents, recent activity, assigned operator.
   - Bulk import placeholder.

3. Add customer
   - Manual entry.
   - Import from document.
   - Quick minimal profile.

4. Customer profile
   - Overview.
   - Personal details.
   - Family details.
   - Contact.
   - Address.
   - Identity documents.
   - Education.
   - Certificates.
   - Photo/signature.
   - Applications.
   - Documents.
   - Notes.
   - Consent and privacy.
   - Audit history.

5. Documents
   - All documents.
   - Customer-specific documents.
   - Upload.
   - Classification.
   - Extraction status.
   - Expiry/validity.
   - Download/delete.

6. Document tools
   - Photo crop/resize/compress.
   - Signature crop/resize/compress.
   - PDF compress.
   - PDF merge.
   - PDF split.
   - Convert image to PDF.
   - Portal requirement presets.

7. Applications list
   - Status pipeline.
   - Customer.
   - Portal/form type.
   - Assigned operator.
   - Deadline.
   - Amount charged.
   - Portal reference number.

8. Application detail
   - Customer snapshot.
   - Form metadata.
   - Required documents.
   - Filled fields summary.
   - Upload checklist.
   - Notes.
   - Receipts.
   - Status history.
   - Follow-up reminders.

9. Form library
   - Supported portals/forms.
   - Form adapter status.
   - Last verified date.
   - Region/state.
   - Document requirements.
   - Known issues.

10. Fill sessions
   - Logs of form detection and filling.
   - Fields detected.
   - Fields filled.
   - Fields skipped.
   - Errors.
   - Linked application.

11. Billing
   - Current plan.
   - Usage.
   - Seats.
   - AI extraction credits.
   - Fill credits.
   - Invoices.
   - Upgrade/downgrade.

12. Settings
   - Organization profile.
   - Members.
   - Roles.
   - Branches.
   - Language.
   - Data retention.
   - Export/delete data.
   - Security.
   - Extension devices.
   - API keys/webhooks future placeholder.

13. Admin/support area
   - Internal only.
   - Organization list.
   - Usage metrics.
   - Error trends.
   - Adapter health.
   - Support access requests.

### 7.4 Chrome Extension

1. Extension popup
   - Sign in/connect account.
   - Current organization.
   - Selected customer.
   - Open dashboard.
   - Start detection.

2. Floating widget or side panel
   - Customer selected.
   - Fields detected.
   - Ready to fill.
   - Needs review.
   - Unsupported fields.
   - Review and Fill.
   - Create application.

3. Customer selector
   - Recent customers.
   - Search.
   - Quick create minimal customer.
   - Sync selected customer with dashboard.

4. Field review screen
   - Field label from page.
   - Mapped customer field.
   - Proposed value.
   - Confidence.
   - Edit/skip.
   - Reason for low confidence.

5. Document attachment helper
   - Detected file input.
   - Required file type/size if known.
   - Suggested customer document.
   - Prepare file using document tools.
   - User manually confirms upload where browser restrictions require.

6. Fill result screen
   - Filled count.
   - Skipped count.
   - Manual review needed.
   - Save application record.
   - Report issue.

7. Unsupported form screen
   - Generic fill attempt available.
   - Report portal/form to Assistigo.
   - Create adapter request.

---

## 8. Core UX Principles

1. Operator stays in control.
   - Assistigo may detect, suggest, and fill.
   - Assistigo must not automatically submit final applications.

2. Customer-first selection.
   - Before filling any form, the operator must know which customer is selected.
   - The extension must clearly show selected customer name and mobile last digits.

3. Review before risky action.
   - Low-confidence extraction requires human review.
   - High-risk fields like Aadhaar, PAN, bank details, caste/category, DOB, and income require clear review in MVP.

4. Indian form language intelligence.
   - Fields can appear in English, Hindi, Hinglish, abbreviations, and portal-specific names.
   - Example: "Father's Name", "पिता का नाम", "Guardian Name", "Applicant Father Name" may map to related profile fields.

5. Multi-customer workflow.
   - The system must be fast for operators serving many customers.
   - Search and recent customer access must be excellent.

6. No magical overclaiming.
   - Use "supported forms" and "guided autofill".
   - Never claim perfect accuracy or every portal compatibility.

7. Privacy by default.
   - Store less, protect more, audit access, allow deletion.

8. Service-centre OS, not only autofill.
   - Applications, documents, receipts, status, and follow-up create retention.

---

## 9. Key UX Flows

### 9.1 New Organization Onboarding

1. Owner signs up.
2. Creates organization.
3. Selects business type and state.
4. Sees setup checklist.
5. Adds first customer manually or by document import.
6. Installs Chrome extension.
7. Opens demo test form.
8. Selects customer.
9. Reviews detected mappings.
10. Fills demo form.
11. Sees first successful fill session.

Acceptance criteria:

- A new user can complete onboarding without developer assistance.
- The dashboard clearly shows whether the extension is installed/connected.
- Demo data is available without using real Aadhaar/PAN numbers.

### 9.2 Add Customer Manually

1. Operator clicks New Customer.
2. Enters required minimal fields: full name, mobile, state/district.
3. Optionally adds DOB, gender, father's name, address.
4. Saves profile.
5. Customer profile opens.
6. Operator can add documents later.

Acceptance criteria:

- Minimal customer can be created in under 30 seconds.
- Duplicate warning appears if mobile/name/date-of-birth combination is similar.
- No sensitive field is required unless needed by a form.

### 9.3 Import Customer From Documents

1. Operator clicks Add Customer > Import from document.
2. Uploads one or more documents.
3. Backend runs file validation, malware scan placeholder, classification, OCR, extraction, validation.
4. Review screen shows detected fields and confidence.
5. Operator accepts, edits, or rejects fields.
6. Customer profile is created or merged into existing profile.
7. Source document links remain attached to extracted fields.

Acceptance criteria:

- The operator can see which document each extracted field came from.
- Low-confidence fields are not silently saved as confirmed.
- The system supports partial extraction.
- The operator can create a customer even if only name/mobile/address is extracted.

### 9.4 Prepare Photo or Signature

1. Operator opens Document Tools.
2. Selects customer photo/signature or uploads file.
3. Chooses portal preset or custom requirements.
4. Crops, resizes, and compresses.
5. Preview shows dimensions, file size, and format.
6. Saves prepared version to customer documents or downloads.

Acceptance criteria:

- User can produce a JPG/PNG within target size range.
- Original file is preserved unless explicitly deleted.
- Prepared derivative records store preset and output metadata.

### 9.5 Fill a Supported Web Form

1. Operator opens target portal in Chrome.
2. Extension detects form.
3. Operator selects customer or confirms already selected customer.
4. Extension extracts form fields and sends safe metadata to backend mapping service.
5. Mapping service returns proposed mappings and confidence.
6. Operator reviews low-confidence fields.
7. Operator clicks Fill.
8. Extension fills fields.
9. Operator manually verifies and completes CAPTCHA/OTP if present.
10. Operator submits manually.
11. Assistigo saves fill session and optionally creates application record.

Acceptance criteria:

- The extension never clicks final submit.
- The extension never attempts to read or solve CAPTCHA.
- The extension never attempts OTP retrieval or automated OTP entry.
- The operator sees filled/skipped/needs-review counts before and after fill.

### 9.6 Fill an Unsupported Form

1. Operator opens a form not in the adapter library.
2. Extension runs generic detector.
3. If confidence is acceptable, guided fill is offered.
4. Low-confidence mappings require review.
5. Operator can report the form for adapter support.

Acceptance criteria:

- Unsupported forms do not break the extension.
- Form report captures URL pattern, anonymized field metadata, screenshot only if user explicitly consents, and notes.
- No customer PII is included in adapter reports by default.

### 9.7 Track an Application

1. Operator creates an application from customer profile, dashboard, or after fill.
2. Selects portal/form type.
3. Adds required documents checklist.
4. Sets status.
5. Adds portal reference number after submission.
6. Adds fee charged and internal notes.
7. Uploads receipt if needed.
8. Marks complete, rejected, pending, or follow-up required.

Acceptance criteria:

- Every application belongs to one organization and one customer.
- Application status history is audited.
- Application can exist without autofill session because some applications are manual.

---

## 10. MVP Requirements

### 10.1 P0 Requirements

P0 means required before pilot use.

- Secure authentication.
- Organization-based multi-tenancy.
- Roles: owner, manager, operator.
- Customer CRUD.
- Customer search.
- Document upload and storage.
- OCR/extraction pipeline interface.
- Human review for extracted fields.
- Chrome MV3 extension sign-in/connect flow.
- Extension customer selector.
- Form field detector.
- Field mapping preview.
- Guided autofill.
- No automatic submission.
- Application records.
- Audit logs for sensitive changes.
- Basic billing entitlements.
- Hindi/English locale infrastructure.
- Demo form and seed data.
- RLS/security tests.
- Extension E2E tests on demo forms.

### 10.2 P1 Requirements

P1 means valuable shortly after pilot begins.

- Form adapter library.
- 5 to 10 validated high-volume workflows based on operator interviews.
- Document requirement presets.
- Photo/signature/PDF tools.
- Usage analytics.
- Team invites.
- Billing checkout and webhooks.
- Export customer data.
- Data deletion request workflow.
- Extension issue reporting.
- Portal adapter health dashboard.

### 10.3 P2 Requirements

P2 means after paid beta.

- WhatsApp notifications.
- Receipts/invoices to end customers.
- Branch management.
- Regional language expansion.
- Advanced application follow-up reminders.
- Bulk customer import.
- Duplicate customer merge.
- More portal adapters.
- Public API/webhooks.
- Customer portal.

---

## 11. Indian Customer Profile Model

### 11.1 Design Principles

- Do not force Western first-name/last-name assumptions.
- Use full name as the primary name field.
- Preserve names exactly as entered in documents.
- Support aliases and spelling variants.
- Avoid storing full sensitive document numbers unless needed.
- Store masked display values and encrypted full values separately where legally approved.
- Keep extracted-but-unconfirmed values separate from verified values.
- Track data source and confidence.

### 11.2 Profile Sections

Personal:

- Full name.
- Name in Hindi.
- Date of birth.
- Age derived from DOB, never stored as primary.
- Gender.
- Marital status.
- Category: General/OBC/SC/ST/EWS/Other, where required.
- Religion optional and sensitive.
- Nationality.

Family:

- Father's name.
- Mother's name.
- Spouse name.
- Guardian name.
- Relationship to guardian.

Contact:

- Mobile number.
- Alternate mobile.
- Email.
- WhatsApp available flag.

Address:

- House number/building.
- Street/locality.
- Village/town/city.
- Ward.
- Post office.
- Panchayat.
- Block.
- Police station.
- District.
- State.
- PIN code.
- Country.
- Address as printed on source document.
- Current/permanent address distinction.

Identity:

- Aadhaar last four only by default.
- Aadhaar full number encrypted only if a legal/privacy review approves and product owner explicitly enables.
- PAN.
- Voter ID.
- Driving licence.
- Passport.
- Ration card.
- Other state/local IDs.

Education:

- 10th board, school, passing year, roll number, marks/grade.
- 12th board, school/college, passing year, roll number, marks/grade.
- Graduation university, college, course, registration number, roll number, year.
- Other qualifications.

Certificates:

- Caste certificate.
- Income certificate.
- Residence/domicile certificate.
- EWS certificate.
- Disability certificate.
- Birth certificate.
- Death certificate for dependent applications.
- Certificate number.
- Issue date.
- Issuing authority.
- Expiry date when applicable.

Documents:

- Photo.
- Signature.
- Aadhaar-like ID image/PDF.
- PAN image/PDF.
- Marksheets.
- Certificates.
- Receipts.
- Application PDFs.
- Prepared derivatives for portal requirements.

Optional banking fields:

- Bank name.
- Account holder name.
- Account number encrypted.
- IFSC.
- Branch.
- Use only if required by target workflows and privacy policy supports it.

### 11.3 Field State

Each important customer field should support:

- Value.
- Verification status: unverified, extracted, operator_verified, customer_confirmed, expired, rejected.
- Source document ID.
- Confidence score.
- Last updated by.
- Last updated at.

---

## 12. Document Intelligence and OCR Pipeline

### 12.1 Pipeline Overview

The pipeline must be modular:

```text
Upload
  -> file validation
  -> malware scan placeholder
  -> storage quarantine
  -> document classification
  -> OCR/text extraction
  -> field extraction
  -> validation and normalization
  -> confidence scoring
  -> human review
  -> customer profile update
  -> audit log
```

### 12.2 Document Classes

MVP document classes:

- Aadhaar-like identity document.
- PAN.
- Voter ID.
- 10th marksheet.
- 12th marksheet.
- Caste certificate.
- Income certificate.
- Residence/domicile certificate.
- Photo.
- Signature.
- Generic PDF/image.

The system must allow unknown classification.

### 12.3 OCR Provider Interface

Create a provider abstraction:

```ts
interface OcrProvider {
  name: string;
  extract(input: OcrInput): Promise<OcrResult>;
}
```

Possible providers:

- Local Tesseract for low-cost development and simple images.
- Cloud OCR provider for production-quality extraction.
- AI vision model for difficult layouts where allowed by privacy policy.

Never hard-code the product to a single provider. Do not send sensitive documents to AI providers without organization-level configuration, privacy policy coverage, and data processing review.

### 12.4 Extraction Output

Extraction must output structured data:

```json
{
  "documentType": "income_certificate",
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
    {
      "code": "LOW_CONFIDENCE_ADDRESS",
      "message": "Address could not be extracted confidently."
    }
  ]
}
```

### 12.5 Validation and Normalization

Rules:

- Date formats must be normalized to ISO date internally.
- Display dates in Indian-friendly format.
- PIN code must be six digits.
- Mobile number must support +91 normalization.
- PAN format validation should exist but not be treated as proof of authenticity.
- Aadhaar-like number validation must be handled carefully and masked by default.
- Names must not be over-normalized; preserve original spelling.
- Address components should be extracted but original full address must also be retained.

### 12.6 Human Review

Review UI must:

- Show detected field, value, confidence, and source document.
- Allow accept/edit/reject.
- Highlight low-confidence values.
- Mark high-risk fields for review even with high confidence.
- Save confirmation audit log.

### 12.7 Document Retention

Default policy for MVP:

- Store uploaded documents only when the operator explicitly attaches them to a customer.
- Provide delete controls.
- Provide retention settings at organization level.
- Keep processing logs without exposing raw PII where possible.
- Do not keep temporary processing files longer than necessary.

---

## 13. Document Tools

### 13.1 Why Document Tools Matter

Indian service-centre operators spend significant time preparing files for portal-specific requirements:

- Photo size.
- Signature size.
- File format.
- PDF size.
- Document pages.
- Image clarity.

Assistigo should make this part of the same workflow as form filling.

### 13.2 Tool Inventory

Photo tool:

- Crop to face/passport format.
- Resize by pixels.
- Resize by cm/inch at DPI.
- Compress to target KB.
- Convert to JPG/PNG.
- Background check placeholder.

Signature tool:

- Crop whitespace.
- Convert to black/white optional.
- Resize by pixels.
- Compress to target KB.
- Transparent/white background options.

PDF tool:

- Compress PDF.
- Split pages.
- Merge PDFs/images.
- Convert image to PDF.
- Reorder pages.
- Generate portal-ready derivative.

Requirement presets:

- Preset name.
- Accepted file types.
- Min/max file size.
- Dimensions.
- DPI.
- Color mode.
- Notes.

### 13.3 Acceptance Criteria

- Original files remain untouched.
- Derivative files store metadata: source file, tool used, preset, dimensions, size, format, created by, created at.
- Tool outputs can be attached to customer or application.
- Extension can suggest prepared derivatives when a file input is detected.

---

## 14. Form Detection and Field Mapping Engine

### 14.1 Engine Goals

The form engine must:

- Detect visible input fields on active web pages.
- Understand labels, placeholders, names, IDs, aria labels, surrounding text, table context, and section headings.
- Support English and Hindi labels.
- Map detected fields to customer profile fields.
- Use portal adapters where available.
- Fall back to generic AI/rules mapping for unsupported forms.
- Generate confidence and review requirements.
- Fill fields safely without submitting.

### 14.2 Detection Inputs

The content script should collect field metadata, not customer PII:

- Tag name.
- Input type.
- Name attribute.
- ID.
- Placeholder.
- Label text.
- Aria label.
- Nearby text.
- Section heading.
- Options for select/radio inputs.
- Required flag.
- Validation attributes.
- Current value present or empty.
- Visibility.
- Field coordinates.
- Form URL origin and path.
- Page title.

Do not send complete page HTML unless product owner explicitly approves for debugging, and never include customer PII in adapter reports by default.

### 14.3 Mapping Strategy

Priority order:

1. Portal adapter exact mapping.
2. Organization custom mapping.
3. Historical successful mapping for same portal/form version.
4. Rules-based dictionary.
5. AI-assisted mapping using field metadata only.
6. Manual operator mapping.

### 14.4 Example Mapping Dictionary

```json
{
  "customer.full_name": [
    "name",
    "applicant name",
    "candidate name",
    "full name",
    "नाम",
    "आवेदक का नाम"
  ],
  "customer.father_name": [
    "father name",
    "father's name",
    "guardian name",
    "पिता का नाम",
    "अभिभावक का नाम"
  ],
  "customer.date_of_birth": [
    "dob",
    "date of birth",
    "birth date",
    "जन्म तिथि"
  ]
}
```

### 14.5 Field Types

Supported MVP field types:

- Text input.
- Textarea.
- Email.
- Phone.
- Date input.
- Select dropdown.
- Radio group.
- Checkbox.
- File input helper.

Complex fields to handle carefully:

- Dependent dropdowns: state -> district -> block.
- Autocomplete fields.
- Captcha fields: detect and skip.
- OTP fields: detect and skip.
- Payment fields: do not autofill in MVP unless explicitly approved.

### 14.6 Confidence Rules

Confidence categories:

- 0.90 to 1.00: high confidence, can fill after preview.
- 0.70 to 0.89: medium confidence, show in review.
- Below 0.70: low confidence, require manual confirmation.

Always require review for:

- Aadhaar-like number.
- PAN.
- Bank account.
- Category/caste.
- Income.
- Disability.
- DOB if extracted from low-quality OCR.
- Any field where source value is unverified.

### 14.7 Portal Adapter Schema

```ts
type PortalAdapter = {
  id: string;
  portalName: string;
  formName: string;
  region?: string;
  urlPatterns: string[];
  version: string;
  status: "draft" | "testing" | "active" | "deprecated";
  lastVerifiedAt?: string;
  fields: AdapterField[];
  documentRequirements: DocumentRequirement[];
  notes?: string;
};

type AdapterField = {
  key: string;
  customerField: string;
  selector?: string;
  labelPatterns?: string[];
  inputType: string;
  transform?: string;
  required?: boolean;
  reviewRequired?: boolean;
};
```

### 14.8 No Auto Submit

Hard rule:

- Assistigo may fill fields.
- Assistigo may prepare documents.
- Assistigo may create application records.
- Assistigo must not click final submit, confirm payment, solve CAPTCHA, bypass OTP, or impersonate final user consent.

---

## 15. Chrome Manifest V3 Extension Architecture

### 15.1 Components

1. Manifest
   - MV3.
   - Minimal permissions.
   - Host permissions limited where possible.

2. Service worker
   - Background event handling.
   - Auth token refresh coordination.
   - Message routing.
   - API calls.
   - No DOM access.

3. Content script
   - Runs on active pages.
   - Detects fields.
   - Injects floating widget container if enabled.
   - Applies fills.
   - Never stores long-term sensitive data.

4. Popup
   - Quick status.
   - Customer selection.
   - Start detection.
   - Open dashboard.

5. Side panel or injected widget
   - Rich review UI.
   - Field mapping table.
   - Fill controls.

6. Extension storage
   - Store settings and short-lived session state.
   - Avoid storing customer PII locally beyond what is needed for active fill.
   - Use `chrome.storage.session` where possible for sensitive transient data.

7. API client
   - Communicates with Assistigo backend over HTTPS.
   - No service secrets in extension.

### 15.2 Permissions

Start minimal:

- `activeTab`.
- `storage`.
- `scripting` if programmatic injection is needed.
- `sidePanel` if using side panel.

Avoid broad host permissions at first. If broad permissions are needed for user experience, explain clearly in extension privacy copy and Chrome Web Store listing.

### 15.3 Security Constraints

- MV3 disallows remotely hosted executable code. Bundle extension code.
- No API secrets in extension.
- No eval-like execution.
- No customer data in console logs.
- No customer data in error reports unless explicit consent and redaction.
- Content scripts must treat host pages as untrusted.
- Extension must validate messages between page, content script, and service worker.

### 15.4 Extension API Flow

```text
Popup/widget
  -> request selected customer summary
  -> content script detects field metadata
  -> service worker sends metadata to backend
  -> backend returns mapping proposal
  -> widget displays review
  -> user clicks Fill
  -> content script fills fields
  -> service worker records fill session
```

### 15.5 Extension Acceptance Criteria

- Extension can connect to a signed-in dashboard account.
- Extension detects fields on demo pages.
- Extension shows selected customer.
- Extension fills text/select/radio/checkbox fields on demo pages.
- Extension skips CAPTCHA/OTP/final submit.
- Extension records fill session.
- Extension reports errors without leaking PII.

---

## 16. Web Dashboard Architecture

### 16.1 Recommended Stack

- Next.js with TypeScript.
- Supabase Auth.
- Supabase Postgres.
- Supabase Storage.
- Supabase Row Level Security.
- Server actions/API routes or backend service layer.
- React component library using established local design primitives.
- Zod for validation.
- TanStack Query or equivalent for client data fetching where useful.
- i18n library for English/Hindi.

### 16.2 Frontend Principles

- Operational dashboard, not a marketing-heavy app.
- Dense but readable information.
- Fast search.
- Keyboard-friendly customer lookup.
- Clear selected customer state.
- Clear warning for sensitive data.
- No oversized decorative hero UI inside the actual app.
- Accessible labels and focus states.
- Mobile-responsive, but desktop-first because operators use desktops.

### 16.3 Major Modules

```text
apps/web
  auth
  onboarding
  dashboard
  customers
  documents
  document-tools
  applications
  form-library
  fill-sessions
  billing
  settings
  admin
```

### 16.4 State Model

- Auth/session state.
- Current organization.
- Current role/permissions.
- Selected language.
- Recent customers.
- Feature flags.
- Billing entitlements.

---

## 17. Backend and API Architecture

### 17.1 High-Level Architecture

```text
Web Dashboard
       |
Chrome Extension
       |
API Layer
       |
Domain Services
       |
Postgres + Storage + Queue + AI/OCR Providers
```

### 17.2 Domain Services

Customer service:

- CRUD.
- Search.
- Duplicate detection.
- Field verification.
- Merge support later.

Document service:

- Upload.
- Storage.
- Classification.
- Extraction jobs.
- Prepared derivatives.
- Retention/delete.

Form service:

- Field detection metadata ingestion.
- Mapping proposal.
- Adapter library.
- Fill session logging.

Application service:

- Application CRUD.
- Status transitions.
- Document checklist.
- Receipts.

Billing service:

- Plans.
- Entitlements.
- Usage events.
- Payment webhooks.

Audit service:

- Sensitive event logging.
- Support access grants.
- Data export/deletion events.

### 17.3 API Style

Use typed APIs. Acceptable options:

- Next.js route handlers with Zod schemas.
- tRPC.
- OpenAPI-generated types.

Pick one and keep it consistent.

### 17.4 Key API Endpoints

Auth/organization:

- `GET /api/me`
- `GET /api/organizations/current`
- `POST /api/organizations`
- `POST /api/invitations`

Customers:

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PATCH /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/customers/search`

Documents:

- `POST /api/documents/upload-intent`
- `POST /api/documents/:id/process`
- `GET /api/documents/:id/extraction`
- `POST /api/documents/:id/review`
- `DELETE /api/documents/:id`

Document tools:

- `POST /api/document-tools/jobs`
- `GET /api/document-tools/jobs/:id`

Form engine:

- `POST /api/forms/detect`
- `POST /api/forms/map`
- `POST /api/fill-sessions`
- `PATCH /api/fill-sessions/:id`
- `POST /api/form-reports`

Applications:

- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `POST /api/applications/:id/status`

Billing:

- `GET /api/billing/plan`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`
- `GET /api/billing/usage`

### 17.5 Background Jobs

Needed jobs:

- OCR processing.
- AI extraction.
- Document derivative generation.
- Scheduled deletion/retention.
- Billing usage aggregation.
- Adapter health checks.
- Email/notification sending.

Use a queue that works in chosen hosting environment. For MVP, Supabase Edge Functions plus a simple jobs table may be enough. If using a separate Node worker, document deployment clearly.

---

## 18. Database Schema

### 18.1 Schema Principles

- Every tenant-owned table must include `organization_id`.
- Use UUID primary keys.
- Enable RLS on all tenant tables.
- Use soft delete for sensitive business records where audit is required, plus hard delete for privacy deletion workflows when legally allowed.
- Separate extracted/unverified data from confirmed profile data.
- Store document metadata separately from file storage object.
- Encrypt high-risk fields when feasible.

### 18.2 Core Tables

#### organizations

- id uuid pk
- name text
- business_type text
- phone text nullable
- email text nullable
- city text nullable
- district text nullable
- state text nullable
- preferred_locale text default `en`
- plan_id uuid nullable
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz nullable

#### organization_members

- id uuid pk
- organization_id uuid fk
- user_id uuid fk auth.users
- role text
- status text: active, invited, suspended
- created_at timestamptz
- updated_at timestamptz

#### customers

- id uuid pk
- organization_id uuid fk
- customer_code text
- full_name text
- full_name_hi text nullable
- mobile text nullable
- mobile_alt text nullable
- email text nullable
- date_of_birth date nullable
- gender text nullable
- marital_status text nullable
- category text nullable
- father_name text nullable
- mother_name text nullable
- spouse_name text nullable
- guardian_name text nullable
- address_json jsonb
- identity_summary_json jsonb
- education_json jsonb
- certificates_json jsonb
- notes text nullable
- verification_status text
- created_by uuid
- updated_by uuid
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz nullable

#### customer_field_values

Use this for field-level verification and source tracking.

- id uuid pk
- organization_id uuid fk
- customer_id uuid fk
- field_key text
- value_text text nullable
- value_encrypted text nullable
- value_json jsonb nullable
- display_value text nullable
- source_document_id uuid nullable
- confidence numeric nullable
- status text: extracted, operator_verified, customer_confirmed, rejected, expired
- created_by uuid nullable
- updated_by uuid nullable
- created_at timestamptz
- updated_at timestamptz

#### documents

- id uuid pk
- organization_id uuid fk
- customer_id uuid nullable
- application_id uuid nullable
- original_filename text
- storage_bucket text
- storage_path text
- mime_type text
- size_bytes bigint
- sha256 text nullable
- document_type text
- status text: uploaded, processing, extracted, review_required, verified, failed, deleted
- is_sensitive boolean default true
- uploaded_by uuid
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz nullable

#### document_extractions

- id uuid pk
- organization_id uuid fk
- document_id uuid fk
- provider text
- document_type text
- raw_text text nullable
- extracted_fields jsonb
- confidence numeric nullable
- status text: pending, completed, review_required, failed, accepted, rejected
- reviewed_by uuid nullable
- reviewed_at timestamptz nullable
- created_at timestamptz

#### document_derivatives

- id uuid pk
- organization_id uuid fk
- source_document_id uuid fk
- customer_id uuid nullable
- application_id uuid nullable
- tool_type text: photo, signature, pdf
- preset_id uuid nullable
- storage_path text
- mime_type text
- size_bytes bigint
- width int nullable
- height int nullable
- metadata jsonb
- created_by uuid
- created_at timestamptz

#### document_requirement_presets

- id uuid pk
- organization_id uuid nullable for global presets
- name text
- category text
- mime_types text[]
- min_size_bytes bigint nullable
- max_size_bytes bigint nullable
- width int nullable
- height int nullable
- dpi int nullable
- notes text nullable
- created_at timestamptz

#### applications

- id uuid pk
- organization_id uuid fk
- customer_id uuid fk
- portal_adapter_id uuid nullable
- title text
- category text
- status text: draft, pending_documents, ready_to_fill, filled, submitted, pending_followup, approved, rejected, cancelled
- portal_name text nullable
- form_name text nullable
- portal_url text nullable
- portal_reference_number text nullable
- deadline_at timestamptz nullable
- amount_charged numeric nullable
- assigned_to uuid nullable
- created_by uuid
- created_at timestamptz
- updated_at timestamptz

#### application_status_events

- id uuid pk
- organization_id uuid fk
- application_id uuid fk
- old_status text nullable
- new_status text
- note text nullable
- created_by uuid
- created_at timestamptz

#### application_documents

- id uuid pk
- organization_id uuid fk
- application_id uuid fk
- document_id uuid nullable
- derivative_id uuid nullable
- requirement_key text
- status text: required, attached, missing, rejected
- notes text nullable
- created_at timestamptz

#### portal_adapters

- id uuid pk
- organization_id uuid nullable for global adapters
- portal_name text
- form_name text
- region text nullable
- url_patterns text[]
- version text
- status text
- field_mappings jsonb
- document_requirements jsonb
- last_verified_at timestamptz nullable
- created_at timestamptz
- updated_at timestamptz

#### fill_sessions

- id uuid pk
- organization_id uuid fk
- customer_id uuid fk
- application_id uuid nullable
- portal_adapter_id uuid nullable
- page_url text
- page_origin text
- page_title text nullable
- detected_fields_count int
- proposed_fields_count int
- filled_fields_count int
- skipped_fields_count int
- review_required_count int
- status text: detected, reviewed, filled, failed, cancelled
- error_summary text nullable
- created_by uuid
- created_at timestamptz
- updated_at timestamptz

#### fill_session_fields

- id uuid pk
- organization_id uuid fk
- fill_session_id uuid fk
- field_signature text
- field_label text nullable
- input_type text
- mapped_customer_field text nullable
- proposed_value_preview text nullable
- confidence numeric nullable
- action text: filled, skipped, edited, failed
- review_required boolean
- error text nullable
- created_at timestamptz

#### consent_records

- id uuid pk
- organization_id uuid fk
- customer_id uuid nullable
- consent_subject text: customer_data, document_storage, ai_processing
- consent_text_version text
- status text: granted, withdrawn
- collected_by uuid nullable
- collected_at timestamptz
- withdrawn_at timestamptz nullable
- evidence_json jsonb nullable

#### audit_logs

- id uuid pk
- organization_id uuid nullable
- actor_user_id uuid nullable
- actor_type text
- action text
- entity_type text
- entity_id uuid nullable
- sensitivity text: normal, sensitive, critical
- ip_address inet nullable
- user_agent text nullable
- metadata jsonb
- created_at timestamptz

#### plans

- id uuid pk
- code text unique
- name text
- price_monthly_inr numeric
- included_fills int
- included_ai_extractions int
- included_seats int
- max_customers int nullable
- features jsonb
- active boolean

#### subscriptions

- id uuid pk
- organization_id uuid fk
- plan_id uuid fk
- provider text
- provider_customer_id text nullable
- provider_subscription_id text nullable
- status text
- current_period_start timestamptz nullable
- current_period_end timestamptz nullable
- created_at timestamptz
- updated_at timestamptz

#### usage_events

- id uuid pk
- organization_id uuid fk
- user_id uuid nullable
- event_type text: fill, ai_extraction, document_tool, storage, seat
- quantity int default 1
- billable boolean default true
- metadata jsonb
- created_at timestamptz

### 18.3 RLS Requirements

For each tenant table:

- User can access rows only when they are an active member of the row's organization.
- Role permissions restrict mutation.
- Billing/admin roles do not automatically grant document access.
- Internal support access requires support grant table and audit logs.

Add automated tests for RLS before pilot.

---

## 19. Security and Privacy Requirements

### 19.1 Legal and Compliance Context

Assistigo may process digital personal data under India's Digital Personal Data Protection Act, 2023 and Digital Personal Data Protection Rules, 2025. The product must be designed around lawful purpose, clear notice, consent where required, data minimization, security safeguards, user rights, correction/erasure workflows, grievance handling, and processor accountability.

This document is not legal advice. Before production launch with real identity documents, get professional legal/privacy review.

### 19.2 Privacy Principles

- Collect only what the operator needs for service workflows.
- Make customer consent explicit and versioned.
- Separate raw documents from extracted fields.
- Mask sensitive identifiers by default.
- Encrypt high-risk values.
- Do not use customer data for model training.
- Do not send raw documents to AI providers unless covered by policy and settings.
- Provide data deletion/export tools.
- Log sensitive access.
- Keep support access limited, approved, and audited.

### 19.3 Sensitive Data Handling

Aadhaar-like data:

- Store last four by default.
- Do not store full Aadhaar in MVP unless legal review approves.
- Mask display values.
- Avoid using Aadhaar as search key.

PAN/bank details:

- Encrypt if stored.
- Show masked values by default.
- Require role permission to reveal.

Documents:

- Store in private buckets.
- Use signed URLs with short expiry.
- Prevent public access.
- Scan/validate file types.
- Strip metadata where appropriate for generated derivatives.

AI/OCR:

- Redact where possible.
- Use provider with suitable data handling terms.
- Store provider request IDs for audit without storing unnecessary payloads.
- Provide an organization setting for AI processing acknowledgement.

### 19.4 Authentication and Access

- Supabase Auth or equivalent.
- Strong password requirements.
- Email verification.
- Optional MFA after MVP.
- Session revocation.
- Device/session list.
- Role-based permissions.
- Invite workflow with expiry.

### 19.5 Audit Events

Audit at minimum:

- Login failures.
- Member invite/remove/role change.
- Customer create/update/delete.
- Sensitive field reveal.
- Document upload/download/delete.
- OCR extraction accepted.
- Fill session run.
- Application status change.
- Billing plan change.
- Data export/delete.
- Support access grant/use.

### 19.6 Extension Security

- Avoid broad permissions where possible.
- Do not read inactive tabs.
- Do not run on browser internal pages.
- Do not inject remote code.
- Do not log field values.
- Treat all page DOM as untrusted.
- Validate all messages.
- Sanitize any text displayed in widget.

### 19.7 Abuse Prevention

Assistigo must not:

- Bypass CAPTCHA.
- Automate OTP capture.
- Submit applications without human review.
- Impersonate citizens.
- Scrape protected data.
- Enable credential stuffing.
- Fill payment credentials automatically in MVP.

---

## 20. Hindi/English Localization

### 20.1 Language Strategy

MVP must support English and Hindi UI foundations.

Default:

- English for technical/admin pages.
- Hindi/English toggle for operator workflows.
- Hinglish marketing copy acceptable where useful.

### 20.2 Translation Examples

| Key | English | Hindi |
|---|---|---|
| customers | Customers | ग्राहक |
| applications | Applications | आवेदन |
| documents | Documents | दस्तावेज़ |
| select_customer | Select Customer | ग्राहक चुनें |
| fill_form | Fill Form | फॉर्म भरें |
| review_fields | Review Fields | जानकारी जांचें |
| needs_review | Needs Review | जांच जरूरी |
| ready_to_fill | Ready to Fill | भरने के लिए तैयार |
| document_tools | Document Tools | दस्तावेज़ टूल |

### 20.3 Localization Requirements

- Use translation keys, not hard-coded text.
- Store user locale.
- Store organization default locale.
- Support Hindi field synonyms in form mapping.
- Use Indian date, phone, address, and currency formats.
- Ensure fonts render Devanagari clearly.
- Keep layout resilient for longer Hindi text.

---

## 21. Application Tracking

### 21.1 Purpose

Application tracking turns Assistigo from an autofill utility into a service-centre operating system.

### 21.2 Application Fields

- Customer.
- Portal/form.
- Status.
- Required documents.
- Assigned operator.
- Deadline.
- Fee charged.
- Payment status optional.
- Portal reference number.
- Receipt attachment.
- Notes.
- Fill session link.
- Status history.

### 21.3 Status Model

Recommended statuses:

- Draft.
- Pending documents.
- Ready to fill.
- Filled.
- Submitted.
- Pending follow-up.
- Approved.
- Rejected.
- Cancelled.

### 21.4 Acceptance Criteria

- Operators can manually create applications.
- Extension can create an application from a fill session.
- Application history is visible on customer profile.
- Status changes are audited.
- Application tracking does not claim official government status unless there is a real integration.

---

## 22. Billing and Pricing Hooks

### 22.1 Pricing Hypothesis

Use as implementation placeholders, not final business commitment:

- Free: INR 0, limited fills and AI extractions.
- Starter: INR 299/month, small operator.
- Professional: INR 599/month, regular service centre.
- Business: INR 999/month or higher, more seats and usage.
- Extra credits for AI extractions or high usage.

### 22.2 Billing Architecture

Use provider abstraction:

```ts
interface BillingProvider {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  handleWebhook(input: WebhookInput): Promise<void>;
  getPortalUrl(input: PortalInput): Promise<string>;
}
```

Potential providers:

- Razorpay for India-first payments.
- Stripe if available and appropriate.

Do not hard-code provider-specific logic across the app.

### 22.3 Entitlements

Entitlements should control:

- Monthly fill count.
- Monthly AI extraction count.
- Seats.
- Max customers where applicable.
- Document storage limit.
- Advanced document tools.
- Form adapter library access.
- Support level.

### 22.4 Usage Events

Record billable events:

- Form fill.
- AI extraction.
- Document tool generation.
- Additional seat.
- Storage overage later.

Acceptance criteria:

- App can run in free mode without payment provider.
- Usage limits are enforced server-side.
- Billing webhook updates subscription idempotently.
- Failed billing must not delete customer data.

---

## 23. Testing Strategy

### 23.1 Test Types

Unit tests:

- Validation utilities.
- Field mapping rules.
- Data transforms.
- Permission helpers.
- Document requirement calculations.

Integration tests:

- API routes.
- Database RLS.
- Customer creation.
- Document extraction review.
- Application status transitions.
- Billing webhook idempotency.

Extension tests:

- Field detection on demo forms.
- Mapping preview.
- Fill actions.
- No submit click.
- CAPTCHA/OTP skip.
- Messaging between popup, service worker, and content script.

E2E tests:

- New organization onboarding.
- Add customer.
- Upload document fixture.
- Review extraction.
- Fill demo form.
- Create application.

OCR golden tests:

- Use fake generated documents only.
- Expected extracted fields.
- Confidence thresholds.
- Regression fixtures.

Security tests:

- RLS access denial across organizations.
- Role mutation denial.
- Private storage URL checks.
- Audit log creation.
- Sensitive values redacted in logs.

Accessibility tests:

- Keyboard navigation.
- Focus order.
- Labels.
- Color contrast.
- Hindi text layout.

### 23.2 Demo Form Fixtures

Create local demo forms:

- Basic English application form.
- Hindi/English government-style form.
- Recruitment form with photo/signature file inputs.
- Form with state/district dropdowns.
- Form with CAPTCHA placeholder that must be skipped.
- Form with OTP placeholder that must be skipped.

### 23.3 Acceptance Gate for Pilot

Before pilot:

- All P0 tests pass.
- RLS tests pass.
- Extension demo fill passes in Chrome.
- No customer PII in logs.
- Document upload private storage verified.
- Manual QA checklist completed in Antigravity.

---

## 24. Observability

### 24.1 Events to Track

Product events:

- Organization created.
- Customer created.
- Document uploaded.
- Extraction completed.
- Extraction reviewed.
- Extension connected.
- Form detected.
- Fill completed.
- Application created.
- Plan upgraded.

Operational metrics:

- OCR job duration.
- OCR failure rate.
- Mapping confidence distribution.
- Fill success rate.
- Adapter failure rate.
- API latency.
- Queue depth.
- Storage usage.

Security metrics:

- Failed logins.
- Sensitive field reveal.
- Cross-org access denied.
- Support access usage.

### 24.2 Logging Rules

- Never log full Aadhaar/PAN/bank values.
- Avoid logging extracted raw text.
- Redact customer names/mobile numbers from error logs where possible.
- Store debug payloads only in development.
- Production logs must be structured and redacted.

### 24.3 Error Reporting

Use an error tool such as Sentry or equivalent:

- Web frontend errors.
- Backend errors.
- Worker errors.
- Extension errors.

Extension user reports should include:

- Portal URL origin/path.
- Adapter ID if present.
- Browser version.
- Extension version.
- Anonymized field metadata.
- User note.
- No customer values by default.

---

## 25. Deployment and CI/CD

### 25.1 Environments

Local:

- Developer machine.
- Seed data.
- Fake documents.
- Local demo forms.

Development:

- Shared dev environment.
- Test keys.
- No real customer data.

Staging:

- Production-like.
- Used for Antigravity QA.
- Fake/demo data only unless approved.

Production:

- Real users.
- Strict logging redaction.
- Backups.
- Monitoring.

### 25.2 Recommended Hosting

- Web: Vercel or similar.
- Database/Auth/Storage: Supabase.
- Background jobs: Supabase Edge Functions or a Node worker service.
- Extension: Chrome Web Store private/unlisted beta, then public.

### 25.3 CI Checks

Every PR must run:

- Typecheck.
- Lint.
- Unit tests.
- Integration tests.
- RLS tests.
- Build web.
- Build extension.
- Migration validation.

Release checks:

- E2E tests.
- Extension manual smoke.
- Security checklist.
- Changelog.

### 25.4 Database Migrations

Rules:

- All schema changes use migrations.
- No manual production schema edits.
- Migrations must be reversible when practical.
- RLS policies must be included with table creation.
- Seed data must be separate from migrations.

---

## 26. Project Folder Structure

Recommended monorepo:

```text
assistigo/
  docs/
    PRD.md
    MASTER_BUILD_SPEC.md
    ARCHITECTURE.md
    DATABASE.md
    SECURITY.md
    AI_PIPELINE.md
    EXTENSION.md
    FORM_ENGINE.md
    ROADMAP.md
    DEVELOPMENT_RULES.md
    QA_CHECKLIST.md

  apps/
    web/
      app/
      components/
      lib/
      messages/
      tests/

    extension/
      manifest.json
      src/
        background/
        content/
        popup/
        sidepanel/
        shared/
      tests/

  packages/
    database/
      migrations/
      seed/
      rls-tests/

    ui/
      components/
      styles/

    config/
      eslint/
      tsconfig/

    core/
      customers/
      documents/
      applications/
      billing/
      audit/

    ai/
      ocr/
      extraction/
      providers/
      fixtures/

    form-engine/
      detector/
      mapper/
      adapters/
      dictionaries/
      transforms/

    document-tools/
      image/
      pdf/
      presets/

  tests/
    e2e/
    fixtures/
    demo-forms/

  scripts/
    seed-demo-data.ts
    verify-env.ts
    build-extension.ts

  .github/
    workflows/
```

---

## 27. Coding Standards

### 27.1 General

- TypeScript strict mode.
- No implicit any.
- Use shared domain types.
- Validate all external inputs with schemas.
- Use server-side authorization checks even if UI hides actions.
- Prefer simple, explicit code over clever abstractions.
- Keep domain logic in packages, not scattered UI components.
- No unrelated refactors during feature tasks.

### 27.2 Naming

- Database: snake_case.
- TypeScript variables/functions: camelCase.
- React components: PascalCase.
- Translation keys: dot notation or stable snake_case.
- Customer field keys: `customer.full_name`, `customer.father_name`, etc.

### 27.3 Error Handling

- User-facing errors should be plain and actionable.
- Internal errors should include trace IDs.
- Sensitive values must not appear in errors.
- Background jobs must be retryable and idempotent.

### 27.4 UI Standards

- Use consistent components.
- Use tables for operational lists.
- Use drawers/modals for focused tasks.
- Use tabs for customer profile sections.
- Use badges for status.
- Use icon buttons with tooltips for common actions.
- Ensure Hindi labels fit without overlap.

### 27.5 Privacy Standards

- Default display masked values for sensitive identifiers.
- Require explicit reveal action.
- Audit reveal action.
- Never seed real identity numbers.
- Never commit real documents.

---

## 28. AI-Agent Rules

These rules apply to Claude Code, Antigravity, and any future coding agent.

### 28.1 Universal Agent Rules

- Read this specification before implementation.
- Do not invent product scope outside this document.
- Ask for product-owner decision when a feature affects privacy, billing, or legal risk.
- Keep tasks small.
- Write tests for critical business rules.
- Run tests before claiming completion.
- Do not add auto-submit, CAPTCHA bypass, OTP automation, or credential automation.
- Do not store full Aadhaar-like values unless explicitly approved after legal review.
- Do not use real citizen data in development.
- Do not copy competitor branding, code, text, layouts, or proprietary assets.
- Maintain multi-tenant security.
- Preserve RLS and audit logs.
- Update documentation when architecture changes.

### 28.2 Claude Code Rules

Claude Code should be used for:

- Architecture.
- Backend.
- Database.
- RLS.
- API.
- Chrome extension implementation.
- AI/OCR pipeline.
- Form engine.
- Tests.
- Refactoring.
- Security review.

Claude Code must not receive a prompt like "build all Assistigo." It should receive stage-specific prompts with acceptance criteria.

Required loop:

```text
Read docs
  -> plan small task
  -> implement
  -> test
  -> self-review
  -> fix
  -> summarize
```

### 28.3 Antigravity Rules

Antigravity should be used for:

- Browser QA.
- Visual QA.
- End-to-end workflow testing.
- Extension behavior checks.
- Console/network error capture.
- Accessibility checks.
- Regression screenshots.
- Deployment smoke tests.

Antigravity should produce bug reports with:

- Scenario.
- Steps.
- Expected result.
- Actual result.
- Screenshot/video where useful.
- Console/network errors.
- Severity.
- Suggested owner.

---

## 29. Claude Code Workflow

### 29.1 Initial Repository Prompt

Use this prompt after creating the repo:

```text
Read docs/MASTER_BUILD_SPEC.md, docs/DEVELOPMENT_RULES.md, docs/ARCHITECTURE.md, docs/DATABASE.md, and docs/SECURITY.md.

Implement only the current phase. Do not invent features outside the docs.

Before coding, summarize:
1. what you will build,
2. which files you will touch,
3. which tests you will add,
4. any privacy/security risks.

After coding, run the relevant checks and report results.
```

### 29.2 Stage Prompt Template

```text
Build Phase [X]: [phase name].

Source of truth:
- docs/MASTER_BUILD_SPEC.md
- docs/[relevant docs]

Scope:
- [specific task list]

Acceptance criteria:
- [specific criteria]

Constraints:
- No unrelated refactors.
- No new product scope.
- Maintain RLS/security.
- Add tests.
- Run checks.
```

### 29.3 Claude Review Prompt

```text
Review the current implementation against docs/MASTER_BUILD_SPEC.md for this phase.

Focus on:
- bugs,
- missing acceptance criteria,
- security/privacy gaps,
- RLS mistakes,
- test gaps,
- extension permission risk,
- customer data leakage.

Do not modify code yet. Produce findings with file references and severity.
```

---

## 30. Antigravity QA Workflow

### 30.1 QA Environment

Antigravity should test against local or staging environment with fake demo data.

Never use real Aadhaar/PAN/documents in QA.

### 30.2 Core QA Scenarios

Scenario 1: New owner onboarding

- Sign up.
- Create organization.
- Add fake customer.
- Install/connect extension.
- Open demo form.
- Fill.

Scenario 2: Document import

- Upload fake certificate PDF.
- Review extracted fields.
- Create customer.
- Confirm audit entry.

Scenario 3: Photo tool

- Upload fake photo.
- Apply portal preset.
- Save derivative.
- Attach to application.

Scenario 4: Supported form fill

- Select customer.
- Open supported demo form.
- Detect fields.
- Review mappings.
- Fill.
- Confirm no submit.
- Create application record.

Scenario 5: Permissions

- Owner invites operator.
- Operator creates customer.
- Operator cannot access billing settings.
- Viewer cannot edit sensitive fields.

Scenario 6: Hindi UI

- Switch to Hindi.
- Verify core pages.
- Verify no text overlap.
- Fill Hindi/English demo form.

### 30.3 QA Bug Report Format

```text
Title:
Severity:
Environment:
User role:
Steps:
Expected:
Actual:
Evidence:
Console/network errors:
Suspected area:
```

---

## 31. Phased Implementation Plan

### Phase 0: Product Validation and Repo Setup

Goal:

- Prepare build foundation and validate first workflows.

Tasks:

- Interview 20 operators.
- Collect top 10 forms they fill.
- Record form URLs, document requirements, time per application, errors, and willingness to pay.
- Create repository.
- Add docs folder.
- Add master spec.
- Add architecture/security/database docs derived from this file.
- Set up monorepo tooling.
- Set up CI skeleton.

Acceptance criteria:

- At least 10 operator interviews documented.
- Top 5 MVP workflows selected.
- Repo builds empty web and extension apps.
- CI runs typecheck/lint placeholder.

### Phase 1: Foundation

Goal:

- Multi-tenant SaaS foundation.

Tasks:

- Set up Next.js app.
- Set up Supabase.
- Implement auth.
- Implement organizations.
- Implement organization members and roles.
- Implement dashboard shell.
- Implement settings basics.
- Add RLS policies.
- Add seed data.
- Add tests for organization access.

Acceptance criteria:

- User can sign up and create organization.
- Owner can invite operator.
- Operator cannot access billing settings.
- Cross-organization data access is blocked by tests.

### Phase 2: Customer CRM

Goal:

- Build Indian customer profile system.

Tasks:

- Create customer tables.
- Build customer list/search.
- Build add customer form.
- Build customer profile tabs.
- Add field-level source/verification model.
- Add duplicate warning.
- Add audit logs for customer changes.
- Add fake seed customers.

Acceptance criteria:

- Customer can be created in under 30 seconds.
- Search works by name/mobile/location.
- Customer profile supports Indian address fields.
- Sensitive fields are masked.
- Audit logs record changes.

### Phase 3: Documents and OCR Pipeline

Goal:

- Upload, classify, extract, review, and attach documents.

Tasks:

- Set up private storage.
- Build document upload UI.
- Create documents and document_extractions tables.
- Implement processing job model.
- Implement OCR provider abstraction.
- Implement fake/mock OCR provider for development.
- Implement extraction review UI.
- Implement customer profile update from reviewed extraction.
- Add fake document fixtures.

Acceptance criteria:

- Operator can upload fake document.
- Extraction job completes with structured fields.
- Review UI can accept/edit/reject.
- Accepted fields update customer profile.
- Documents are private.
- No raw sensitive data appears in logs.

### Phase 4: Chrome Extension Basic

Goal:

- Connect extension to account and detect/fill demo forms.

Tasks:

- Create MV3 extension app.
- Implement manifest.
- Implement popup.
- Implement auth connection.
- Implement content script field detector.
- Implement service worker API client.
- Implement side panel/widget field review.
- Implement fill execution for text/date/select/radio/checkbox.
- Add demo forms.
- Add extension tests.

Acceptance criteria:

- Extension connects to staging/local account.
- Extension detects fields on demo form.
- Extension lets operator select customer.
- Extension fills demo form.
- Extension does not submit.
- Extension skips CAPTCHA/OTP placeholders.

### Phase 5: Form Engine and Adapter Library

Goal:

- Make field mapping reliable and extensible.

Tasks:

- Implement field metadata schema.
- Implement mapping dictionary.
- Implement mapper scoring.
- Implement portal_adapters table.
- Build adapter admin/import format.
- Add first 3 to 5 demo adapters.
- Add historical fill session logging.
- Add unsupported form report.

Acceptance criteria:

- Adapter mapping beats generic mapping when URL matches.
- Generic mapping works for common fields.
- Confidence is shown.
- Low-confidence fields require review.
- Form reports do not include customer values.

### Phase 6: Document Tools

Goal:

- Build photo, signature, and PDF preparation tools.

Tasks:

- Implement document_requirement_presets.
- Build photo crop/resize/compress.
- Build signature crop/resize/compress.
- Build PDF compress/merge/split basics.
- Store derivatives.
- Link derivatives to applications.
- Allow extension to suggest matching prepared files.

Acceptance criteria:

- Operator can generate portal-ready photo/signature.
- Output metadata shows dimensions, file size, and format.
- Original file remains preserved.
- Application can attach derivative.

### Phase 7: Application Tracking

Goal:

- Track customer applications.

Tasks:

- Build applications tables.
- Build applications list/detail.
- Build status transitions.
- Build required document checklist.
- Link fill sessions.
- Link documents/derivatives.
- Add application history to customer profile.
- Add status audit logs.

Acceptance criteria:

- Application can be created manually.
- Application can be created after fill session.
- Status changes are tracked.
- Required documents checklist works.
- Customer profile shows application history.

### Phase 8: Billing Hooks

Goal:

- Prepare subscription and usage enforcement.

Tasks:

- Create plans/subscriptions/usage_events tables.
- Implement entitlement service.
- Add usage counters.
- Add plan page.
- Add checkout provider interface.
- Add mock billing provider for local dev.
- Add Razorpay/Stripe provider only after product owner chooses.
- Add webhook idempotency tests.

Acceptance criteria:

- Free plan limits can be enforced.
- Usage events are recorded.
- Mock checkout can upgrade local org.
- Webhook processing is idempotent.
- Billing failure does not delete data.

### Phase 9: Security and Privacy Hardening

Goal:

- Prepare for real pilot data.

Tasks:

- Review all RLS policies.
- Add audit log coverage.
- Add consent records.
- Add export/delete workflows.
- Add sensitive reveal flow.
- Add logging redaction.
- Add support access grant model.
- Add backup/restore plan.
- Run security tests.

Acceptance criteria:

- RLS tests pass.
- Sensitive reveal is audited.
- Customer deletion/export works according to policy.
- Support cannot view documents without grant.
- Logs are redacted.

### Phase 10: Pilot Beta

Goal:

- Release to first real pilot operators.

Tasks:

- Select 5 to 10 pilot centres.
- Configure supported workflows.
- Train operators.
- Monitor fill success.
- Collect bugs.
- Collect payment willingness.
- Measure time saved.
- Improve top adapters.

Acceptance criteria:

- At least 5 operators complete real workflows.
- Fill success rate and failure reasons are measured.
- Operators can explain value in their own words.
- Product owner decides whether to continue, pivot, or narrow.

---

## 32. Seed and Demo Data Strategy

### 32.1 Rules

- Use fake data only.
- Do not use real Aadhaar/PAN/mobile numbers.
- Use obviously invalid but format-like values where needed.
- Add visible "Demo" marks on generated documents.
- Keep fixtures committed only if they contain no real PII.

### 32.2 Demo Customers

Create 20 to 50 fake customers:

- Names common across India, especially Bihar/Uttar Pradesh style examples.
- Mix of genders.
- Different districts/states.
- Fake mobile numbers reserved for testing.
- Fake education/certificate data.
- Fake documents with "DEMO ONLY".

### 32.3 Demo Forms

Create local forms:

- Certificate application.
- Scholarship application.
- Recruitment application.
- Education admission form.
- Banking/CSP style form.
- Hindi/English mixed labels.

### 32.4 Demo Documents

Generate fake PDFs/images:

- Demo ID.
- Demo PAN-like card.
- Demo marksheet.
- Demo income certificate.
- Demo caste certificate.
- Demo residence certificate.
- Demo photo.
- Demo signature.

Acceptance criteria:

- A new developer can seed demo data in one command.
- A QA agent can complete all core workflows with demo data.
- No fixture resembles a real person's full identity.

---

## 33. Future Roadmap

### V1.1: Pilot Improvements

- Improve top adapters.
- Better document extraction.
- Better duplicate detection.
- Operator training/onboarding.
- Hindi copy improvements.
- Faster customer search.

### V1.5: Service-Centre OS

- Receipts for customers.
- Staff performance.
- WhatsApp notification hooks.
- Follow-up reminders.
- More analytics.
- Branches.
- Bulk import.

### V2: Portal Intelligence

- Larger adapter library.
- State-specific workflows.
- Adapter version health checks.
- Form change detection.
- Customer-specific document recommendations.
- Regional language support beyond Hindi.

### V3: Platform Expansion

- Customer portal.
- Franchise/multi-branch management.
- API/webhooks.
- Partner integrations.
- Advanced document verification integrations where legally available.
- AI assistant for operator guidance.

### Deferred Research: Physical E-Card/Card Reader

Only revisit after strong SaaS traction, legal review, hardware feasibility, security architecture, and clear operator demand.

---

## 34. Major Risks and Mitigations

Portal breakage:

- Mitigation: adapter versioning, generic fallback, health checks, operator reports.

Privacy/data breach:

- Mitigation: data minimization, RLS, encryption, audit logs, redaction, legal review.

Autofill mistakes:

- Mitigation: confidence scoring, review UI, no auto-submit, audit sessions.

Too broad MVP:

- Mitigation: start with top 5 to 10 workflows from real operators.

AI/OCR cost:

- Mitigation: provider abstraction, usage limits, caching, paid plans.

Low willingness to pay:

- Mitigation: validate with operators before building full portal library.

Chrome extension review risk:

- Mitigation: minimal permissions, clear privacy policy, no remote code, no deceptive behavior.

Competition:

- Mitigation: Indian customer CRM, document tools, application tracking, operator distribution.

---

## 35. Definition of Done

A feature is done only when:

- It matches this spec or an approved change.
- It has tests appropriate to risk.
- It handles permissions.
- It handles empty/error/loading states.
- It is localized or uses translation keys.
- It avoids PII leakage.
- It has audit logs when sensitive.
- It works with seed/demo data.
- It passes relevant CI checks.
- Antigravity can verify the user workflow where UI/browser behavior matters.

---

## 36. Initial Build Order Summary

Build in this order:

1. Repo/docs/tooling.
2. Auth and organizations.
3. Customer CRM.
4. Documents/upload.
5. OCR mock pipeline and review.
6. Chrome extension demo form fill.
7. Form engine mapping.
8. Document tools.
9. Application tracking.
10. Billing hooks.
11. Security hardening.
12. Pilot workflows.

Do not start with:

- E-card.
- Card reader.
- Hardware.
- 100 portal adapters.
- Fully autonomous AI agent.

---

## 37. External Reference Notes

These references informed the build constraints and product principles:

- FillGenius public site and Chrome Web Store listing: general UX principle of saving profile data once, detecting fields, one-click fill, PDF/profile support, and no automatic form submission.
- Chrome Extensions documentation: MV3 service worker, content script, extension storage, and no remotely hosted code constraints.
- India Code and MeitY references: Digital Personal Data Protection Act, 2023 and Digital Personal Data Protection Rules, 2025.

Use official/current sources again before production legal, extension store, payments, or compliance decisions.

