/**
 * Document intelligence contracts.
 * Master spec §12.3 (provider interface), §12.4 (extraction output); docs/AI_PIPELINE.md §2, §4.
 *
 * Everything in this file is provider-agnostic on purpose. The product is never hard-coded to
 * one OCR vendor (§12.3), so the pipeline downstream of `OcrProvider.extract` only ever sees
 * `OcrResult` — text, blocks and confidence — never a vendor-shaped payload.
 */

import { z } from 'zod';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  DOCUMENT_TYPES,
  type AllowedUploadMimeType,
  type DocumentType,
} from '@assistigo/core';

// ---------------------------------------------------------------------------
// OCR layer
// ---------------------------------------------------------------------------

/** `[x1, y1, x2, y2]` in page pixel coordinates (§12.4). */
export type BoundingBox = readonly [number, number, number, number];

export type OcrBlock = {
  text: string;
  page: number;
  bbox: BoundingBox | null;
  /** 0–1. Providers that do not report per-block confidence should return the page value. */
  confidence: number;
};

export type OcrResult = {
  provider: string;
  /**
   * Vendor request id, kept for audit. The payload itself is never stored
   * (docs/AI_PIPELINE.md §2).
   */
  providerRequestId: string | null;
  rawText: string;
  pageCount: number;
  blocks: OcrBlock[];
  /** Document-level confidence, 0–1, or null when the provider does not report one. */
  confidence: number | null;
};

export type OcrInput = {
  bytes: Uint8Array;
  mimeType: AllowedUploadMimeType;
  filename: string;
  /** What the operator said the document is, if they chose. A hint, never authoritative. */
  hintedType?: DocumentType | null;
  /**
   * Organization-level opt-in for AI processing (§12.3, §19.3). A provider that transmits
   * document bytes off this server MUST refuse to run when this is false.
   */
  aiProcessingEnabled?: boolean;
};

export interface OcrProvider {
  readonly name: string;
  /**
   * True when running this provider sends document bytes to a third party. The pipeline reads
   * this to decide whether org opt-in is required — it is not the provider's job to be trusted
   * about its own consent check.
   */
  readonly sendsDataOffBox: boolean;
  extract(input: OcrInput): Promise<OcrResult>;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type ClassificationResult = {
  documentType: DocumentType;
  confidence: number;
  /** Runner-up scores, so the review UI can offer "did you mean…". Highest first. */
  alternatives: { documentType: DocumentType; confidence: number }[];
};

// ---------------------------------------------------------------------------
// Field extraction (§12.4)
// ---------------------------------------------------------------------------

/**
 * Why a field was pushed into review. Surfaced to the operator as "reason for low confidence"
 * (§7.4.4) — an operator who knows *why* reviews faster than one who just sees a warning.
 */
export const REVIEW_REASONS = [
  'low_confidence',
  'medium_confidence',
  'high_risk_field',
  'format_invalid',
  'ambiguous_match',
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const EXTRACTION_FIELD_STATUSES = ['ok', 'needs_review'] as const;
export type ExtractionFieldStatus = (typeof EXTRACTION_FIELD_STATUSES)[number];

export type ExtractedField = {
  /** A `customer.*` key from the registry in packages/core/src/customers/field-keys.ts. */
  key: string;
  /** The label as printed on the document, for the review screen. */
  label: string;
  value: string;
  /** 0–1. */
  confidence: number;
  /**
   * The line the value was read from, so the operator can check the extractor against the page.
   * Aadhaar-like digit runs are masked before this is ever stored (§19.3) — see `maskIdentifiers`.
   */
  sourceText: string;
  page: number;
  bbox: BoundingBox | null;
  status: ExtractionFieldStatus;
  reviewReason: ReviewReason | null;
};

/** `messageKey` rather than prose, because warnings are shown to the operator (§20.3). */
export type ExtractionWarning = {
  code: string;
  messageKey: string;
  fieldKey?: string;
};

export type ExtractionResult = {
  documentType: DocumentType;
  classificationConfidence: number;
  provider: string;
  providerRequestId: string | null;
  fields: ExtractedField[];
  warnings: ExtractionWarning[];
  /** Mean field confidence, or null when nothing was extracted. */
  confidence: number | null;
};

// ---------------------------------------------------------------------------
// Zod schemas — the boundary guards
// ---------------------------------------------------------------------------

export const boundingBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const extractedFieldSchema = z.object({
  key: z.string().min(1).max(120),
  label: z.string().max(200),
  value: z.string().max(2000),
  confidence: z.number().min(0).max(1),
  sourceText: z.string().max(500),
  page: z.number().int().min(1),
  bbox: boundingBoxSchema.nullable(),
  status: z.enum(EXTRACTION_FIELD_STATUSES),
  reviewReason: z.enum(REVIEW_REASONS).nullable(),
});

export const extractionWarningSchema = z.object({
  code: z.string().max(60),
  messageKey: z.string().max(120),
  fieldKey: z.string().max(120).optional(),
});

export const extractionResultSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  classificationConfidence: z.number().min(0).max(1),
  provider: z.string().max(40),
  providerRequestId: z.string().max(200).nullable(),
  fields: z.array(extractedFieldSchema).max(200),
  warnings: z.array(extractionWarningSchema).max(50),
  confidence: z.number().min(0).max(1).nullable(),
});

export const ocrInputMimeSchema = z.enum(ALLOWED_UPLOAD_MIME_TYPES);

// ---------------------------------------------------------------------------
// Confidence bands (§12.6, §14.6)
// ---------------------------------------------------------------------------

export const CONFIDENCE_HIGH = 0.9;
export const CONFIDENCE_MEDIUM = 0.7;

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_HIGH) return 'high';
  if (confidence >= CONFIDENCE_MEDIUM) return 'medium';
  return 'low';
}
