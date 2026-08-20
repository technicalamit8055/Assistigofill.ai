/**
 * Extraction from text an operator pastes, rather than from a scanned document.
 * Master spec §9.3, §12.4–§12.6; docs/AI_PIPELINE.md §4–§6, §9.
 *
 * Operators routinely already *have* a customer's details as text — copied out of a portal, a
 * spreadsheet, an email or a message — and retyping them into the profile is the slow step the
 * product exists to remove. This module gives that text the same treatment a document gets:
 * the same label dictionary, the same normalisation, the same confidence banding, the same
 * Aadhaar safety gate, and the same human review before anything reaches a profile.
 *
 * Two things are deliberately different from the document path:
 *
 *   1. There is no OCR and no classification. The operator chose this text; there is no scan
 *      quality to discount and no document class to guess. Confidence therefore reflects label
 *      quality alone, and the whole dictionary is in scope rather than one class's fields.
 *   2. The pasted text is never persisted. A document keeps its raw text until review because
 *      the reviewer needs to check the extractor against the page; pasted text is already in
 *      front of the operator, so storing a second copy would be retention with no purpose
 *      (docs/AI_PIPELINE.md §7).
 *
 * Nothing here writes to a customer. Extraction proposes; a human accepts (§12.6).
 */

import { extractFields, isKnownFieldLabel, meanConfidence } from './extract';
import { ALL_EXTRACTABLE_FIELD_KEYS } from './rules';
import { containsAadhaarLikeNumber } from './safety';
import type { ExtractedField, ExtractionWarning, OcrResult } from './types';

/**
 * Enough for a long pasted profile and far short of anything that would make the line splitter
 * a denial-of-service surface. Text beyond this is truncated, with a warning, rather than
 * rejected — an operator who pasted too much should still get their fields.
 */
export const MAX_PASTED_TEXT_LENGTH = 20_000;

/** Beyond this the input is a document dump, not a customer's details. */
const MAX_PASTED_LINES = 400;

/**
 * Splits a line at a comma, semicolon, pipe or bullet **only** when what follows starts a new
 * `label:` pair.
 *
 * Pasted details are often one run-on line: `Name: Amit Kumar, Father: Ram Kumar, DOB: 01/01/1990`.
 * Splitting on every comma would also cut `Address: H.No 12, Rampur, Ghazipur` into pieces and
 * lose the address, so the lookahead requires a plausible label — 2 to 40 characters carrying no
 * separator of its own — followed by `:` or `=`.
 */
const INLINE_PAIR_SEPARATOR = /\s*[,;|•]\s*(?=[^,;|•:=]{2,40}\s*[:=]\s*\S)/g;

/** Zero-width characters survive a copy out of a PDF and break label matching invisibly. */
const ZERO_WIDTH = new RegExp('[\u200B-\u200D\uFEFF]', 'g');

/**
 * Reduces pasted text to one candidate line per `label / value` pair.
 *
 * Exported for the tests, which assert the splitter separately from the extractor: a line
 * splitter that quietly merges two fields is the failure mode that would make the whole feature
 * look like a bad extractor.
 */
export function splitPastedText(text: string): string[] {
  const lines: string[] = [];

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const cleaned = rawLine.replace(ZERO_WIDTH, '').trim();
    if (cleaned === '') continue;

    for (const segment of cleaned.split(INLINE_PAIR_SEPARATOR)) {
      const trimmed = segment.trim();
      if (trimmed !== '') lines.push(trimmed);
    }
  }

  return pairOrphanLabels(lines).slice(0, MAX_PASTED_LINES);
}

/** A line that already carries its own separator does not need a partner on the next line. */
const HAS_INLINE_SEPARATOR = /(?::|=|\s{2,}|\s[-–—]\s)\s*\S/;

/**
 * Joins `Father's Name` / `Ram Kumar` on consecutive lines into one `Father's Name: Ram Kumar`.
 *
 * This is what text copied out of a two-column table looks like once the column boundary is
 * gone. The pairing is deliberately timid — the first line must read as a known label and the
 * second must not look like a label or a pair itself — because a wrong pairing files a value
 * under someone else's field, which is the most damaging extraction error there is (§14.4).
 */
function pairOrphanLabels(lines: readonly string[]): string[] {
  const out: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    const next = lines[index + 1];

    const isOrphanLabel =
      !HAS_INLINE_SEPARATOR.test(line) &&
      isKnownFieldLabel(line) &&
      next !== undefined &&
      !HAS_INLINE_SEPARATOR.test(next) &&
      !isKnownFieldLabel(next);

    if (isOrphanLabel) {
      out.push(`${line}: ${next as string}`);
      index += 1;
      continue;
    }

    out.push(line);
  }

  return out;
}

/**
 * Wraps pasted lines in the shape the extractor already understands.
 *
 * Confidence is 1.0 because nothing was read off a page — the characters are exactly what the
 * operator supplied. That does not make the *mapping* certain, which is what the label score
 * still measures, and every high-risk field is reviewed regardless (§12.6).
 */
function toPastedOcrResult(lines: readonly string[]): OcrResult {
  return {
    provider: 'pasted_text',
    providerRequestId: null,
    rawText: lines.join('\n'),
    pageCount: 1,
    blocks: lines.map((text) => ({ text, page: 1, bbox: null, confidence: 1 })),
    confidence: 1,
  };
}

export type ExtractFromTextInput = {
  text: string;
  /**
   * Restricts extraction to these keys. Omitted, the whole dictionary is in scope — which is
   * the point of this path. Provided, it is intersected with the dictionary, never added to.
   */
  allowedKeys?: readonly string[];
};

export type TextExtractionResult = {
  fields: ExtractedField[];
  warnings: ExtractionWarning[];
  /** Mean field confidence, or null when nothing was extracted. */
  confidence: number | null;
  /** How many candidate lines the splitter produced — shown as "read N lines". */
  lineCount: number;
};

/**
 * Proposes `customer.*` fields from pasted text.
 *
 * Returns proposals only. The caller shows them to a human, and only an accepted field is ever
 * written to a profile (§12.6, §9.3).
 */
export function extractFromText(input: ExtractFromTextInput): TextExtractionResult {
  const warnings: ExtractionWarning[] = [];

  const truncated = input.text.length > MAX_PASTED_TEXT_LENGTH;
  const text = truncated ? input.text.slice(0, MAX_PASTED_TEXT_LENGTH) : input.text;

  if (truncated) {
    warnings.push({ code: 'TEXT_TRUNCATED', messageKey: 'customers.paste.warnings.textTruncated' });
  }

  // Said before extraction, because the operator should learn that the number was dropped even
  // if nothing else in their paste matched a label (§19.3).
  if (containsAadhaarLikeNumber(text)) {
    warnings.push({
      code: 'AADHAAR_REMOVED',
      messageKey: 'customers.paste.warnings.aadhaarRemoved',
    });
  }

  const lines = splitPastedText(text);

  if (lines.length === 0) {
    return {
      fields: [],
      warnings: [
        ...warnings,
        { code: 'NO_TEXT', messageKey: 'customers.paste.warnings.noText' },
      ],
      confidence: null,
      lineCount: 0,
    };
  }

  const allowed = input.allowedKeys
    ? ALL_EXTRACTABLE_FIELD_KEYS.filter((key) => input.allowedKeys?.includes(key))
    : ALL_EXTRACTABLE_FIELD_KEYS;

  const { fields, warnings: extractionWarnings } = extractFields({
    ocr: toPastedOcrResult(lines),
    // Unused — `allowedKeys` decides the scope — but the extractor's contract requires a class,
    // and `generic` is the honest answer for text that is not a document.
    documentType: 'generic',
    allowedKeys: allowed,
  });

  return {
    fields,
    warnings: [...warnings, ...extractionWarnings.map(retargetWarning)],
    confidence: meanConfidence(fields),
    lineCount: lines.length,
  };
}

/**
 * The extractor is written for documents, so two of its warnings say "this document". The code
 * is the contract and does not change; only the sentence the operator reads does.
 */
const PASTE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  NO_FIELDS_FOUND: 'customers.paste.warnings.noFieldsFound',
  NO_NAME_FOUND: 'customers.paste.warnings.noNameFound',
};

function retargetWarning(warning: ExtractionWarning): ExtractionWarning {
  const messageKey = PASTE_MESSAGE_KEYS[warning.code];
  return messageKey ? { ...warning, messageKey } : warning;
}
