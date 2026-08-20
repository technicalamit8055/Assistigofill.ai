/**
 * Field extraction from OCR text.
 * Master spec §12.4, §12.5, §12.6; docs/AI_PIPELINE.md §4–§6.
 *
 * Rules-based, line-oriented, and deliberately conservative: a field is only produced when a
 * printed label matched, and every value is normalised through the same helpers the manual
 * entry path uses, so an extracted DOB and a typed DOB are the same shape by the time either
 * reaches the profile.
 *
 * Nothing here writes to a customer. Extraction proposes; a human accepts (§12.6).
 */

import {
  aadhaarLastFour,
  getCustomerField,
  looksLikeAadhaar,
  normalizeMobile,
  normalizeName,
  normalizePan,
  normalizePincode,
  parseIndianDate,
  requiresReview,
  type DocumentType,
} from '@assistigo/core';
import { FIELDS_BY_DOCUMENT_TYPE, LABEL_RULES, type FieldDataKind, type LabelRule } from './rules';
import { sanitizeExtractedFields } from './safety';
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  type BoundingBox,
  type ExtractedField,
  type ExtractionWarning,
  type OcrBlock,
  type OcrResult,
  type ReviewReason,
} from './types';

// ---------------------------------------------------------------------------
// Line splitting
// ---------------------------------------------------------------------------

type SourceLine = {
  raw: string;
  label: string;
  value: string;
  page: number;
  bbox: BoundingBox | null;
  /** Provider confidence for the block this line came from. */
  ocrConfidence: number;
};

/**
 * `Label: Value`, `Label : Value`, `Label   Value` (column-aligned), `Label - Value`,
 * `Label = Value`.
 *
 * The `=` form does not appear on printed documents, but it is ordinary in text an operator
 * pastes out of a portal, a spreadsheet or a message (see ./text.ts).
 */
const LABEL_VALUE = /^(.{2,60}?)\s*(?::|=|\s{2,}|\s[-–—]\s)\s*(.+)$/;

function toLines(blocks: readonly OcrBlock[]): SourceLine[] {
  const lines: SourceLine[] = [];

  for (const block of blocks) {
    for (const raw of block.text.split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (trimmed === '') continue;

      const match = LABEL_VALUE.exec(trimmed);
      lines.push({
        raw: trimmed,
        label: (match?.[1] ?? '').trim(),
        value: (match?.[2] ?? '').trim(),
        page: block.page,
        bbox: block.bbox,
        ocrConfidence: block.confidence,
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Label matching
// ---------------------------------------------------------------------------

function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[*_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0 when the rule does not apply to this label, otherwise a match quality in (0, 1]. */
function scoreLabel(label: string, rule: LabelRule): number {
  const haystack = normaliseLabel(label);
  if (haystack === '') return 0;

  // A negative keyword disqualifies the rule outright. "Father's Name" must never satisfy the
  // applicant-name rule, however well the word "name" matches (§14.4).
  if (rule.negatives?.some((negative) => haystack.includes(negative))) return 0;

  let best = 0;
  for (const candidate of rule.labels) {
    if (haystack === candidate) {
      best = Math.max(best, 0.95);
    } else if (haystack.startsWith(candidate) || haystack.endsWith(candidate)) {
      // Bilingual labels print as "पिता का नाम / Father's Name" — an edge match, not a weak one.
      best = Math.max(best, 0.88);
    } else if (haystack.includes(candidate)) {
      // Guard against "name" matching inside an unrelated word such as "surname of nominee".
      const boundary = new RegExp(`(^|[^a-z\\u0900-\\u097F])${escapeRegExp(candidate)}($|[^a-z\\u0900-\\u097F])`);
      if (boundary.test(haystack)) best = Math.max(best, 0.8);
    }
  }

  return best;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Value normalisation (§12.5)
// ---------------------------------------------------------------------------

const GENDER_SYNONYMS: Record<string, string> = {
  m: 'male',
  male: 'male',
  पुरुष: 'male',
  f: 'female',
  female: 'female',
  महिला: 'female',
  स्त्री: 'female',
  t: 'transgender',
  transgender: 'transgender',
  ट्रांसजेंडर: 'transgender',
  other: 'other',
  अन्य: 'other',
};

const CATEGORY_SYNONYMS: Record<string, string> = {
  general: 'general',
  gen: 'general',
  ur: 'general',
  सामान्य: 'general',
  obc: 'obc',
  'other backward class': 'obc',
  'अन्य पिछड़ा वर्ग': 'obc',
  ओबीसी: 'obc',
  sc: 'sc',
  'scheduled caste': 'sc',
  'अनुसूचित जाति': 'sc',
  st: 'st',
  'scheduled tribe': 'st',
  'अनुसूचित जनजाति': 'st',
  ews: 'ews',
  ईडब्ल्यूएस: 'ews',
};

/**
 * Latin letters and Devanagari only — used to reduce a printed value like "Female / महिला" to a
 * lookup key. Escaped `RegExp` rather than a literal because the Devanagari range spans
 * combining marks, which `no-misleading-character-class` flags (as in core's normalize.ts).
 */
// eslint-disable-next-line no-misleading-character-class
const NON_LETTER_CHARS = new RegExp('[^a-z\\u0900-\\u097F]', 'g');

type NormalisedField = { value: string | null; valid: boolean };

function normaliseValue(raw: string, kind: FieldDataKind): NormalisedField {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, valid: false };

  switch (kind) {
    case 'name': {
      const { value, valid } = normalizeName(trimmed);
      // A "name" made of digits is an OCR misread of an adjacent column, not a name.
      if (value && /\d{3,}/.test(value)) return { value: null, valid: false };
      return { value, valid };
    }
    case 'date': {
      const { value, valid } = parseIndianDate(trimmed);
      return { value, valid };
    }
    case 'mobile': {
      const { value, valid } = normalizeMobile(trimmed);
      return { value, valid };
    }
    case 'pincode': {
      const { value, valid } = normalizePincode(trimmed);
      return { value, valid };
    }
    case 'pan': {
      const { value, valid } = normalizePan(trimmed);
      return { value, valid };
    }
    case 'aadhaar': {
      // Only the last four are ever produced (§19.3). The full number never becomes a field.
      const last4 = aadhaarLastFour(trimmed);
      return { value: last4, valid: last4 !== null };
    }
    case 'number': {
      const digits = trimmed.replace(/[,\s₹]/g, '').replace(/\/-$/, '');
      return /^\d+(\.\d+)?$/.test(digits)
        ? { value: digits, valid: true }
        : { value: null, valid: false };
    }
    case 'year': {
      const match = /\b(19|20)\d{2}\b/.exec(trimmed);
      return match ? { value: match[0], valid: true } : { value: null, valid: false };
    }
    case 'gender': {
      const key = trimmed.toLowerCase().replace(NON_LETTER_CHARS, '');
      const mapped = GENDER_SYNONYMS[key];
      return mapped ? { value: mapped, valid: true } : { value: null, valid: false };
    }
    case 'category': {
      const key = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
      const mapped = CATEGORY_SYNONYMS[key] ?? CATEGORY_SYNONYMS[key.replace(/\s+/g, '')];
      return mapped ? { value: mapped, valid: true } : { value: null, valid: false };
    }
    case 'longtext':
      return { value: trimmed.slice(0, 500), valid: true };
    case 'text':
    default:
      return { value: trimmed.slice(0, 200), valid: true };
  }
}

// ---------------------------------------------------------------------------
// Review rules (§12.6, §14.6)
// ---------------------------------------------------------------------------

function reviewReasonFor(key: string, confidence: number, formatValid: boolean): ReviewReason | null {
  if (!formatValid) return 'format_invalid';
  // High-risk fields are reviewed however confident the extractor is (§12.6).
  if (requiresReview(key)) return 'high_risk_field';
  if (confidence < CONFIDENCE_MEDIUM) return 'low_confidence';
  if (confidence < CONFIDENCE_HIGH) return 'medium_confidence';
  return null;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export type ExtractFieldsInput = {
  ocr: OcrResult;
  documentType: DocumentType;
  /**
   * Overrides the per-class allow-list. Used by the pasted-text path (./text.ts), where there is
   * no document to classify and restricting to one class would silently drop fields the operator
   * deliberately typed. Safety is unaffected: `sanitizeExtractedFields` still runs, so a
   * forbidden key cannot be re-admitted through this door.
   */
  allowedKeys?: readonly string[];
};

/**
 * Runs the label rules over the OCR output and returns proposed fields.
 *
 * Only fields the document class can legitimately contain are considered
 * (`FIELDS_BY_DOCUMENT_TYPE`), so a PAN card never yields a district and an income certificate
 * never yields a Class 10 board.
 */
export function extractFields(input: ExtractFieldsInput): {
  fields: ExtractedField[];
  warnings: ExtractionWarning[];
} {
  const allowedKeys = new Set(input.allowedKeys ?? FIELDS_BY_DOCUMENT_TYPE[input.documentType] ?? []);
  const rules = LABEL_RULES.filter((rule) => allowedKeys.has(rule.key));
  const warnings: ExtractionWarning[] = [];

  if (rules.length === 0) {
    return { fields: [], warnings };
  }

  const lines = toLines(input.ocr.blocks);
  // Best candidate per field key — a document that prints "Name" twice should yield one name.
  const best = new Map<string, ExtractedField>();

  for (const line of lines) {
    if (line.label === '' || line.value === '') continue;

    const matches = rules
      .map((rule) => ({ rule, score: scoreLabel(line.label, rule) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const top = matches[0];
    if (!top) continue;

    // Two different fields claiming the same line with equal strength is not a decision.
    // Keep the value but push it into review rather than guessing (§12.6).
    const runnerUp = matches[1];
    const ambiguous = runnerUp !== undefined && top.score - runnerUp.score < 0.01;

    const normalised = normaliseValue(line.value, top.rule.kind);
    if (normalised.value === null) {
      warnings.push({
        code: 'VALUE_NOT_UNDERSTOOD',
        messageKey: 'documents.warnings.valueNotUnderstood',
        fieldKey: top.rule.key,
      });
      continue;
    }

    // Label quality and OCR quality both bound the result: a perfect label read off a blurry
    // scan is not a confident field.
    let confidence = top.score * clamp01(line.ocrConfidence);
    if (ambiguous) confidence *= 0.75;
    if (!normalised.valid) confidence *= 0.6;
    confidence = Number(clamp01(confidence).toFixed(3));

    const reviewReason = ambiguous
      ? 'ambiguous_match'
      : reviewReasonFor(top.rule.key, confidence, normalised.valid);

    const candidate: ExtractedField = {
      key: top.rule.key,
      label: line.label.slice(0, 200),
      value: normalised.value,
      confidence,
      sourceText: line.raw.slice(0, 500),
      page: line.page,
      bbox: line.bbox,
      status: reviewReason === null ? 'ok' : 'needs_review',
      reviewReason,
    };

    const existing = best.get(candidate.key);
    if (!existing || candidate.confidence > existing.confidence) {
      best.set(candidate.key, candidate);
    }
  }

  // Unlabelled identifiers. A PAN card prints the number on its own line with no label at all,
  // and an Aadhaar prints the digits under the photo.
  for (const field of scanUnlabelledIdentifiers(input.ocr, allowedKeys)) {
    if (!best.has(field.key)) best.set(field.key, field);
  }

  const fields = sanitizeExtractedFields([...best.values()]);

  if (fields.length === 0) {
    warnings.push({ code: 'NO_FIELDS_FOUND', messageKey: 'documents.warnings.noFieldsFound' });
  }
  if (!fields.some((field) => field.key === 'customer.full_name') && allowedKeys.has('customer.full_name')) {
    warnings.push({ code: 'NO_NAME_FOUND', messageKey: 'documents.warnings.noNameFound' });
  }

  return { fields, warnings };
}

/**
 * True when a whole line reads as a printed field label rather than a value.
 *
 * Pasted text copied out of a two-column table arrives as "Father's Name" on one line and the
 * value on the next, with no separator to key off. ./text.ts uses this to decide whether it may
 * pair two lines; the threshold is the same edge-match score `scoreLabel` gives a bilingual
 * label, so a line has to be a near-exact label to qualify.
 */
export function isKnownFieldLabel(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.length > 60) return false;
  return LABEL_RULES.some((rule) => scoreLabel(trimmed, rule) >= 0.88);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const PAN_PATTERN = /\b[A-Z]{5}\d{4}[A-Z]\b/;
const TWELVE_DIGITS = /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/;

/**
 * Values that carry their own format and often appear without a printed label.
 *
 * Confidence is capped below the high band on purpose: a pattern match proves the shape of a
 * value, never that it belongs to this customer, so it always reaches the operator for review.
 */
function scanUnlabelledIdentifiers(ocr: OcrResult, allowedKeys: ReadonlySet<string>): ExtractedField[] {
  const found: ExtractedField[] = [];

  for (const block of ocr.blocks) {
    for (const raw of block.text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line === '') continue;

      if (allowedKeys.has('customer.pan')) {
        const pan = PAN_PATTERN.exec(line.toUpperCase());
        if (pan) {
          found.push({
            key: 'customer.pan',
            label: 'PAN',
            value: pan[0],
            confidence: 0.85,
            sourceText: line.slice(0, 500),
            page: block.page,
            bbox: block.bbox,
            status: 'needs_review',
            reviewReason: 'high_risk_field',
          });
        }
      }

      if (allowedKeys.has('customer.aadhaar_last4')) {
        const digits = TWELVE_DIGITS.exec(line);
        // The Verhoeff check decides whether this is plausibly an Aadhaar at all; only the last
        // four survive either way (§19.3).
        if (digits && looksLikeAadhaar(digits[0])) {
          const last4 = aadhaarLastFour(digits[0]);
          if (last4) {
            found.push({
              key: 'customer.aadhaar_last4',
              label: 'Aadhaar',
              value: last4,
              confidence: 0.85,
              // Masked by sanitizeExtractedFields before this is stored.
              sourceText: line.slice(0, 500),
              page: block.page,
              bbox: block.bbox,
              status: 'needs_review',
              reviewReason: 'high_risk_field',
            });
          }
        }
      }
    }
  }

  return found;
}

/** Mean field confidence — the document-level number shown on the review screen. */
export function meanConfidence(fields: readonly ExtractedField[]): number | null {
  if (fields.length === 0) return null;
  const total = fields.reduce((sum, field) => sum + field.confidence, 0);
  return Number((total / fields.length).toFixed(3));
}

/** Human-readable label for a field key, for the review UI. */
export function fieldLabel(key: string, locale: 'en' | 'hi'): string {
  return getCustomerField(key)?.label[locale] ?? key;
}
